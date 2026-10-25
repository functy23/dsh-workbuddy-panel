// headers.go 构造上游请求头（common / chat / billing / refresh / web）。
//
// 唯一事实来源是**分发包代码**，而分发包里有**两条**都会打到
// /v2/chat/completions 的链路，头族不同，必须分开建模（见 chatFingerprint 常量）：
//
//  1. 文本会话（默认）—— cli/dist/codebuddy-lite-wb.mjs 的 ModelProvider：
//     buildConversationHeaders() + ProviderHttpHeaders + 身份拦截器。
//     X-Agent-Intent: craft / X-Agent-Type: cli / X-Agent-Purpose: person_agent
//     X-Private-Data: false（模型优化默认开启）/ X-Userinfo / X-Auth-Method: plugin
//     X-Conversation-*（message = request = 32hex）/ X-Root-Request-ID = 轮级主键
//     traceparent + b3 <trace>-<span>-1（OTel 根 span，三段、无 parent）
//
//  2. skills VLM 代理 —— main/server.js 的 VlmProxy / VlmUpstream.send()：
//     buildVlmGatewayHeaders() + applyGatewayHeaders() + applyTraceHeaders()。
//     仅服务本地 /skills/vlm/chat 的视觉技能转发：
//     x-requested-with / acp-connection-id / X-Agent-Purpose: conversation /
//     X-Private-Data: true / b3 四段 + X-B3-ParentSpanId / 无 X-Agent-Type 等。
//     由 upstream.chat_fingerprint=vlm 显式开启（"desktop" 为兼容别名）。
//
// 两条链路的共同点：X-Product=SaaS（deploymentType）、X-IDE-* 三段式 UA、
// Accept-Encoding: identity、Authorization: Bearer。
//
// 原则：**逐头对齐**——官方不发的一律不发（X-Machine-ID / X-Session-ID /
// X-Requested-With / 公共层 Origin·Referer·Accept-Language 同属此列），
// 官方必发的一条不缺。头族基线由 fingerprint_test.go 双向断言。
package upstream

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/linguo2625469/workbuddy2api-panel/internal/auth"
	"github.com/linguo2625469/workbuddy2api-panel/internal/session"
)

const (
	// defaultClientVersion 出站 WorkBuddy 客户端版本段（UA 的 `WorkBuddy/<ver>` 与
	// X-IDE-Version）。对齐官方 WorkBuddy Desktop **5.9.2** 分发包（asar package.json
	// version=5.9.2，Electron 37.10.3 / Chrome 138.0.7204.251）。
	// config upstream.client_version 可覆盖。
	defaultClientVersion = "5.9.2"
	// defaultCliVersion 出站 UA 中 `CLI/<ver>` 段版本。对齐官方 5.9.2 内置 CLI
	// （app.asar.unpacked/cli/package.json version=2.165.0）。
	// config upstream.cli_version 可覆盖。
	defaultCliVersion = "2.165.0"

	// ideName 官方 X-IDE-Type / X-IDE-Name 固定值（产品名，不是部署类型）。
	ideName = "WorkBuddy"
	// deploymentTypeSaaS 官方 X-Product 取值（product.json deploymentType）。
	deploymentTypeSaaS = "SaaS"
	// authMethodPlugin 官方 X-Auth-Method 取值（plugin OAuth 通道）。
	authMethodPlugin = "plugin"

	// agentIntentCraft 官方 X-Agent-Intent 默认值（ask / craft）。
	agentIntentCraft = "craft"
	// agentTypeMain 官方 X-Agent-Type 的默认取值。
	//
	// 5.9.2 的取值域只有 resolveModelCallAgentType 的
	// main / team / subagent / compaction / auxiliary —— "cli" 是**遥测里的 agentName**，
	// 不是这个头的取值（旧实现把两者混为一谈）。
	agentTypeMain = "main"
	// agentRuntimeOther 官方 X-Agent-Runtime 的默认取值。
	//
	// resolveSessionAgentRuntime = meta["codebuddy.ai/agentRuntime"] ??
	// process.env.CODEBUDDY_AGENT_RUNTIME ?? "other"，且构造点**无条件写入**该头。
	// 桌面端文本会话不设这两个来源，故实际恒为 "other"。
	agentRuntimeOther = "other"
	// agentPurposePersonal 个人身份会话的 X-Agent-Purpose（CLI 在 PERSONAL_AGENT_ROLE
	// 下写死 person_agent）。
	//
	// 注意：该分支存在但**桌面端从不打开**——PERSONAL_AGENT_ROLE 在全包只有读取点、
	// 没有任何赋值点（环境是 module 69525 的 process.env Proxy，只能由启动环境外部注入）。
	// 故默认形态按实际观测发 agentPurposeGeneral；本常量仅作语义标注，不参与出站。
	agentPurposePersonal = "person_agent"
	// agentPurposeGeneral 非 PERSONAL_AGENT_ROLE 会话的 X-Agent-Purpose（VLM 代理链路也用它）。
	agentPurposeGeneral = "conversation"

	originRefererCN     = "https://www.codebuddy.cn"
	originRefererGlobal = "https://www.workbuddy.ai"
)

