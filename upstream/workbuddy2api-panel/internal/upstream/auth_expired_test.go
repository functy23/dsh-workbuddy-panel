// auth_expired_test.go 401 凭证失效的分类与处置（issue #243）。
package upstream

import (
	"net/http"
	"testing"
)

// TestClassify401NoEnvelopeIsAuthExpired 401 + 无业务信封（APISIX 网关页/空体）
// → ErrAuthExpired。这条分类是 issue #243（面板反复报
// `upstream client (http 401)` 且账号状态乱跳）的根因修复之一：
// 此前它落 ErrClient（只换号不罚），死凭证永远留在池里反复撞 401。
func TestClassify401NoEnvelopeIsAuthExpired(t *testing.T) {
	cases := []string{
		"<html><head><title>401 Authorization Required</title></head></html>",
		"",
		"Authorization Required",
	}
	for _, body := range cases {
		if got := Classify(http.StatusUnauthorized, body); got != ErrAuthExpired {
			t.Errorf("body=%q kind=%v want ErrAuthExpired", body, got)
		}
	}
}

// TestClassify401WithEnvelopeStaysBusiness 401 + 业务信封（12153 等）仍走原分类：
// 信封形态是上游业务层答复，比"网关页"更具体，不能一概归 auth_expired。
func TestClassify401WithEnvelopeStaysBusiness(t *testing.T) {
	if got := Classify(http.StatusUnauthorized, `{"code":12153,"msg":"Offline user session not found"}`); got != ErrSessionDead {
		t.Errorf("kind=%v want ErrSessionDead", got)
	}
	if got := Classify(http.StatusUnauthorized, `{"code":401,"msg":"token expired"}`); got == ErrAuthExpired {
		t.Error("带信封的 401 不应被归为 auth_expired（信封更具体）")
	}
}

// TestAuthExpiredHintIsActionable 该分类必须给出可操作提示（重登），而不是空 hint。
func TestAuthExpiredHintIsActionable(t *testing.T) {
	hint := GatewayHint(ErrAuthExpired, "", HintContext{})
	if hint == "" {
		t.Fatal("ErrAuthExpired 必须有 gateway_hint")
	}
	if !containsFold(hint, "re-login") {
		t.Errorf("hint=%q 应指向重新登录", hint)
	}
}

// containsFold 大小写不敏感子串（避免额外 import strings 影响其他用例风格）。
func containsFold(s, sub string) bool {
	if len(sub) == 0 {
		return true
	}
	for i := 0; i+len(sub) <= len(s); i++ {
		if equalFold(s[i:i+len(sub)], sub) {
			return true
		}
	}
	return false
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		x, y := a[i], b[i]
		if 'A' <= x && x <= 'Z' {
			x += 'a' - 'A'
		}
		if 'A' <= y && y <= 'Z' {
			y += 'a' - 'A'
		}
		if x != y {
			return false
		}
	}
	return true
}
