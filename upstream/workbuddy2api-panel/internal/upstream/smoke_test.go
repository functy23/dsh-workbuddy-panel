package upstream

// smoke_test.go 出站头族人工比对辅助：go test -run TestDumpOutboundHeaders -v
// 打印 chat / billing / refresh / web 四条路径的完整请求头，便于与真实抓包逐行比对。
// 默认跳过，只在显式指定 -run 时输出。

import (
	"fmt"
	"net/http"
	"sort"
	"testing"

	"github.com/linguo2625469/workbuddy2api-panel/internal/auth"
)

func TestDumpOutboundHeaders(t *testing.T) {
	if testing.Short() {
		t.Skip("dump helper")
	}
	c := &Client{}
	a := &auth.Auth{AccessToken: "AT", RefreshToken: "RT", UID: "uid-123", Domain: "www.workbuddy.cn"}
	ea := &auth.Auth{AccessToken: "AT", RefreshToken: "RT", UID: "uid-123", EnterpriseID: "ent-9", Domain: "www.workbuddy.cn"}

	dump := func(name string, req *http.Request) {
		keys := make([]string, 0, len(req.Header))
		for k := range req.Header {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		fmt.Printf("\n=== %s (%s %s)\n", name, req.Method, req.URL)
		for _, k := range keys {
			fmt.Printf("  %-32s %s\n", k+":", req.Header.Get(k))
		}
	}

	chat, _ := http.NewRequest(http.MethodPost, "https://www.workbuddy.cn/v2/chat/completions", nil)
	c.ChatHeaders(chat, a, "", ChatMeta{})
	dump("chat (personal)", chat)

	chatE, _ := http.NewRequest(http.MethodPost, "https://www.workbuddy.cn/v2/chat/completions", nil)
	c.ChatHeaders(chatE, ea, "", ChatMeta{})
	dump("chat (enterprise)", chatE)

	bill, _ := http.NewRequest(http.MethodPost, "https://www.workbuddy.cn/v2/billing/meter/daily-checkin", nil)
	c.BillingHeaders(bill, a)
	dump("billing/checkin", bill)

	ref, _ := http.NewRequest(http.MethodPost, "https://www.workbuddy.cn/v2/plugin/auth/token/refresh", nil)
	c.RefreshHeaders(ref, a)
	dump("refresh", ref)

	web, _ := http.NewRequest(http.MethodPost, "https://www.workbuddy.cn/activity/growth/tasks/x/claim", nil)
	c.WebHeaders(web, a, "/profile/growth-center")
	dump("web/claim", web)
}
