package upstream

import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"
)

// extractCacheKey 从改写后的 body 里取出 prompt_cache_key 字段值。
func extractCacheKey(t *testing.T, body []byte) string {
	t.Helper()
	var obj map[string]any
	if err := json.Unmarshal(body, &obj); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	v, _ := obj["prompt_cache_key"].(string)
	return v
}

// hexKey 网关自算 cache key 的唯一合法形态：32 位小写 hex。
//
// 为什么不允许品牌/uid 前缀：body 里出现 `wb2a-<uid8>-` 这样的值，等于在**每个
// 请求体**上盖一个"workbuddy2api + 账号 uid 前 8 位"的戳——比任何请求头都直白的
// 网关指纹，且直接把账号标识泄给上游。官方客户端不发该字段，但纯 hex 与"客户端
// 自算缓存键"无法区分。
var hexKey = regexp.MustCompile(`^[0-9a-f]{32}$`)

// TestInjectPromptCacheKey_PreservesExisting 入站 body 已带 prompt_cache_key
// → 原值保留，不被网关覆盖。
func TestInjectPromptCacheKey_PreservesExisting(t *testing.T) {
	uid := "user-abc-123"
	conv := "conv-xyz"
	in := `{"model":"glm-5.2","messages":[],"prompt_cache_key":"client-set-key"}`

	out := InjectPromptCacheKey([]byte(in), uid, conv)

	if got := extractCacheKey(t, out); got != "client-set-key" {
		t.Fatalf("existing prompt_cache_key overwritten: got=%q want client-set-key", got)
	}
}

// TestInjectPromptCacheKey_UsesConversationID body 无 prompt_cache_key 但有
// conversation_id → 用它做会话哈希源（同 id 同 key、不同 id 不同 key）。
func TestInjectPromptCacheKey_UsesConversationID(t *testing.T) {
	uid := "user-abc-123"
	in := `{"model":"glm-5.2","messages":[],"conversation_id":"conv-42"}`

	out := InjectPromptCacheKey([]byte(in), uid, "")
	got := extractCacheKey(t, out)
	if !hexKey.MatchString(got) {
		t.Fatalf("cache key 必须是 32 位 hex（不得含品牌/uid 前缀），got=%q", got)
	}
	if strings.Contains(got, "wb2a") || strings.Contains(got, "user-abc") {
		t.Fatalf("cache key 不得泄露网关品牌或 uid：%q", got)
	}
	// 同 conversation_id 两次出站 → 同 key（稳定）。
	out2 := InjectPromptCacheKey([]byte(in), uid, "")
	if got2 := extractCacheKey(t, out2); got2 != got {
		t.Fatalf("non-deterministic key for same conversation_id: %q vs %q", got, got2)
	}
	// 不同 conversation_id → 不同 key（哈希段区分）。
	inB := `{"model":"glm-5.2","messages":[],"conversation_id":"conv-99"}`
	gotB := extractCacheKey(t, InjectPromptCacheKey([]byte(inB), uid, ""))
	if gotB == got {
		t.Fatalf("different conversation_id produced same key: %q", got)
	}
}

// TestInjectPromptCacheKey_GeneratesStableKey body 两者都无 → 网关生成稳定键，
// 两次同输入同账号得到同 key。
func TestInjectPromptCacheKey_GeneratesStableKey(t *testing.T) {
	uid := "user-abc-123"
	conv := "conv-stable"
	in := `{"model":"glm-5.2","messages":[]}`

	a := InjectPromptCacheKey([]byte(in), uid, conv)
	b := InjectPromptCacheKey([]byte(in), uid, conv)
	ka, kb := extractCacheKey(t, a), extractCacheKey(t, b)
	if ka != kb {
		t.Fatalf("non-deterministic key for same input+uid: a=%q b=%q", ka, kb)
	}
}

// TestInjectPromptCacheKey_AccountIsolation 不同账号 → key 不同（隔离验证）：
// 跨账号复用同一 cache key 会让上游命中错账号的前缀缓存、泄露对方对话。
func TestInjectPromptCacheKey_AccountIsolation(t *testing.T) {
	conv := "conv-shared"
	in := `{"model":"glm-5.2","messages":[]}`

	ka := extractCacheKey(t, InjectPromptCacheKey([]byte(in), "user-aaa-111", conv))
	kb := extractCacheKey(t, InjectPromptCacheKey([]byte(in), "user-bbb-222", conv))
	if ka == kb {
		t.Fatalf("cross-account key collision: both=%q", ka)
	}
	for _, k := range []string{ka, kb} {
		if !hexKey.MatchString(k) {
			t.Fatalf("cache key 必须是 32 位 hex：%q", k)
		}
	}
}

// TestInjectPromptCacheKey_Format 形态校验：32 位 hex，且不出现 uid 明文。
func TestInjectPromptCacheKey_Format(t *testing.T) {
	uid := "1234567890abcdef"
	in := `{"model":"glm-5.2","messages":[]}`
	got := extractCacheKey(t, InjectPromptCacheKey([]byte(in), uid, "conv-fmt"))
	if !hexKey.MatchString(got) {
		t.Fatalf("expected 32 hex, got=%q", got)
	}
	if strings.Contains(got, "12345678") {
		t.Fatalf("cache key 不得包含 uid 明文：%q", got)
	}
}

// TestInjectPromptCacheKey_EmptyConversation 无 conversation_id 且无会话标识 →
// 仍生成非空键（由 uid 单独哈希，跨账号隔离但不复用）。
func TestInjectPromptCacheKey_EmptyConversation(t *testing.T) {
	uid := "user-abc-123"
	in := `{"model":"glm-5.2","messages":[]}`
	got := extractCacheKey(t, InjectPromptCacheKey([]byte(in), uid, ""))
	if got == "" {
		t.Fatalf("expected non-empty key when no conversation, got empty")
	}
	if !hexKey.MatchString(got) {
		t.Fatalf("expected 32 hex, got=%q", got)
	}
}

// TestPrepareBodyOptNoCacheKeyInjection PrepareBodyOpt（sanitize=false 的旧入口）
// 行为不变——不注入 cache key。
func TestPrepareBodyOptNoCacheKeyInjection(t *testing.T) {
	in := `{"model":"glm-5.2","messages":[]}`
	out := PrepareBodyOpt([]byte(in), false)
	var obj map[string]any
	if err := json.Unmarshal(out, &obj); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, present := obj["prompt_cache_key"]; present {
		t.Fatalf("PrepareBodyOpt must NOT inject prompt_cache_key, but got: %v", obj["prompt_cache_key"])
	}
}