// originRefererFor 按账号 realm 返回 Origin/Referer 基础域。
// 仅 Web 形态端点（x-client-platform: web）使用——官方桌面端主进程/CLI 的 API
// 请求不带 Origin/Referer（Node fetch 不产生浏览器头），带上反而暴露非官方身份。
func originRefererFor(a *auth.Auth) string {
	if a != nil && a.IsGlobal() {
		return originRefererGlobal
	}
	return originRefererCN
}

// clientVersion 生效的 WorkBuddy 客户端版本：Client.ClientVersion 非空则取之。
func (c *Client) clientVersion() string {
	if c != nil && c.ClientVersion != "" {
		return c.ClientVersion
	}
	return defaultClientVersion
}

// cliVersion 生效的 CLI 版本：Client.CliVersion 非空则取之。
func (c *Client) cliVersion() string {
	if c != nil && c.CliVersion != "" {
		return c.CliVersion
	}
	return defaultCliVersion
}

// defaultWorkBuddyUAFor 组装官方客户端出站 UA（三段式）：
// `WorkBuddy/<ver> <platform>/<ver> CLI/<cliVer>`。
//
// 平台段取值以**分发包代码**为准，而不是按 realm 猜：
//   - 5.8.3（com.tencent.workbuddy.mac）与 5.8.4（com.workbuddy.workbuddy-ai，
//     即 WorkBuddy AI 海外版）的 main/server.js 里，buildVlmGatewayHeaders()
//     都把平台段硬编码成 "WorkBuddy"：
//     `n['User-Agent']=['WorkBuddy/'+r,'WorkBuddy/'+r,...(i?['CLI/'+i]:[])].join(' ')`
//     —— 海外版连 bundleId/显示名都改了，UA 段也没改。
//   - 旧实现按 realm 在海外账号上发 "WorkBuddy AI"（源于 5.5.2 intl 包的观察），
//     与当前 5.8.x 分发包不一致，属可被上游识别的偏差。
//
// 若某天上游对平台段另有要求，用 upstream.ua_client_name 覆盖即可（不必改码）。
// 官方无任何 UA 随机化，故默认确定性。
func (c *Client) defaultWorkBuddyUAFor(a *auth.Auth) string {
	_ = a // 平台段不再按 realm 分叉，保留参数以兼容既有调用点
	return "WorkBuddy/" + c.clientVersion() + " " + c.uaClientName() + "/" + c.clientVersion() + " CLI/" + c.cliVersion()
}

// uaClientName UA 第二段（客户端产品名）：默认官方硬编码值 "WorkBuddy"，
// upstream.ua_client_name 可覆盖（逃生门，仅排障用）。
func (c *Client) uaClientName() string {
	if c != nil && c.UAClientName != "" {
		return c.UAClientName
	}
	return ideName
}

// defaultWorkBuddyUA 返回 CN 形态的默认 UA。
func (c *Client) defaultWorkBuddyUA() string {
	return c.defaultWorkBuddyUAFor(nil)
}

// userAgent 返回当前出站 UA（chat/refresh/billing/FetchModels 全路径一致）。
// 优先级：Client.UserAgent（config user_agent）显式覆盖 > 按账号 realm 的官方三段式。
// 全路径同一 UA 是刻意的：官方客户端只有一个 UA，分路径发不同 UA 会形成
// "同账号同 IP 同时存在两种客户端" 的关联特征。
func (c *Client) userAgent(a *auth.Auth) string {
	if c != nil && c.UserAgent != "" {
		return c.UserAgent
	}
	return c.defaultWorkBuddyUAFor(a)
}

// billingUA billing/checkin 域出站 UA：与 chat 同一条官方 UA。
// 显式 client_name="SaaS" 时返回空串（还原"不设 UA"的旧行为，仅供排障对比）。
func (c *Client) billingUA(a *auth.Auth) string {
	if c == nil || c.attributionClientName() == deploymentTypeSaaS {
		return ""
	}
	return c.userAgent(a)
}

// resolveDeviceToken 解析本次请求的 X-Device-Token 取值。
// 优先级：auth.Auth.DeviceToken（每号）> Client.DeviceToken（config 全局）> 文件兜底。
// 三者皆空/读失败则返回空串（调用方不注入该头，优雅降级）。
func (c *Client) resolveDeviceToken(a *auth.Auth) string {
	if a != nil && a.DeviceToken != "" {
		return a.DeviceToken
	}
	if c != nil && c.DeviceToken != "" {
		return c.DeviceToken
	}
	if c != nil && c.DeviceTokenFile != "" {
		return readDeviceTokenFile(c.DeviceTokenFile)
	}
	return ""
}

// injectDeviceToken 在 req 注入 X-Device-Token 头（仅当取到非空 token）。
func (c *Client) injectDeviceToken(req *http.Request, a *auth.Auth) {
	if tok := c.resolveDeviceToken(a); tok != "" {
		req.Header.Set("X-Device-Token", tok)
	}
}

