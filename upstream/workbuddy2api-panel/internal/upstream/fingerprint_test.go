// fingerprint_test.go 出站指纹整体回归：断言 chat 请求的完整头族与**官方分发包代码**
// 逐条对齐，并断言官方**不发**的头一条都不出现。
//
// 事实来源（可复算的代码，不是转述）：
//   - cli/dist/codebuddy-lite-wb.mjs 的 buildConversationHeaders() +
//     ProviderHttpHeaders + 身份拦截器 → **桌面端文本会话**的 chat 出站形态（默认）。
//   - app.asar/main/server.js 的 buildVlmGatewayHeaders() + applyGatewayHeaders() +
//     applyTraceHeaders() → **skills VLM 代理**（/skills/vlm/chat 转发）形态，
//     由 upstream.chat_fingerprint=vlm 显式开启，不是文本会话的默认。
//
// 两条链路的头族有硬差别（见 headers.go 的 chatFingerprint 注释）。把 VLM 那条
// 当成"桌面端唯一构造点"是常见误判：它只服务视觉技能转发，用它冒充文本会话反而
// 更像异常客户端。
//
// 这是本仓库最容易回归的一块：任何一次"顺手加个头"都会让上游看到非官方客户端。
// 故用白名单方式双向断言（必须有 / 必须没有 / 集合相等），而不是只挑几个头抽查。
package upstream

import (
	"net/http"
	"sort"
	"strings"
	"testing"

	"github.com/linguo2625469/workbuddy2api-panel/internal/auth"
)

// officialChatHeaders 文本会话（CLI 形态）chat 请求必发的头。
var officialChatHeaders = []string{
	"Accept",
	"Content-Type",
	"Authorization",
	"Accept-Encoding",
	"User-Agent",
	"X-Product",
	"X-User-Id",
	"X-Userinfo",
	"X-Auth-Method",
	"X-IDE-Type",
	"X-IDE-Name",
	"X-IDE-Version",
	"X-Agent-Intent",
	"X-Agent-Type",
	"X-Agent-Purpose",
	"X-Private-Data",
	"X-Domain",
	"X-CodeBuddy-Request",
	"X-Conversation-ID",
	"X-Conversation-Request-ID",
	"X-Conversation-Message-ID",
	"X-Request-ID",
	"X-Root-Request-ID",
	"traceparent",
	"b3",
	"X-B3-TraceId",
	"X-B3-SpanId",
	"X-B3-Sampled",
	"X-Trace-ID",
}

// forbiddenChatHeaders 文本会话 chat 请求**不发**的头。
//
// x-requested-with / acp-connection-id / X-B3-ParentSpanId 属于 main/server.js 的
// skills VLM 代理链路（见 chatFingerprintVLM），文本会话带上就是"另一条链路"的指纹。
var forbiddenChatHeaders = []string{
	"X-Requested-With",
	"Acp-Connection-Id",
	"X-B3-ParentSpanId",
	"X-Machine-ID", // 5.8.3 客户端不存在此头
	"X-Session-ID", // 同上
	"Origin",       // 主进程 API 请求无浏览器 Origin
	"Referer",
	"Accept-Language", // 同上（仅渲染进程 Web 端点）
	"X-No-Authorization",
	"X-No-User-Id",
	"X-No-Enterprise-Id",
	"X-No-Department-Info",
	"X-Refresh-Token", // 安全红线：只在 refresh 端点出现
	"X-Agent-Runtime", // 仅搜索端点
}

func newChatReq(t *testing.T, c *Client, a *auth.Auth, meta ChatMeta) *http.Request {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost,
		"https://www.workbuddy.cn/v2/chat/completions",
		strings.NewReader(`{"model":"glm-5.2","messages":[]}`))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	c.ChatHeaders(req, a, "", meta)
	return req
}

