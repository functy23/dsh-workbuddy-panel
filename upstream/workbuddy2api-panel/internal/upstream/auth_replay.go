// auth_replay.go 401 自动刷新重放（issue #243 根因修复）。
//
// 背景：官方客户端（AuthenticationHttpInterceptor + fetch 拦截器）在收到 401 时
// **先 refreshSession 再用新 token 重放一次**（报告 §2.3「401 恢复」）。本项目此前
// 完全没有这条链路：
//   - chat 只在「NeedsRefresh 判定临近过期」时才预刷新，token 被上游提前吊销
//     （后台轮换 / 多端登录 / 风控）时，本地 ExpiresAt 仍是未来时刻 → 不刷新；
//   - billing / growth / 余额查询（doJSON）根本不刷新，401 直接变成
//     `upstream client (http 401)` 透给面板；
//   - 401 落到 Classify 是 ErrClient（只换号不罚），账号永远修不好，面板于是反复
//     显示"已禁用 / 疑似登录失效"（issue #242/#243 的现象）。
//
// 本文件的 sendWithAuthReplay 把官方那条链路补上：401 → refreshToken（同账号单飞，
// 见 client.go RefreshToken）→ 用新 token 重放一次。刷新成功即自愈，无需人工重登。
//
// 三层防护（缺一即事故）：
//  1. 只重放一次（第二次 401 = 凭证真死，交回 ErrSessionDead）；
//  2. refresh 调用自身带 X-No-Replay 标记（markNoReplay），绝不递归刷新；
//  3. 请求体可重放性检查（GetBody 或空 body），流式 body 不重放。
package upstream

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
)

// authReplayMaxBody 401 响应体缓存上限（重放失败时要原样交回调用方，做错误分类）。
const authReplayMaxBody = 1 << 20

// noReplayCtxKey 标记「本请求本身是 refresh 调用，禁止再次刷新重放」。
// 没有这个闸口，refresh 端点返回 401（12153）会触发 sendWithAuthReplay 再调
// RefreshToken → 递归刷新并把 RT 链彻底消费掉（issue #215 的作废路径）。
type noReplayCtxKey struct{}

// markNoReplay 标记请求跳过 401 重放（原地改写 context）。
func markNoReplay(req *http.Request) {
	if req == nil {
		return
	}
	*req = *req.WithContext(context.WithValue(req.Context(), noReplayCtxKey{}, true))
}

// isNoReplay 报告请求是否被标记跳过重放。
func isNoReplay(req *http.Request) bool {
	v, _ := req.Context().Value(noReplayCtxKey{}).(bool)
	return v
}

// sendWithAuthReplay 发一次请求；401 时按请求绑定的账号刷新 token 并重放一次。
//
// 语义（与官方客户端一致）：
//   - 只重放一次：第二次仍 401 说明凭证本身已失效（refreshToken 被吊销），
//     直接交回 401 让上层按 ErrClient 换号/冷却——绝不无限重试放大风控。
//   - 刷新失败且为 12153（refresh token 失效）→ 返回 *Error{Kind: ErrSessionDead}，
//     上层据此禁用账号（需人工重登），语义与官方 logout 一致。
//   - 请求体必须可重放（GetBody 非空）。Go 的 http.NewRequest 对 *bytes.Reader /
//     *bytes.Buffer / *strings.Reader 自动设置 GetBody，本项目所有出站请求都是
//     这几类，故恒可重放；不可重放时（防御）不重放，直接交回 401。
//   - 401 响应体先缓存再重放：重放成功后原响应体已无用（关闭即可）；重放失败/未重放
//     时用缓存重建 body，调用方读到的仍是上游原文（错误透传语义不破）。
func (c *Client) sendWithAuthReplay(hc *http.Client, req *http.Request) (*http.Response, error) {
	resp, err := hc.Do(req)
	if err != nil || resp == nil || resp.StatusCode != http.StatusUnauthorized {
		return resp, err
	}
	if isNoReplay(req) {
		return resp, nil // refresh 调用自身：绝不递归刷新
	}
	a := authFromReq(req)
	if a == nil || a.RefreshTokenValue() == "" {
		return resp, nil // 匿名/无 RT 的请求（登录态探测）不做重放
	}
	// 无 body 的请求（GET / POST 空体）天然可重放；有 body 时必须能重新打开
	// （http.NewRequest 对 *bytes.Reader/*bytes.Buffer/*strings.Reader 自动设 GetBody）。
	if req.Body != nil && req.Body != http.NoBody && req.GetBody == nil {
		return resp, nil // 不可重放（流式 body）：保持原样
	}
	// 缓存 401 响应体：重放失败时要原样交回，不能丢上游原文。
	raw, readErr := io.ReadAll(io.LimitReader(resp.Body, authReplayMaxBody))
	resp.Body.Close()
	if readErr != nil {
		return nil, fmt.Errorf("read 401 body: %w", readErr)
	}
	if err := c.RefreshToken(a); err != nil {
		// 刷新失败：把 401 原样交回（保留上游 body），但 12153 要升级成终态语义。
		if isSessionDead(err) {
			return nil, &Error{Kind: ErrSessionDead, Status: http.StatusUnauthorized, Msg: err.Error()}
		}
		return rebuildResponse(resp, raw), nil
	}
	// 刷新成功：用新 token 重放一次。
	replay := req.Clone(req.Context())
	if req.GetBody != nil {
		body, err := req.GetBody()
		if err != nil {
			return rebuildResponse(resp, raw), nil
		}
		replay.Body = body
	}
	if at := a.AccessTokenValue(); at != "" {
		replay.Header.Set("Authorization", "Bearer "+at)
	}
	out, rerr := hc.Do(replay)
	if rerr != nil {
		return nil, rerr
	}
	// 刷新成功但重放仍 401：把响应原样交回调用方（body 保留），由 Classify 判定。
	// 401 无业务信封 → ErrAuthExpired（软冷却 + 连续计数达阈禁用），比在这里
	// 直接断言"凭证已死"更保守：刚签发的新 token 被拒也可能是账号级限制，
	// 交回原文还能让客户端/面板看到上游措辞。
	return out, nil
}

// rebuildResponse 用缓存的 body 重建响应（保持原状态码/头，body 可再读一次）。
func rebuildResponse(orig *http.Response, body []byte) *http.Response {
	orig.Body = io.NopCloser(bytes.NewReader(body))
	orig.ContentLength = int64(len(body))
	return orig
}
