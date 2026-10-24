// cache_key.go 注入上游 prompt_cache_key 字段（P0 费用优化）。
//
// 逆向实测（buddy-adapter.ts:706-714）：上游服务端支持 prompt_cache_key，
// 同一段 8k token 前缀：
//   - 不带 → prompt_cache_hit_tokens=0, credit≈0.34
//   - 带   → prompt_cache_hit_tokens=7808, credit≈0.02（费用降 ~17×）
//
// 网关在此为每个出站 chat 请求注入一个稳定、按账号隔离的 cache key，
// 让同一客户端对同一账号的连续请求复用上游前缀缓存。
//
// 指纹纪律（重要）：键值必须是**无语义的 32 位 hex**。
// 早期实现用 `wb2a-<uid8>-<hash>`，等于在每个请求体里盖一个"workbuddy2api"品牌戳
// ——这是比任何请求头都直白的网关指纹（body 里出现非官方字段本身就是异常，字段值
// 还写着网关名字）。官方客户端不发该字段，但若上游做 body 结构比对，一个纯 hex
// 的 cache key 与"客户端自算缓存键"无法区分，而品牌前缀一眼可辨。
package upstream

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
)

// InjectPromptCacheKey 在已改写的出站 body 上注入 prompt_cache_key 字段。
//
// 优先级：
//  1. body 已带 prompt_cache_key → 原值保留（客户端自知复用哪个键）
//  2. body 已带 conversation_id / conversationId → 用它做会话哈希源
//  3. 都没有 → 用入站 conversationID 参数（来自 X-Conversation-ID 头解析）
//
// 安全约束——按账号隔离：
//   - uid 参与哈希，跨账号缓存键绝不碰撞
//   - 跨账号复用同一 cache key 会让上游命中错账号的前缀缓存、泄露对方对话，
//     故 uid 是硬隔离因子
//   - 键值不出现 uid 明文（早期实现把 uid 前 8 字符直接拼进键里）
//
// 入参 uid 为账号 UID（空则用 "-"，但仍会注入键；调用方应保证传真实 UID）。
// 入参 conversationID 为网关解析出的会话标识（body 里没有 conversation_id 时用它做哈希源）。
// 两源都空时 convHex 为定值（每次新会话不复用前缀，但仍保留账号隔离段）。
// body 不可解析时原样返回（与 prepareBody 语义一致：坏 body 不二次错误化）。
func InjectPromptCacheKey(body []byte, uid, conversationID string) []byte {
	if len(body) == 0 {
		return body
	}
	var obj map[string]any
	if err := json.Unmarshal(body, &obj); err != nil {
		return body
	}
	// 优先级 1：客户端已显式带 key → 绝不覆盖。
	if existing, ok := obj["prompt_cache_key"].(string); ok && existing != "" {
		return body
	}
	// 优先级 2：body 里的 conversation_id / conversationId 做会话哈希源。
	conv := conversationID
	if v := strField(obj, "conversation_id"); v != "" {
		conv = v
	} else if v := strField(obj, "conversationId"); v != "" {
		conv = v
	}
	obj["prompt_cache_key"] = buildCacheKey(uid, conv)
	out, err := json.Marshal(obj)
	if err != nil {
		return body
	}
	return out
}

// buildCacheKey 生成 32 位 hex 的稳定 cache key（sha256(uid|conversation) 前 16 字节）。
//
// 为什么是纯 hex：
//   - 与官方/第三方客户端的自算缓存键形态一致（无品牌、无 uid 明文）；
//   - 同账号同会话稳定、不同会话不同、跨账号绝不碰撞；
//   - 空会话时仍由 uid 单独哈希，保证跨账号隔离但同一空会话不复用。
func buildCacheKey(uid, conversation string) string {
	if uid == "" {
		uid = "-"
	}
	sum := sha256.Sum256([]byte("pck|" + uid + "|" + conversation))
	return hex.EncodeToString(sum[:16])
}

// strField 从 map 取 string 字段，非 string 或空串返回 ""。
func strField(obj map[string]any, key string) string {
	v, ok := obj[key].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(v)
}