// TestChatHeadersMatchOfficialFingerprint 文本会话形态：双向白名单断言。
func TestChatHeadersMatchOfficialFingerprint(t *testing.T) {
	c := &Client{}
	a := &auth.Auth{AccessToken: "at", UID: "u1", Domain: "www.workbuddy.cn"}
	req := newChatReq(t, c, a, ChatMeta{})

	for _, h := range officialChatHeaders {
		if req.Header.Get(h) == "" {
			t.Errorf("缺少官方必发头 %s", h)
		}
	}
	for _, h := range forbiddenChatHeaders {
		if v := req.Header.Get(h); v != "" {
			t.Errorf("出现文本会话不发的头 %s=%q（VLM 链路/自造指纹）", h, v)
		}
	}
	// 关键取值。
	if got := req.Header.Get("X-Product"); got != "SaaS" {
		t.Errorf("X-Product=%q want SaaS（deploymentType，不是产品名）", got)
	}
	if got := req.Header.Get("X-IDE-Name"); got != "WorkBuddy" {
		t.Errorf("X-IDE-Name=%q want WorkBuddy", got)
	}
	if got := req.Header.Get("X-Agent-Intent"); got != "craft" {
		t.Errorf("X-Agent-Intent=%q want craft", got)
	}
	if got := req.Header.Get("X-Agent-Type"); got != "cli" {
		t.Errorf("X-Agent-Type=%q want cli", got)
	}
	if got := req.Header.Get("X-Agent-Purpose"); got != "person_agent" {
		t.Errorf("X-Agent-Purpose=%q want person_agent（个人会话）", got)
	}
	if got := req.Header.Get("X-Private-Data"); got != "false" {
		t.Errorf("X-Private-Data=%q want false（模型优化默认开启）", got)
	}
	if got := req.Header.Get("X-Auth-Method"); got != "plugin" {
		t.Errorf("X-Auth-Method=%q want plugin", got)
	}
	if got := req.Header.Get("X-CodeBuddy-Request"); got != "1" {
		t.Errorf("X-CodeBuddy-Request=%q want 1", got)
	}
	if got := req.Header.Get("Accept-Encoding"); got != "identity" {
		t.Errorf("Accept-Encoding=%q want identity", got)
	}
	if got := req.Header.Get("User-Agent"); got != defaultUAString {
		t.Errorf("User-Agent=%q want %q", got, defaultUAString)
	}
	if ui := req.Header.Get("X-Userinfo"); ui == "" || !strings.Contains(decodeBase64(t, ui), `"uin":"u1"`) {
		t.Errorf("X-Userinfo=%q 解码后应含 uin=u1", ui)
	}
	// X-Root-Request-ID 与 X-Conversation-Request-ID 同值（CLI 的轮级聚合主键）。
	if got, want := req.Header.Get("X-Root-Request-ID"), req.Header.Get("X-Conversation-Request-ID"); got != want {
		t.Errorf("X-Root-Request-ID=%q want %q（同轮聚合主键）", got, want)
	}
	// 链路族一致性。
	tp := req.Header.Get("traceparent")
	if !strings.HasPrefix(tp, "00-") || !strings.HasSuffix(tp, "-01") {
		t.Errorf("traceparent=%q 形态不符 W3C", tp)
	}
	trace := req.Header.Get("X-B3-TraceId")
	if req.Header.Get("X-Trace-ID") != trace {
		t.Errorf("X-Trace-ID 与 X-B3-TraceId 不一致")
	}
	if !strings.Contains(tp, trace) {
		t.Errorf("traceparent 未携带同一 traceId（%s vs %s）", tp, trace)
	}
	// b3 必须是三段（根 span，无 parent）。
	if parts := strings.Split(req.Header.Get("b3"), "-"); len(parts) != 3 || parts[2] != "1" {
		t.Errorf("b3=%q 应为三段 <trace>-<span>-1", req.Header.Get("b3"))
	}
}

// TestEnterpriseAccountUsesConversationPurpose 企业号：X-Agent-Purpose 取
// conversation（CLI 非个人身份分支），其余头族不变。
func TestEnterpriseAccountUsesConversationPurpose(t *testing.T) {
	c := &Client{}
	a := &auth.Auth{AccessToken: "at", UID: "u1", EnterpriseID: "e1", Domain: "www.workbuddy.cn"}
	req := newChatReq(t, c, a, ChatMeta{})
	if got := req.Header.Get("X-Agent-Purpose"); got != "conversation" {
		t.Errorf("X-Agent-Purpose=%q want conversation（企业号）", got)
	}
	if got := req.Header.Get("X-Enterprise-Id"); got != "e1" {
		t.Errorf("X-Enterprise-Id=%q want e1", got)
	}
	if got := req.Header.Get("X-Tenant-Id"); got != "e1" {
		t.Errorf("X-Tenant-Id=%q want e1", got)
	}
}