// authCtxKey 把本次请求的账号放进 context，供传输层在 401 时自动 refresh 重放。
// 官方客户端 401 会刷新并重放一次；网关若只换号不刷新，token 过期即永久 401
// （issue #243 的根因）。
type authCtxKey struct{}

// attachAuth 把账号绑定到请求（原地改写：WithContext 返回浅拷贝，赋值回原对象
// 才能让调用方持有的 *http.Request 携带该 context）。
func attachAuth(req *http.Request, a *auth.Auth) {
	if req == nil || a == nil {
		return
	}
	*req = *req.WithContext(context.WithValue(req.Context(), authCtxKey{}, a))
}

// authFromReq 取回请求绑定的账号（未绑定返回 nil）。
func authFromReq(req *http.Request) *auth.Auth {
	if req == nil {
		return nil
	}
	a, _ := req.Context().Value(authCtxKey{}).(*auth.Auth)
	return a
}

// newUUIDv4 生成官方会话 ID 形态的 UUID v4（带连字符，如
// 01e98513-186a-4656-9565-17dbae2135e3——报告 §4.1 的 X-Conversation-ID）。
// 官方会话 ID 是 UUID，而 request/message ID 是 32 hex 去横线形态，两者形状不同；
// 兜底时混用会让「会话 ID」看起来像「消息 ID」，是一眼可辨的伪造特征。
func newUUIDv4() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		raw := session.NewMessageID()
		return raw[0:8] + "-" + raw[8:12] + "-" + raw[12:16] + "-" + raw[16:20] + "-" + raw[20:32]
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant RFC 4122
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

// randomHex 生成 n 字节随机数的 hex 串（熵源故障时用 session.NewMessageID 兜底，
// 保证恒为合法 hex、不 panic）。
func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		full := session.NewMessageID()
		if n*2 <= len(full) {
			return full[:n*2]
		}
		return full
	}
	return hex.EncodeToString(b)
}

// injectIdentity 注入**主进程**身份头族（Authorization + 用户/企业/租户/域）。
//
// 证据：报告 §1.3 的签到抓样只有这五条；main/*.js 里 X-Userinfo / X-Auth-Method
// 出现 0 次（那两条是 CLI 的 runIdentityHeaders）。所以这里不注入 CLI 独有的两头，
// 需要它们的路径显式调 injectCLIIdentity（chat / search / refresh）。
func (c *Client) injectIdentity(req *http.Request, a *auth.Auth) {
	if a == nil {
		return
	}
	if at := a.AccessTokenValue(); at != "" {
		req.Header.Set("Authorization", "Bearer "+at)
	}
	if a.UID != "" {
		req.Header.Set("X-User-Id", a.UID)
	}
	if a.EnterpriseID != "" {
		req.Header.Set("X-Enterprise-Id", a.EnterpriseID)
		req.Header.Set("X-Tenant-Id", a.EnterpriseID)
	}
	// X-Domain：官方取 auth.domain，缺省回落 endpoint 主机名（enterpriseHeaders()）。
	// 绝不能缺——它是后台区分租户/域的核心声明。
	if d := a.DomainValue(); d != "" {
		req.Header.Set("X-Domain", strings.TrimPrefix(strings.TrimPrefix(d, "https://"), "http://"))
	} else if req.URL != nil && req.URL.Host != "" {
		req.Header.Set("X-Domain", req.URL.Host)
	}
}

// userinfoHeader 构造官方 X-Userinfo：base64(JSON({uin,owner_uin,id_source,token_source}))。
// 官方只在 uid 非空且（有企业 / 有 idSource / 有 method）时发送；本项目恒有
// token_source=plugin，故 uid 非空即发。字段顺序与官方一致（uin → owner_uin →
// id_source → token_source），便于抓包比对。
//
// id_source 是 5.9.2 的 runIdentityHeaders() 在 account.idSource 非空时**必带**的键，
// 旧实现漏了它（载荷比官方少一段，属可辨差异）。
func userinfoHeader(a *auth.Auth) string {
	if a == nil || a.UID == "" {
		return ""
	}
	payload := map[string]string{"uin": a.UID}
	if a.EnterpriseID != "" {
		payload["owner_uin"] = a.EnterpriseID
	}
	payload["token_source"] = authMethodPlugin
	// map 的 JSON 键会排序（owner_uin < token_source < uin），与官方插入顺序不同。
	// 官方字段顺序无关紧要（base64 后是 opaque 串），但保持稳定形状便于比对：
	// 手工拼 JSON 以固定 uin 在首位。
	var b strings.Builder
	b.WriteString(`{"uin":`)
	b.Write(mustJSONString(a.UID))
	if a.EnterpriseID != "" {
		b.WriteString(`,"owner_uin":`)
		b.Write(mustJSONString(a.EnterpriseID))
	}
	if a.IDSource != "" {
		b.WriteString(`,"id_source":`)
		b.Write(mustJSONString(a.IDSource))
	}
	b.WriteString(`,"token_source":"`)
	b.WriteString(authMethodPlugin)
	b.WriteString(`"}`)
	return base64.StdEncoding.EncodeToString([]byte(b.String()))
}

