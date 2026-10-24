package panel

import (
	"strings"
	"testing"
)

// TestLoginEndpoints realm→端点映射：global 三端点全在 workbuddy.ai 域，
// cn/空/非法值 → www.workbuddy.cn（官方 5.8.3 的 product.json endpoint）。
//
// 旧值 copilot.tencent.com / platform=CLI 是 CodeBuddy CLI 形态：同路径虽可用，
// 但签发出来的 token 与桌面端身份不一致，且 host 与出站业务请求对不上，
// 属于可关联的指纹差异。
func TestLoginEndpoints(t *testing.T) {
	cases := []struct {
		realm      string
		wantState  string
		wantOrigin string
		wantBase   string
	}{
		{"global", "https://www.workbuddy.ai/v2/plugin/auth/state?platform=workbuddy", "https://www.workbuddy.ai", "https://www.workbuddy.ai"},
		{"cn", "https://www.workbuddy.cn/v2/plugin/auth/state?platform=workbuddy", "https://www.workbuddy.cn", "https://www.workbuddy.cn"},
		{"", "https://www.workbuddy.cn/v2/plugin/auth/state?platform=workbuddy", "https://www.workbuddy.cn", "https://www.workbuddy.cn"},
		{"weird", "https://www.workbuddy.cn/v2/plugin/auth/state?platform=workbuddy", "https://www.workbuddy.cn", "https://www.workbuddy.cn"},
	}
	for _, c := range cases {
		t.Run(c.realm, func(t *testing.T) {
			st, tok, acct, origin := loginEndpoints(c.realm)
			if st != c.wantState {
				t.Errorf("realm=%q state=%q want %q", c.realm, st, c.wantState)
			}
			if origin != c.wantOrigin {
				t.Errorf("realm=%q origin=%q want %q", c.realm, origin, c.wantOrigin)
			}
			// token/account 端点必与 state 同 base。
			if !strings.HasPrefix(tok, c.wantBase) || !strings.HasPrefix(acct, c.wantBase) {
				t.Errorf("realm=%q token/account endpoints should share base %s: %q %q", c.realm, c.wantBase, tok, acct)
			}
		})
	}
}

// TestLoginClientUAMatchesOfficial 登录态请求的 UA 必须与出站业务 UA 同一形态
// （WorkBuddy/<ver> ... CLI/<cliVer>），不能用 CodeBuddy CLI 的 `CLI/x CodeBuddy/y`。
func TestLoginClientUAMatchesOfficial(t *testing.T) {
	if !strings.HasPrefix(clientUA, "WorkBuddy/") {
		t.Fatalf("clientUA=%q 应以 WorkBuddy/ 开头", clientUA)
	}
	if !strings.Contains(clientUA, " CLI/") {
		t.Errorf("clientUA=%q 应含 CLI/<ver> 段", clientUA)
	}
	if strings.Contains(clientUA, "CodeBuddy/") {
		t.Errorf("clientUA=%q 不应含 CodeBuddy/ 段（那是 CodeBuddy CLI 形态）", clientUA)
	}
}
