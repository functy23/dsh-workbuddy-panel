// auth_replay_test.go 401 → refresh → 重放 的回归测试（issue #243 根因）。
package upstream

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/linguo2625469/workbuddy2api-panel/internal/auth"
)

// TestDoJSONRefreshesAndReplaysOn401 token 被上游提前吊销时：
// 第一次 401 → 自动 refresh → 用新 token 重放并成功。这是 issue #243
// （面板显示 `upstream client (http 401)`、账号反复"已禁用"）的直接修复点。
func TestDoJSONRefreshesAndReplaysOn401(t *testing.T) {
	var refreshCalls, bizCalls int32
	var mu sync.Mutex
	seenAuth := map[string]int{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/plugin/auth/token/refresh":
			atomic.AddInt32(&refreshCalls, 1)
			if r.Header.Get("X-Refresh-Token") != "rt-old" {
				t.Errorf("refresh 未带 X-Refresh-Token: %q", r.Header.Get("X-Refresh-Token"))
			}
			w.Write([]byte(`{"code":0,"data":{"accessToken":"at-new","refreshToken":"rt-new","expiresIn":7200}}`))
		default:
			atomic.AddInt32(&bizCalls, 1)
			mu.Lock()
			seenAuth[r.Header.Get("Authorization")]++
			mu.Unlock()
			if r.Header.Get("Authorization") == "Bearer at-old" {
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte("<html>401 Authorization Required</html>"))
				return
			}
			w.Write([]byte(`{"code":0,"data":{"ok":true}}`))
		}
	}))
	defer srv.Close()

	a := &auth.Auth{AccessToken: "at-old", RefreshToken: "rt-old", UID: "u1", ExpiresAt: 9999999999}
	c := &Client{HTTP: srv.Client(), ChatBaseCN: srv.URL, BillingBaseCN: srv.URL}

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v2/billing/meter/get-user-resource", nil)
	c.BillingHeaders(req, a)
	if _, err := c.doJSON(req); err != nil {
		t.Fatalf("401 应自愈（refresh + 重放），got %v", err)
	}
	if got := atomic.LoadInt32(&refreshCalls); got != 1 {
		t.Errorf("refresh calls=%d want 1（单飞一次）", got)
	}
	if got := atomic.LoadInt32(&bizCalls); got != 2 {
		t.Errorf("业务调用=%d want 2（401 一次 + 重放一次）", got)
	}
	// 刷新后内存里的 token 必须已更新（后续请求直接用新值）。
	if got := a.AccessTokenValue(); got != "at-new" {
		t.Errorf("AccessToken=%q want at-new", got)
	}
}

// TestDoJSONRefreshFailureReturnsOriginal401 refresh 失败（非 12153）时把上游 401
// 原文交回，不吞成 500，也不重放。
func TestDoJSONRefreshFailureReturnsOriginal401(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/plugin/auth/token/refresh" {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"code":10001,"msg":"refreshToken is empty"}`))
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"code":401,"msg":"token expired"}`))
	}))
	defer srv.Close()

	a := &auth.Auth{AccessToken: "at-old", RefreshToken: "rt-old", UID: "u1"}
	c := &Client{HTTP: srv.Client(), ChatBaseCN: srv.URL, BillingBaseCN: srv.URL}
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v2/billing/meter/get-user-resource", nil)
	c.BillingHeaders(req, a)
	_, err := c.doJSON(req)
	if err == nil {
		t.Fatal("want error")
	}
	ue, ok := err.(*Error)
	if !ok {
		t.Fatalf("want *Error, got %T", err)
	}
	if ue.Status != http.StatusUnauthorized {
		t.Errorf("status=%d want 401（保留上游原文状态）", ue.Status)
	}
}

// TestRefreshCallNeverReplays 刷新端点自身返回 401（12153）时绝不能再触发刷新重放
// ——否则递归刷新会把 RT 链彻底消费掉（issue #215 的作废路径）。
func TestRefreshCallNeverReplays(t *testing.T) {
	var refreshCalls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/plugin/auth/token/refresh" {
			atomic.AddInt32(&refreshCalls, 1)
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"code":12153,"msg":"refresh token failed"}`))
			return
		}
		t.Errorf("unexpected path %s", r.URL.Path)
	}))
	defer srv.Close()

	a := &auth.Auth{AccessToken: "at", RefreshToken: "rt", UID: "u1"}
	c := &Client{HTTP: srv.Client(), ChatBaseCN: srv.URL}
	if err := c.RefreshToken(a); err == nil {
		t.Fatal("want error")
	}
	if got := atomic.LoadInt32(&refreshCalls); got != 1 {
		t.Errorf("refresh endpoint calls=%d want 1（禁止递归刷新）", got)
	}
}