// mustJSONString 返回 JSON 字符串字面量（含引号）；编码失败时返回 """"。
func mustJSONString(s string) []byte {
	raw, err := json.Marshal(s)
	if err != nil {
		return []byte(`""`)
	}
	return raw
}

// injectProduct 注入 X-Product（deploymentType，恒 "SaaS"，**不是**产品名）。
//
// 这是唯一一条**所有**出站请求都带的归属头：主进程 account.js 的签到/余额抓包
// （报告 §1.3）只有它，没有 X-IDE-* / X-Agent-*（那两个属于 CLI 的模型请求）。
func (c *Client) injectProduct(req *http.Request) {
	req.Header.Set("X-Product", deploymentTypeSaaS)
}

// injectIDEFamily 注入 X-IDE-Type/Name/Version（CLI 模型请求族）。
//
// 证据：main/*.js 里除 server.js 的 VLM 构造点外，X-IDE-Type 一次都不出现；
// cli/dist 的 ProviderHttpHeaders 则必发三头。故只在 chat/search 路径注入——
// billing/签到/上报带它就是"把 CLI 头族混进主进程请求"。
// ClientName 显式配 "SaaS" 时整族不发（旧行为逃生门，仅供排障对比）。
func (c *Client) injectIDEFamily(req *http.Request) {
	name := c.attributionClientName()
	if name == deploymentTypeSaaS {
		return
	}
	req.Header.Set("X-IDE-Type", name)
	req.Header.Set("X-IDE-Name", name)
	req.Header.Set("X-IDE-Version", c.clientVersion())
}

// injectModelAttribution 注入只在**模型请求**上出现的官方指纹头：
// X-Agent-Purpose 与 X-Private-Data（取值按 CLI 文本会话形态）。
//
// 取值证据（cli/dist/codebuddy-lite-wb.mjs，5.9.2）：
//
//	PERSONAL_AGENT_ROLE ? "person_agent" : <会话 purpose>
//	    → 分支存在，但 PERSONAL_AGENT_ROLE 在桌面端**无任何赋值点**（环境是
//	      process.env Proxy，只有外部启动环境能注入）→ 实际恒发会话 purpose。
//	A = resolveModelOptimizationEnabled({explicitEnabled, productDefaultEnabled, isEnterpriseEdition})
//	  = explicitEnabled ?? (!isEnterpriseEdition && (productDefaultEnabled ?? true))
//	X-Private-Data = A ? "false" : "true"
//	    → 个人号默认 false；企业号 true；custom 模型/skip-merge 场景删头。
//
// 注意：main/server.js 的 applyGatewayHeaders 写死 conversation/true，那是
// **skills VLM 代理**链路的取值（见 chatFingerprintVLM），不是文本会话的。
func (c *Client) injectModelAttribution(req *http.Request, a *auth.Auth) {
	// X-Agent-Purpose：桌面端从不设置 PERSONAL_AGENT_ROLE（全包只有读取点），
	// 故实际恒发会话 purpose（文本会话 = "conversation"）。
	req.Header.Set("X-Agent-Purpose", agentPurposeGeneral)
	// X-Private-Data 由 resolveModelOptimizationEnabled 决定（cli/dist 模型 provider）：
	//   A = explicitEnabled ?? (!isEnterpriseEdition && (productDefaultEnabled ?? true))
	//   头值 = A ? "false" : "true"
	// 即：个人号默认发 "false"（用我的数据优化模型 = 开），企业号发 "true"。
	// 旧实现恒 "false"——个人号对、企业号错。
	if a != nil && a.IsEnterprise() {
		req.Header.Set("X-Private-Data", "true")
	} else {
		req.Header.Set("X-Private-Data", "false")
	}
}

// injectClientIP 在 PassthroughIP 开启时把 clientIP 参数透传给上游（三等价头）。
func (c *Client) injectClientIP(req *http.Request, clientIP string) {
	if c == nil || !c.PassthroughIP || clientIP == "" {
		return
	}
	req.Header.Set("X-Forwarded-For", clientIP)
	req.Header.Set("X-Real-IP", clientIP)
	req.Header.Set("X-Client-IP", clientIP)
}

// ExtractClientIP 从入站请求提取客户端 IP 首段（X-Forwarded-For 首段，回落 X-Real-IP）。
func ExtractClientIP(r *http.Request) string {
	if r == nil {
		return ""
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return strings.TrimSpace(xff[:i])
			}
		}
		return strings.TrimSpace(xff)
	}
	if real := strings.TrimSpace(r.Header.Get("X-Real-IP")); real != "" {
		return real
	}
	return ""
}

