// device_token_test.go X-Device-Token 注入 + 文件兜底读取单测。
//
// 语义（对齐分发包）：X-Device-Token 是**签到专属**头——main/account.js 的
// CloudAccountRepo.postCheckin() 调 getCheckinRequestHeaders() 取 TuringShield token；
// 余额/成长/上报/模型请求都不带它。故这里只断言 DailyCheckin 会带上，
// 并显式断言 chat / billing 公共头**不**带（防止又漏回公共层）。
package upstream

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/linguo2625469/workbuddy2api-panel/internal/auth"
)

// TestDeviceTokenInjectedOnCheckinOnly 签到会带 X-Device-Token；chat/billing 公共头不带。
func TestDeviceTokenInjectedOnCheckinOnly(t *testing.T) {
	a := &auth.Auth{AccessToken: "at", UID: "u1", DeviceToken: "tok-from-auth"}

	var mu sync.Mutex
	seen := map[string]string{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		seen[r.URL.Path] = r.Header.Get("X-Device-Token")
		mu.Unlock()
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"code":0,"data":{}}`))
	}))
	defer srv.Close()

	c := &Client{
		HTTP:          srv.Client(),
		ChatHTTP:      srv.Client(),
		ChatBaseCN:    srv.URL,
		BillingBaseCN: srv.URL,
	}

	// 1) 签到路径：必须带。
	if err := c.DailyCheckin(a); err != nil {
		t.Fatalf("checkin: %v", err)
	}
	// 2) chat 公共头：不得带（官方模型请求从不发该头）。
	chatReq, _ := http.NewRequest(http.MethodPost, srv.URL+"/v2/chat/completions", strings.NewReader("{}"))
	c.ChatHeaders(chatReq, a, "", ChatMeta{})
	if got := chatReq.Header.Get("X-Device-Token"); got != "" {
		t.Errorf("chat 不应带 X-Device-Token，got %q", got)
	}
	// 3) billing 公共头：同样不得带（只有签到端点才加）。
	billReq, _ := http.NewRequest(http.MethodPost, srv.URL+"/v2/billing/meter/get-user-resource",
		strings.NewReader("{}"))
	c.BillingHeaders(billReq, a)
	if got := billReq.Header.Get("X-Device-Token"); got != "" {
		t.Errorf("billing 不应带 X-Device-Token，got %q", got)
	}

	mu.Lock()
	defer mu.Unlock()
	var checkinTok string
	for path, tok := range seen {
		if strings.Contains(path, "daily-checkin") {
			checkinTok = tok
		}
	}
	if checkinTok != "tok-from-auth" {
		t.Errorf("签到请求 X-Device-Token = %q want tok-from-auth（seen=%v）", checkinTok, seen)
	}
}

// TestDeviceTokenNotInjected_WhenEmpty 所有来源皆空时签到也不注入该头。
func TestDeviceTokenNotInjected_WhenEmpty(t *testing.T) {
	a := &auth.Auth{AccessToken: "at", UID: "u1"} // DeviceToken 空
	var got string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Get("X-Device-Token")
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"code":0}`))
	}))
	defer srv.Close()
	c := &Client{HTTP: srv.Client(), ChatBaseCN: srv.URL, BillingBaseCN: srv.URL}
	if err := c.DailyCheckin(a); err != nil {
		t.Fatalf("checkin: %v", err)
	}
	if got != "" {
		t.Errorf("X-Device-Token = %q want 空", got)
	}
}

// TestDeviceTokenFromConfigOrFile_Overrides 优先级：auth > config > 文件。
// auth 有值时覆盖 config；auth 空时 config 兜底；auth 与 config 皆空时读文件。
func TestDeviceTokenFromConfigOrFile_Overrides(t *testing.T) {
	dir := t.TempDir()
	fp := filepath.Join(dir, "device_token")
	if err := os.WriteFile(fp, []byte("tok-from-file\n"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	cases := []struct {
		name string
		auth string
		cfg  string
		want string
	}{
		{"auth_over_config", "tok-auth", "tok-config", "tok-auth"},
		{"config_when_auth_empty", "", "tok-config", "tok-config"},
		{"file_when_auth_and_config_empty", "", "", "tok-from-file"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// 每个用例用独立缓存：device token 文件缓存 5 分钟，case 间会串扰。
			save := resetDeviceTokenFileCache(fp)
			defer save()
			a := &auth.Auth{AccessToken: "at", UID: "u1", DeviceToken: tc.auth}
			var got string
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				got = r.Header.Get("X-Device-Token")
				w.WriteHeader(200)
				_, _ = w.Write([]byte(`{"code":0}`))
			}))
			defer srv.Close()
			c := &Client{
				HTTP:            srv.Client(),
				ChatHTTP:        srv.Client(),
				ChatBaseCN:      srv.URL,
				BillingBaseCN:   srv.URL,
				DeviceToken:     tc.cfg,
				DeviceTokenFile: fp,
			}
			// 走签到路径（该头唯一出现的地方），而不是 chat 公共头。
			if err := c.DailyCheckin(a); err != nil {
				t.Fatalf("checkin: %v", err)
			}
			if got != tc.want {
				t.Errorf("X-Device-Token = %q want %q", got, tc.want)
			}
		})
	}
}

// TestDeviceTokenFileTooLarge 文件超过 1KB 时忽略不注入。
func TestDeviceTokenFileTooLarge(t *testing.T) {
	dir := t.TempDir()
	fp := filepath.Join(dir, "device_token")
	if err := os.WriteFile(fp, []byte(strings.Repeat("x", 2048)), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}
	save := resetDeviceTokenFileCache(fp)
	defer save()
	a := &auth.Auth{AccessToken: "at", UID: "u1"}
	c := &Client{DeviceTokenFile: fp}
	if tok := c.resolveDeviceToken(a); tok != "" {
		t.Errorf("resolveDeviceToken() = %q want empty (file too large)", tok)
	}
}

// resetDeviceTokenFileCache 替换全局 device token 文件缓存并返回恢复函数。
// 文件缓存 5 分钟 TTL，测试间需清空避免串扰。
func resetDeviceTokenFileCache(path string) (restore func()) {
	dtFileCache.mu.Lock()
	origPath := dtFileCache.path
	origTok := dtFileCache.token
	origRead := dtFileCache.readAt
	origErr := dtFileCache.lastErr
	dtFileCache.path = path
	dtFileCache.token = ""
	dtFileCache.readAt = time.Time{}
	dtFileCache.lastErr = nil
	dtFileCache.mu.Unlock()
	var once sync.Once
	return func() {
		once.Do(func() {
			dtFileCache.mu.Lock()
			dtFileCache.path = origPath
			dtFileCache.token = origTok
			dtFileCache.readAt = origRead
			dtFileCache.lastErr = origErr
			dtFileCache.mu.Unlock()
		})
	}
}
