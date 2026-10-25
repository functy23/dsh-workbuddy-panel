package upstream

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/linguo2625469/workbuddy2api-panel/internal/auth"
)

// TestReportDesktopEventFingerprint 断言桌面指纹上报：走 chatBase、UA 为桌面形状、
// 事件数组自动注入 workbuddy-desktop 公共指纹（覆盖同名业务键）。
func TestReportDesktopEventFingerprint(t *testing.T) {
	var got []map[string]any
	var gotUA string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/report" {
			t.Errorf("path=%s want /v2/report", r.URL.Path)
		}
		gotUA = r.Header.Get("User-Agent")
		if r.Header.Get("X-User-Id") != "u-dt" {
			t.Errorf("X-User-Id=%q want u-dt", r.Header.Get("X-User-Id"))
		}
		if r.Header.Get("X-Product") != "SaaS" {
			t.Errorf("X-Product=%q want SaaS", r.Header.Get("X-Product"))
		}
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &got); err != nil {
			t.Fatalf("body must be array: %v", err)
		}
		w.Write([]byte(`{"code":0,"msg":"OK"}`))
	}))
	defer srv.Close()

	c := &Client{HTTP: srv.Client(), ChatBaseCN: srv.URL}
	err := c.ReportDesktopEvent(&auth.Auth{AccessToken: "at", UID: "u-dt", Nickname: "RenJie"},
		DesktopEvent{"eventCode": "agent_task_created", "mode": "craft"})
	if err != nil {
		t.Fatalf("report desktop: %v", err)
	}
	// 桌面指纹上报与 chat 共用同一条官方 UA（见 headers.go userAgent）。
	if want := c.userAgent(nil); gotUA != want {
		t.Errorf("UA=%q want %q", gotUA, want)
	}
	// ideVersion 跟随客户端版本，不再写死旧版本号。
	if ev, ok := got[0]["ideVersion"].(string); !ok || ev != c.clientVersion() {
		t.Errorf("ideVersion=%v want %q", got[0]["ideVersion"], c.clientVersion())
	}
	if len(got) != 1 {
		t.Fatalf("events=%d want 1", len(got))
	}
	ev := got[0]
	if ev["extName"] != "workbuddy-desktop" {
		t.Errorf("extName=%v want workbuddy-desktop", ev["extName"])
	}
	if ev["ideType"] != "WorkBuddy" || ev["ideName"] != "WorkBuddy" {
		t.Errorf("ideType/ideName=%v/%v want WorkBuddy", ev["ideType"], ev["ideName"])
	}
	if ev["userId"] != "u-dt" {
		t.Errorf("userId=%v want u-dt", ev["userId"])
	}
	if ev["userNickname"] != "RenJie" {
		t.Errorf("userNickname=%v want RenJie", ev["userNickname"])
	}
	if ev["mode"] != "craft" {
		t.Errorf("业务字段 mode=%v 被指纹覆盖或缺失", ev["mode"])
	}
	// machineId：官方是 IOPlatformUUID（8-4-4-4-12 大写 UUID）；旧实现是 36 位连续 hex。
	machineID, _ := ev["machineId"].(string)
	if !isUUIDv4Shape(strings.ToLower(machineID)) {
		t.Errorf("machineId=%q 应为 8-4-4-4-12 UUID（IOPlatformUUID 形态）", machineID)
	}
	if machineID != strings.ToUpper(machineID) {
		t.Errorf("machineId=%q 应为大写（真机 IOPlatformUUID 是大写）", machineID)
	}
	// sessionId：进程级 UUID（一次 app 运行一个），不是按 uid 稳定派生。
	if sid, _ := ev["sessionId"].(string); !isUUIDv4Shape(sid) {
		t.Errorf("sessionId=%q 应为 UUID v4", sid)
	}
	// 事件体 reportDelay 恒 0（2000 是批量调度间隔，不是字段值）。
	if v, _ := ev["reportDelay"].(float64); v != 0 {
		t.Errorf("reportDelay=%v want 0", ev["reportDelay"])
	}
	// 机器字段取真机缺省（darwin/arm64/23.6.0/Apple M2/8/16），不再是 win32/x64。
	for k, want := range map[string]any{
		"os": "darwin", "arch": "arm64", "osVersion": "23.6.0", "cpuModel": "Apple M2",
	} {
		if ev[k] != want {
			t.Errorf("%s=%v want %v", k, ev[k], want)
		}
	}
	if ev["cpuCores"] != float64(8) || ev["memorySize"] != float64(16) {
		t.Errorf("cpuCores/memorySize=%v/%v want 8/16", ev["cpuCores"], ev["memorySize"])
	}
	// commit/releaseDate 取当前 product 配置缺省（5.9.2 包内 product.json）。
	if ev["commit"] != defaultDesktopCommit {
		t.Errorf("commit=%v want %v", ev["commit"], defaultDesktopCommit)
	}
	if ev["releaseDate"] != float64(defaultDesktopReleaseDate) {
		t.Errorf("releaseDate=%v want %d", ev["releaseDate"], defaultDesktopReleaseDate)
	}
	// qimei36 缺省不发（伪造值比缺字段更可疑）。
	if q, has := ev["qimei36"]; has {
		t.Errorf("qimei36 不应出现在缺省指纹里：%v", q)
	}
}