// CommonHeaders 设置**主进程**已鉴权 API 的官方请求头基线
// （签到/余额/成长/上报/模型目录 —— 报告 §1.3 的抓样就是这条链路）。
//
// 只放主进程真会发的头：Accept / UA / X-Product / X-User-Id / 企业·租户·域
// / Authorization / X-Request-ID / 链路族。
//
// 刻意**不**设置（都是"另一条链路"或浏览器才有，带上即指纹异常）：
//   - X-IDE-* / X-Agent-*：CLI 模型请求族（见 injectIDEFamily / ChatHeaders）
//   - X-Userinfo / X-Auth-Method：CLI 身份拦截器族（见 injectCLIIdentity）
//   - X-CodeBuddy-Request：main 里只出现在 server.js / sidecar-manager.js
//   - Origin / Referer / Accept-Language：渲染进程才有（见 WebHeaders）
//   - X-Requested-With / X-Machine-ID / X-Session-ID：5.8.3 客户端不存在
func (c *Client) CommonHeaders(req *http.Request, a *auth.Auth) {
	// Content-Type 只在**有请求体**时发：官方 axios/fetch 对无 body 的 GET 不产生
	// 该头，给 GET 挂 application/json 是无意义的指纹偏差。
	if req.Body != nil && req.Body != http.NoBody {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.userAgent(a))
	// X-Request-ID：主进程每个 API 请求都带（签到抓样 §1.3，32 hex）。
	// chat 路径随后由 injectConversationHeaders 覆盖为消息级 ID。
	req.Header.Set("X-Request-ID", session.NewMessageID())
	c.injectProduct(req)
	c.injectIdentity(req, a)
	c.injectTraceHeaders(req, "")
	attachAuth(req, a)
}

// injectCLIIdentity 追加 CLI 身份拦截器独有的头族。
//
// 证据：main/*.js 里 X-Userinfo / X-Auth-Method 出现 **0 次**；cli/dist 的
// runIdentityHeaders() + AuthenticationHttpInterceptor 在 CLI 侧必发：
//
//	X-Auth-Method、X-Userinfo、X-Id-Source（有 idSource）、
//	X-Department-Info（有 departmentFullName）。
//
// 故只在 chat / search / refresh（都在 CLI 侧发出）注入，主进程请求不带。
func injectCLIIdentity(req *http.Request, a *auth.Auth) {
	if a == nil {
		return
	}
	req.Header.Set("X-Auth-Method", authMethodPlugin)
	if a.IDSource != "" {
		req.Header.Set("X-Id-Source", a.IDSource)
	}
	if a.DepartmentFullName != "" {
		req.Header.Set("X-Department-Info", a.DepartmentFullName)
	}
	if ui := userinfoHeader(a); ui != "" {
		req.Header.Set("X-Userinfo", ui)
	}
}

// applyModelCatalogHeaders 给**模型目录端点**补上主进程里少见的浏览器形状两头。
//
// 证据：app.asar/main/account.js#getModels 是主进程里唯一显式写
// Accept: "application/json, text/plain, */*" + X-Requested-With: "XMLHttpRequest"
// 的 API 调用（其余主进程请求都是 axios 默认 + 无 X-Requested-With）。
// 只对 /console/ 目录端点生效：global 的 /v2 目录是另一条链路，多带反而是偏差。
func applyModelCatalogHeaders(req *http.Request, path string) {
	if req == nil || !strings.Contains(path, "/console/") {
		return
	}
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
}

// acceptLanguageFor 按账号 realm 返回 Accept-Language：global → en-US，cn → zh-CN。
func acceptLanguageFor(a *auth.Auth) string {
	if a != nil && a.IsGlobal() {
		return "en-US"
	}
	return "zh-CN"
}

// ChatMeta 一次 chat 出站的会话头族元数据（issue #35：后台按 X-Conversation-Request-ID
// 聚合请求，官方客户端一次 user send 内所有 tool call/重试/换号复用同一个 ID）。
// handler 在轮转循环外生成 conversationID / conversationRequestID，循环内每次出站
// 复用同值；TraceID 透传入站值（空 = 回落 conversationRequestID）。
// messageID（消息级，每条独立）由 ChatHeaders 内部生成，无需外部可见。
type ChatMeta struct {
	ConversationID        string // X-Conversation-ID：body 提取的入站值，空则补 32 hex
	ConversationRequestID string // X-Conversation-Request-ID / X-Root-Request-ID：聚合主键，必发
	TraceID               string // X-Trace-ID：入站透传值，空则回落 conversationRequestID
}