// TestChatStreamReplaysAfterRefresh chat 路径同样自愈：401 → refresh → 重放拿到 200 流。
func TestChatStreamReplaysAfterRefresh(t *testing.T) {
	var refreshCalls, chatCalls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/plugin/auth/token/refresh" {
			atomic.AddInt32(&refreshCalls, 1)
			w.Write([]byte(`{"code":0,"data":{"accessToken":"at-new","refreshToken":"rt-new","expiresIn":7200}}`))
			return
		}
		atomic.AddInt32(&chatCalls, 1)
		if r.Header.Get("Authorization") == "Bearer at-old" {
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte("<html>401 Authorization Required</html>"))
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer srv.Close()

	a := &auth.Auth{AccessToken: "at-old", RefreshToken: "rt-old", UID: "u1", ExpiresAt: 9999999999}
	c := &Client{HTTP: srv.Client(), ChatHTTP: srv.Client(), ChatBaseCN: srv.URL, BillingBaseCN: srv.URL}
	rc, status, _, err := c.ChatStream(a, []byte(`{"model":"glm-5.2","messages":[]}`), "", ChatMeta{})
	if err != nil || status != 200 {
		t.Fatalf("chat 应自愈: status=%d err=%v", status, err)
	}
	if rc != nil {
		rc.Close()
	}
	if got := atomic.LoadInt32(&refreshCalls); got != 1 {
		t.Errorf("refresh calls=%d want 1", got)
	}
	if got := atomic.LoadInt32(&chatCalls); got != 2 {
		t.Errorf("chat calls=%d want 2（401 + 重放）", got)
	}
}

// TestReplaySecond401ClassifiedAsAuthExpired 刷新成功但重放仍 401：
// 交回 401 原文由 Classify 判定 → ErrAuthExpired（软冷却 + 连续计数达阈禁用）。
//
// 不在 replay 层直接断言"凭证已死"：刚签发的新 token 被拒也可能是账号级限制，
// 交回原文既能让面板看到上游措辞，又不会把偶发 401 直接升级成禁用。
func TestReplaySecond401ClassifiedAsAuthExpired(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/plugin/auth/token/refresh" {
			w.Write([]byte(`{"code":0,"data":{"accessToken":"at-new","refreshToken":"rt-new","expiresIn":7200}}`))
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte("<html><head><title>401 Authorization Required</title></head></html>"))
	}))
	defer srv.Close()

	a := &auth.Auth{AccessToken: "at-old", RefreshToken: "rt-old", UID: "u1"}
	c := &Client{HTTP: srv.Client(), ChatBaseCN: srv.URL, BillingBaseCN: srv.URL}
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v2/billing/meter/get-user-resource", nil)
	c.BillingHeaders(req, a)
	_, err := c.doJSON(req)
	ue, ok := err.(*Error)
	if !ok {
		t.Fatalf("want *Error, got %T (%v)", err, err)
	}
	if ue.Status != http.StatusUnauthorized {
		t.Errorf("status=%d want 401", ue.Status)
	}
	if ue.Kind != ErrAuthExpired {
		t.Errorf("kind=%v want ErrAuthExpired（401 无业务信封）", ue.Kind)
	}
}