// TestDesktopFingerprintConfigOverrides 机器字段可由 config 覆盖；qimei36 配了才发。
// 真实值来自宿主进程（OSEventProcessor），容器内必须能整体改写。
func TestDesktopFingerprintConfigOverrides(t *testing.T) {
	c := &Client{
		DesktopOS: "win32", DesktopArch: "x64", DesktopOSVersion: "10.0.26220",
		DesktopCPUModel: "Intel(R) Core(TM) i9-14900K", DesktopCPUCores: 20, DesktopMemorySize: 24,
		DesktopCommit: "deadbeef", DesktopReleaseDate: 123, DesktopTimezone: "Europe/Berlin",
		Qimei36: "aac15cdd91e423abc0dddd47200013a17707",
	}
	fp := c.desktopFingerprint(&auth.Auth{UID: "u1", Nickname: "n"}, "5.9.2")
	for k, want := range map[string]any{
		"os": "win32", "arch": "x64", "osVersion": "10.0.26220",
		"cpuModel": "Intel(R) Core(TM) i9-14900K", "cpuCores": 20, "memorySize": 24,
		"commit": "deadbeef", "releaseDate": int64(123), "timezone": "Europe/Berlin",
		"qimei36": "aac15cdd91e423abc0dddd47200013a17707",
	} {
		if fp[k] != want {
			t.Errorf("%s=%v want %v", k, fp[k], want)
		}
	}
	// 同一账号 machineId 稳定（固定设备），sessionId 与账号无关（进程级）。
	fp2 := c.desktopFingerprint(&auth.Auth{UID: "u1"}, "5.9.2")
	if fp["machineId"] != fp2["machineId"] {
		t.Error("同一 uid 的 machineId 应稳定")
	}
	if fp["sessionId"] != fp2["sessionId"] {
		t.Error("sessionId 应为进程级常量")
	}
	fpOther := c.desktopFingerprint(&auth.Auth{UID: "u2"}, "5.9.2")
	if fpOther["machineId"] == fp["machineId"] {
		t.Error("不同 uid 的 machineId 应不同")
	}
}

// TestDesktopChatSequenceShape 断言完整对话事件链的事件码顺序与关键字段。
func TestDesktopChatSequenceShape(t *testing.T) {
	events := DesktopChatSequence("conv-1", "req-1", "msg-1", "fast-model", "fast-model")
	wantCodes := []string{
		"agent_task_created", "chat_message_send", "chat_request_send",
		"chat_message_response", "chat_message_status", "chat_request_response",
	}
	if len(events) != len(wantCodes) {
		t.Fatalf("events=%d want %d", len(events), len(wantCodes))
	}
	for i, want := range wantCodes {
		if events[i]["eventCode"] != want {
			t.Errorf("events[%d].eventCode=%v want %v", i, events[i]["eventCode"], want)
		}
	}
	resp := events[3]
	if resp["isSuccessful"] != true {
		t.Errorf("chat_message_response.isSuccessful=%v want true（RichMeow 判据）", resp["isSuccessful"])
	}
	if resp["finishReason"] != "stop" {
		t.Errorf("finishReason=%v want stop", resp["finishReason"])
	}
	if resp["conversationId"] != "conv-1" {
		t.Errorf("conversationId=%v want conv-1", resp["conversationId"])
	}
}

// TestSetAppearanceTheme 断言主题设置端点形状（点亮 Hp_Appearance 的 API）。
func TestSetAppearanceTheme(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/user-asset/appearance/set" {
			t.Errorf("path=%s want /v2/user-asset/appearance/set", r.URL.Path)
		}
		if ua := r.Header.Get("User-Agent"); !strings.HasPrefix(ua, "WorkBuddy/") {
			t.Errorf("UA=%q want official WorkBuddy UA", ua)
		}
		raw, _ := io.ReadAll(r.Body)
		json.Unmarshal(raw, &got)
		w.Write([]byte(`{"code":0,"msg":"OK"}`))
	}))
	defer srv.Close()

	c := &Client{HTTP: srv.Client(), ChatBaseCN: srv.URL}
	if err := c.SetAppearanceTheme(&auth.Auth{AccessToken: "at", UID: "u1"}, "theme-tkmw7j"); err != nil {
		t.Fatalf("set theme: %v", err)
	}
	if got["kind"] != "theme" || got["resource_key"] != "theme-tkmw7j" {
		t.Errorf("body=%v want kind=theme resource_key=theme-tkmw7j", got)
	}
}