// ChatHeaders 在 common 之上加 chat 专属头（会话头族 + 设备风控 + IP 透传）。
// clientIP 为本次请求的客户端 IP（按参数传递，不读共享字段——避免并发串扰）；
// PassthroughIP=false 或 clientIP 为空时不注入 IP 头。
func (c *Client) ChatHeaders(req *http.Request, a *auth.Auth, clientIP string, meta ChatMeta) {
	c.CommonHeaders(req, a)
	// Accept 用 axios 默认头串：CLI 的模型请求构造区**没有**显式 Accept，
	// 落到 axios 默认 `application/json, text/plain, */*`（5.9.2 实测如此；
	// 只有 web search/fetch 路径才显式写 application/json）。
	// 流式与否由 body 的 stream 字段决定，与 Accept 无关。
	req.Header.Set("Accept", "application/json, text/plain, */*")
	// 刻意**不**发 Accept-Encoding：5.9.2 的 CLI/模型链路没有任何 identity 设置，
	// 由底层 fetch 自带 gzip/deflate（旧实现写死 identity 属可辨差异）。
	// CLI 模型请求专属头族：身份拦截器两头 + X-IDE-* + X-Agent-*（含 runtime）。
	// （主进程基线里没有这些，见 CommonHeaders 注释。）
	injectCLIIdentity(req, a)
	c.injectIDEFamily(req)
	req.Header.Set("X-Agent-Intent", agentIntentCraft)
	req.Header.Set("X-Agent-Type", agentTypeMain)
	req.Header.Set("X-Agent-Runtime", agentRuntimeOther)
	// 模型请求专属的两头（billing 请求官方不发，见 injectModelAttribution）。
	c.injectModelAttribution(req, a)
	// 注意：**不**在这里注入 X-Device-Token。官方该头是签到专属
	// （main/account.js getCheckinRequestHeaders → postCheckin），模型请求从不带。
	// 客户端 IP 透传（仅 PassthroughIP=true 且本次请求带 IP）。
	c.injectClientIP(req, clientIP)
	// 会话头族（对话/请求/消息/B3 链路）。
	traceID := c.injectConversationHeaders(req, meta)
	if c.chatFingerprint() == chatFingerprintVLM {
		c.applyVLMGatewayHeaders(req, meta, traceID)
	}
}

// chat 指纹形态常量。
//
// 官方有**两条**会打到 /v2/chat/completions 的构造点（不是一条）：
//
//   - chatFingerprintCLI：cli/dist/codebuddy-lite-wb.mjs 的 ModelProvider
//     （buildConversationHeaders + ProviderHttpHeaders + 身份拦截器）。
//     这是**桌面端文本会话**的真实出站形态：X-Agent-Type / X-Agent-Purpose /
//     X-Private-Data / X-Userinfo / X-Auth-Method / X-Root-Request-ID 齐全，
//     b3 走 OTel 根 span（三段、无 parent）。默认。
//
//   - chatFingerprintVLM：main/server.js 的 skills VLM 代理
//     （buildVlmGatewayHeaders + applyGatewayHeaders + applyTraceHeaders）。
//     只服务 /skills/vlm/chat（视觉技能）转发：x-requested-with /
//     acp-connection-id / purpose=conversation / private-data=true / b3 四段。
//     对纯文本会话来说这是**另一条链路**的形态，拿它冒充文本会话反而更假。
const (
	chatFingerprintCLI = "cli"
	chatFingerprintVLM = "vlm"
	// chatFingerprintVLMAlias 旧配置把 VLM 形态写成 "desktop" 时的兼容别名。
	chatFingerprintVLMAlias = "desktop"
)

// chatFingerprint 生效的 chat 指纹形态：空值 = cli（桌面端文本会话）。
func (c *Client) chatFingerprint() string {
	if c != nil {
		switch strings.ToLower(strings.TrimSpace(c.ChatFingerprint)) {
		case chatFingerprintVLM, chatFingerprintVLMAlias:
			return chatFingerprintVLM
		}
	}
	return chatFingerprintCLI
}

// applyVLMGatewayHeaders 把请求头改成**skills VLM 代理**形态
// （app.asar/main/server.js 的 buildVlmGatewayHeaders + applyGatewayHeaders +
// applyTraceHeaders）。仅在 upstream.chat_fingerprint=vlm 时生效。
//
// 只在做视觉技能同形态对照/排障时用：这条链路的 purpose=conversation、
// private-data=true、b3 四段，都不是文本会话的取值。
//
// 头名大小写不作为指纹对待：RFC 7230 规定头名大小写不敏感，net/http 会规范化，
// 上游任何基于大小写的判定都会误伤它自己的客户端。
func (c *Client) applyVLMGatewayHeaders(req *http.Request, meta ChatMeta, traceID string) {
	if req == nil {
		return
	}
	req.Header.Set("x-requested-with", "XMLHttpRequest")
	req.Header.Set("x-codebuddy-request", "1")
	req.Header.Set("acp-connection-id", acpConnectionID(meta))
	req.Header.Set("X-Agent-Purpose", agentPurposeGeneral)
	req.Header.Set("X-Private-Data", "true")
	req.Header.Del("X-Agent-Type")
	// VLM 代理链路（main/server.js applyGatewayHeaders）没有 X-Agent-Runtime。
	req.Header.Del("X-Agent-Runtime")
	req.Header.Del("X-Userinfo")
	req.Header.Del("X-Auth-Method")
	req.Header.Del("X-Id-Source")
	req.Header.Del("X-Department-Info")
	req.Header.Del("X-Root-Request-ID")
	// b3 四段 + X-B3-ParentSpanId（applyTraceHeaders 的写法）。
	if !validTraceID(traceID) {
		traceID = randomHex(16)
	}
	spanID := req.Header.Get("X-B3-SpanId")
	if spanID == "" {
		spanID = randomHex(8)
	}
	parentID := randomHex(8)
	req.Header.Set("b3", traceID+"-"+spanID+"-1-"+parentID)
	req.Header.Set("X-B3-ParentSpanId", parentID)
}

