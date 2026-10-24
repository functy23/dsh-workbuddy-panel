package upstream

import (
	"net/http"
	"regexp"
	"testing"

	"github.com/linguo2625469/workbuddy2api-panel/internal/auth"
)

// TestChatHeadersAlwaysSendConversationTrio 回归 issue #190：国际端点收紧通道
// 校验后，缺 X-Conversation-ID 的聊天请求会 400 / 11128（conversation id
// missing）。即使调用方没给会话 ID（零值 ChatMeta），三元组也必须齐全，
// 且兜底 ID 是 32 位 hex。
func TestChatHeadersAlwaysSendConversationTrio(t *testing.T) {
	c := &Client{}
	req, err := http.NewRequest(http.MethodPost, "https://example.com/v2/chat/completions", nil)
	if err != nil {
		t.Fatal(err)
	}
	c.ChatHeaders(req, testAuth(), "", ChatMeta{})

	hex32 := regexp.MustCompile(`^[0-9a-f]{32}$`)
	// 官方桌面端（main/server.js applyGatewayHeaders）：
	//   X-Conversation-ID          = 会话 uuid
	//   X-Conversation-Message-ID  = randomUUID()
	//   X-Request-ID               = 另一个 randomUUID()
	//   X-Conversation-Request-ID  = 会话请求主键（本项目用 32 hex 透传/兜底，
	//                                官方 VlmSessionLedger 里同样是 uuid，但该值
	//                                只用于后台聚合，形状不构成客户端特征；
	//                                故保持既有 32 hex 以免破坏聚合口径）
	uuidV4 := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	for _, h := range []string{
		"X-Conversation-ID",
		"X-Conversation-Request-ID",
		"X-Conversation-Message-ID",
	} {
		v := req.Header.Get(h)
		if v == "" {
			t.Fatalf("%s missing (通道校验会拒绝缺少会话三元组的请求)", h)
		}
		want := hex32
		if h == "X-Conversation-ID" {
			want = uuidV4 // 会话 ID 用官方 UUID 形态，与消息 ID 形状区分
		}
		if !want.MatchString(v) {
			t.Errorf("%s = %q, want %v", h, v, want)
		}
	}

	// 兜底会话 ID 每次请求新生成（不是常量），且与 request/message ID 不冲突。
	req2, _ := http.NewRequest(http.MethodPost, "https://example.com/v2/chat/completions", nil)
	c.ChatHeaders(req2, testAuth(), "", ChatMeta{})
	if req.Header.Get("X-Conversation-ID") == req2.Header.Get("X-Conversation-ID") {
		t.Error("fallback X-Conversation-ID should be fresh per request")
	}
}

// TestChatHeadersPreservesConversationID 入站带来的会话 ID 优先透传，不被兜底覆盖。
func TestChatHeadersPreservesConversationID(t *testing.T) {
	c := &Client{}
	req, _ := http.NewRequest(http.MethodPost, "https://example.com/v2/chat/completions", nil)
	const conv = "0123456789abcdef0123456789abcdef"
	c.ChatHeaders(req, testAuth(), "", ChatMeta{ConversationID: conv})
	if got := req.Header.Get("X-Conversation-ID"); got != conv {
		t.Errorf("X-Conversation-ID = %q, want supplied %q", got, conv)
	}
}

// testAuth 返回最小的 CN 账号（ChatHeaders 会读 UID/凭证，nil 会解引用）。
func testAuth() *auth.Auth {
	return &auth.Auth{UID: "u1", AccessToken: "at"}
}