// TestChatFingerprintVLMProfile skills VLM 代理形态（upstream.chat_fingerprint=vlm）。
// 断言它与文本会话形态的硬差别，防止两条链路被混成一锅。
func TestChatFingerprintVLMProfile(t *testing.T) {
	c := &Client{ChatFingerprint: "vlm"}
	a := &auth.Auth{AccessToken: "at", UID: "u1", Domain: "www.workbuddy.cn"}
	meta := ChatMeta{ConversationID: "c1", ConversationRequestID: "r1"}
	req := newChatReq(t, c, a, meta)

	for _, h := range []string{"X-Requested-With", "Acp-Connection-Id", "X-B3-ParentSpanId"} {
		if req.Header.Get(h) == "" {
			t.Errorf("vlm 形态应带 %s", h)
		}
	}
	for _, h := range []string{"X-Agent-Type", "X-Userinfo", "X-Auth-Method", "X-Root-Request-ID"} {
		if v := req.Header.Get(h); v != "" {
			t.Errorf("vlm 形态不应带 %s=%q", h, v)
		}
	}
	if got := req.Header.Get("X-Agent-Purpose"); got != "conversation" {
		t.Errorf("X-Agent-Purpose=%q want conversation", got)
	}
	if got := req.Header.Get("X-Private-Data"); got != "true" {
		t.Errorf("X-Private-Data=%q want true", got)
	}
	if parts := strings.Split(req.Header.Get("b3"), "-"); len(parts) != 4 ||
		parts[3] != req.Header.Get("X-B3-ParentSpanId") {
		t.Errorf("b3=%q 应为四段且第四段等于 parent span %q",
			req.Header.Get("b3"), req.Header.Get("X-B3-ParentSpanId"))
	}
	// 同一会话两次请求 acp-connection-id 稳定。
	req2 := newChatReq(t, c, a, meta)
	if req.Header.Get("Acp-Connection-Id") != req2.Header.Get("Acp-Connection-Id") {
		t.Error("同一会话 acp-connection-id 应稳定")
	}
	if !isUUIDv4Shape(req.Header.Get("Acp-Connection-Id")) {
		t.Errorf("acp-connection-id=%q want UUID 形态", req.Header.Get("Acp-Connection-Id"))
	}
	// desktop 是 vlm 的兼容别名。
	if (&Client{ChatFingerprint: "desktop"}).chatFingerprint() != chatFingerprintVLM {
		t.Error("desktop 别名应映射到 vlm")
	}
	if (&Client{}).chatFingerprint() != chatFingerprintCLI {
		t.Error("默认应为 cli（桌面端文本会话）")
	}
}

// TestBillingHeadersMatchOfficialFingerprint billing/签到是**主进程**链路：
// 只带 Authorization + 用户/企业/租户/域 + X-Product + X-Request-ID + 链路族
// （报告 §1.3 抓样），**不带** CLI 的 X-IDE-* / X-Agent-* / X-Userinfo / X-Auth-Method。
func TestBillingHeadersMatchOfficialFingerprint(t *testing.T) {
	c := &Client{}
	a := &auth.Auth{AccessToken: "at", UID: "u1", Domain: "www.workbuddy.cn"}
	req, _ := http.NewRequest(http.MethodPost, "https://www.workbuddy.cn/v2/billing/meter/daily-checkin",
		strings.NewReader("{}"))
	c.BillingHeaders(req, a)

	for _, h := range []string{
		"Authorization", "X-User-Id", "X-Domain", "X-Product",
		"X-Request-ID", "X-Trace-ID", "traceparent", "b3", "User-Agent",
	} {
		if req.Header.Get(h) == "" {
			t.Errorf("billing 缺官方头 %s", h)
		}
	}
	for _, h := range []string{
		"X-Auth-Method", "X-Userinfo", // CLI 身份拦截器族
		"X-IDE-Type", "X-IDE-Name", "X-IDE-Version", // CLI 模型请求族
		"X-Agent-Intent", "X-Agent-Type", "X-Agent-Purpose", "X-Private-Data",
		"X-CodeBuddy-Request", // main 里只有 server.js/sidecar 有
		"Origin", "Referer", "X-Requested-With", "Accept-Language",
		"X-Machine-ID", "X-Session-ID", "X-Refresh-Token",
	} {
		if v := req.Header.Get(h); v != "" {
			t.Errorf("billing 出现主进程不发的头 %s=%q", h, v)
		}
	}
}

// TestHeaderSetIsExactlyOfficial 集合相等兜底：任何新增头都会让本用例失败。
func TestHeaderSetIsExactlyOfficial(t *testing.T) {
	c := &Client{}
	a := &auth.Auth{AccessToken: "at", UID: "u1", Domain: "www.workbuddy.cn"}
	req := newChatReq(t, c, a, ChatMeta{})

	got := make([]string, 0, len(req.Header))
	for k := range req.Header {
		got = append(got, http.CanonicalHeaderKey(k))
	}
	sort.Strings(got)
	want := make([]string, 0, len(officialChatHeaders))
	for _, h := range officialChatHeaders {
		want = append(want, http.CanonicalHeaderKey(h))
	}
	sort.Strings(want)
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("出站头集合与官方基线不一致\n got: %v\nwant: %v", got, want)
	}
}

// isUUIDv4Shape 判断是否 8-4-4-4-12 的 UUID 形态（不校验版本位，够用于形状断言）。
func isUUIDv4Shape(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, ch := range s {
		switch i {
		case 8, 13, 18, 23:
			if ch != '-' {
				return false
			}
		default:
			if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f')) {
				return false
			}
		}
	}
	return true
}

// decodeBase64 解 base64（测试辅助，失败即 Fatal）。
func decodeBase64(t *testing.T, s string) string {
	t.Helper()
	raw, err := base64StdDecode(s)
	if err != nil {
		t.Fatalf("base64 decode %q: %v", s, err)
	}
	return raw
}