// acpConnectionID 生成与会话一一对应的 acp-connection-id（UUID 形态）。
// 官方由 VlmSessionLedger 为每个 sessionId 分配一个 randomUUID 并复用；
// 网关没有常驻会话表，用 conversationRequestID 的 sha256 派生，保证：
// 同一会话多次请求同值（可被上游按会话聚合）、不同会话不同值、形状为合法 UUIDv4。
func acpConnectionID(meta ChatMeta) string {
	seed := meta.ConversationRequestID
	if seed == "" {
		seed = meta.ConversationID
	}
	if seed == "" {
		return newUUIDv4()
	}
	sum := sha256.Sum256([]byte("workbuddy-acp-connection-id:" + seed))
	b := sum[:16]
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

// injectConversationHeaders 注入官方客户端会话头族（issue #35 后台聚合）。
// 头族分四层，各司其职：
//   - X-Conversation-ID：会话级，多轮稳定（body 的 conversationId）。空则补 32 hex
//     （国际端点收紧通道校验后，缺该头直接 400 / 11128，issue #190）。
//   - X-Conversation-Request-ID：**对话轮级聚合主键**，必发。一次 user send 内的
//     所有 tool call/重试/换号/降级复用同一个 → 后台按它聚合成一条。
//   - X-Conversation-Message-ID = X-Request-ID：消息级，每条独立（32 位 hex）。
//   - X-Root-Request-ID：= conversationRequestID（根请求追踪）。
//   - X-Trace-ID / traceparent / b3 / X-B3-*：W3C + B3 双链路族（官方 applyTraceHeaders）。
//
// 返回用于链路族的 traceID（供 VLM 形态复用同一 trace）。
func (c *Client) injectConversationHeaders(req *http.Request, meta ChatMeta) string {
	convReqID := meta.ConversationRequestID
	if convReqID == "" {
		// 零值 meta（直接调 ChatHeaders 的调用方/测试）也要保证聚合主键必发。
		convReqID = session.NewMessageID()
	}
	messageID := session.NewMessageID()
	conversationID := meta.ConversationID
	if conversationID == "" {
		// 兜底用 UUID v4：官方 X-Conversation-ID 就是带横线的 UUID，
		// 用 32 hex 会让"会话 ID"与"消息 ID"形状相同（见 newUUIDv4 注释）。
		conversationID = newUUIDv4()
	}
	req.Header.Set("X-Conversation-ID", conversationID)
	req.Header.Set("X-Conversation-Request-ID", convReqID)
	req.Header.Set("X-Conversation-Message-ID", messageID)
	req.Header.Set("X-Request-ID", messageID)
	req.Header.Set("X-Root-Request-ID", convReqID)
	// 桌面端 VLM 网关不带 X-Root-Request-ID（那是 CLI 会话族）；聚合主键是
	// X-Conversation-Request-ID，删掉该头不影响后台按轮次聚合。
	//
	// 注：官方 applyGatewayHeaders 里 message-id 与 request-id 是两次独立的
	// randomUUID()（uuid 形态、互不相等），而 CLI/搜索路径的观测值同值且为
	// 32 hex。两条路径的观测互相冲突，缺抓包佐证时**不动**形状（改错会破坏
	// 上游按消息聚合），只保留可确证的部分。
	if c.chatFingerprint() == chatFingerprintVLM {
		req.Header.Del("X-Root-Request-ID")
	}
	traceID := meta.TraceID
	if !validTraceID(traceID) {
		traceID = convReqID
	}
	if !validTraceID(traceID) {
		traceID = messageID // 非法 B3 TraceId → 回落恒 32 hex 的消息级 ID
	}
	c.injectTraceHeaders(req, traceID)
	return traceID
}

// injectTraceHeaders 注入官方链路头族（applyTraceHeaders 逐字对齐）：
//
//	traceparent: 00-<32hex trace>-<16hex span>-01
//	b3:          <32hex trace>-<16hex span>-1（根 span 三段；VLM 形态才补 parent）
//	X-B3-TraceId / X-B3-SpanId / X-B3-Sampled: 1 / X-Trace-ID
//
// 官方在**每个**出站请求上都打这套头（checkin 抓包同样带，报告 §1.3），故放在
// CommonHeaders 里统一注入；chat 用会话级 traceID 覆盖，其余请求各自随机。
func (c *Client) injectTraceHeaders(req *http.Request, traceID string) {
	if !validTraceID(traceID) {
		traceID = randomHex(16) // 32 hex
	}
	spanID := randomHex(8) // 16 hex
	req.Header.Set("traceparent", "00-"+traceID+"-"+spanID+"-01")
	// CLI 的 b3 由 OTel composite propagator 注入：根 span 没有 parent，故是**三段**
	// `<trace>-<span>-1`，且不发 X-B3-ParentSpanId（报告 §4.1 实测抓样同形）。
	// 四段 + parent 只出现在 main/server.js 的 applyTraceHeaders（VLM 代理链路，
	// 见 chatFingerprintVLM / applyVLMGatewayHeaders）。
	req.Header.Set("b3", traceID+"-"+spanID+"-1")
	req.Header.Set("X-B3-TraceId", traceID)
	req.Header.Set("X-B3-SpanId", spanID)
	req.Header.Set("X-B3-Sampled", "1")
	req.Header.Set("X-Trace-ID", traceID)
}

// validTraceID 判断 B3 TraceId 是否合法：16 或 32 位 hex（大小写均可）。
// 官方客户端生成的 conversationRequestId 是 32 位 hex（UUID 去横线），入站透传值
// 可能是任意形状（含横线/超长/非 hex），直接塞进 B3 头会破坏链路关联（issue #35）。
func validTraceID(s string) bool {
	if len(s) != 16 && len(s) != 32 {
		return false
	}
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
			return false
		}
	}
	return true
}

// attributionClientName 生效的 X-IDE-Name/Type 取值：ClientName 非空取之；
// 空默认 "WorkBuddy"（官方桌面端产品名）。显式配 "SaaS" 走旧行为逃生门。
func (c *Client) attributionClientName() string {
	if c != nil && c.ClientName != "" {
		return c.ClientName
	}
	return ideName
}

// BillingHeaders billing 接口请求头（checkin / balance / report / growth / travel）。
// 与 chat 共用同一套官方头族——官方主进程 axios 走同一个 AuthenticationHttpInterceptor，
// 分域发不同头会形成"同账号两种客户端"的关联特征。
func (c *Client) BillingHeaders(req *http.Request, a *auth.Auth) {
	// 同样不带 X-Device-Token（签到专属，见 CheckinHeaders 与 billingJSONOpt）。
	c.CommonHeaders(req, a)
}

// WebHeaders Web 形态端点请求头（x-client-platform: web 的官网/成长中心接口：
// 领奖、账号资料、Web 行为上报）。
//
// 官方这类请求由**渲染进程**（Electron 页面）发出：身份族与 API 请求同源（同一
// AuthenticationHttpInterceptor），但 UA 是浏览器形态（navigator.userAgent），
// 且带 Origin/Referer 与 x-client-platform: web。三处必须同时成立——只换 UA 不换
// Origin、或用 CLI 三段式 UA 打 Web 端点，都是可辨的伪造特征。
//
// refererPath 为 Referer 的路径部分（如 "/profile/growth-center"）。
func (c *Client) WebHeaders(req *http.Request, a *auth.Auth, refererPath string) {
	c.CommonHeaders(req, a)
	// Origin/Referer 用官网域（workbuddy.cn / workbuddy.ai）：Web 端点在官网域下，
	// 渲染进程页面的 origin 就是它，不是 API 的 codebuddy.cn。
	base := c.webBase(a)
	req.Header.Set("x-client-platform", "web")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Origin", base)
	if refererPath == "" {
		refererPath = "/"
	}
	// refererPath 既可能是页面路径（"/profile/growth-center"），也可能是完整 URL
	// （"https://www.workbuddy.cn/space/d/xxx"）——后者是页面自身的地址，直接当
	// Referer 用（浏览器 Referer 就是当前页面 URL）。
	if strings.HasPrefix(refererPath, "http://") || strings.HasPrefix(refererPath, "https://") {
		req.Header.Set("Referer", refererPath)
	} else {
		req.Header.Set("Referer", base+refererPath)
	}
	req.Header.Set("User-Agent", c.electronRendererUA(a))
	// 渲染进程的浏览器请求会自带 Accept-Language（Chromium 行为），按 realm 切。
	req.Header.Set("Accept-Language", acceptLanguageFor(a))
	// 渲染进程同样走身份拦截器：Web 端点保留 CLI 那套身份头（历史行为不变）。
	injectCLIIdentity(req, a)
}

// RefreshHeaders refresh 端点专属头（X-Refresh-Token 只允许出现在这里）。
func (c *Client) RefreshHeaders(req *http.Request, a *auth.Auth) {
	c.CommonHeaders(req, a)
	// refresh 由 CLI 的 plugin 通道发出（报告 §2.2）→ 带 CLI 身份拦截器两头。
	injectCLIIdentity(req, a)
	// refresh 调用自身禁止再触发 401 重放（否则递归刷新，见 auth_replay.go）。
	markNoReplay(req)
	req.Header.Set("X-Refresh-Token", a.RefreshTokenValue())
	// X-Auth-Refresh-Source 对齐官方客户端 refresh 渠道标识 "plugin"（D3）。
	req.Header.Set("X-Auth-Refresh-Source", authMethodPlugin)
}
