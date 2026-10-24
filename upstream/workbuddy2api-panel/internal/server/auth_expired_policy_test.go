// auth_expired_policy_test.go 401 凭证失效的账号处置（issue #243 修复闭环）。
package server

import (
	"testing"

	"github.com/linguo2625469/workbuddy2api-panel/internal/auth"
	"github.com/linguo2625469/workbuddy2api-panel/internal/pool"
	"github.com/linguo2625469/workbuddy2api-panel/internal/upstream"
)

// TestApplyErrorPolicyAuthExpiredSoftThenDisable 401（refresh 未恢复）的处置曲线：
//   - 第 1、2 次：软冷却（一次 401 可能是网关抖动，不该杀号）
//   - 第 3 次（达 sessionDeadThreshold）：禁用，reason 明示需重新登录
//
// 此前 ErrClient 只换号不罚 → 死凭证永远留在池里反复撞 401，面板表现为
// "可用但一直报 upstream client (http 401)"（issue #243）。
func TestApplyErrorPolicyAuthExpiredSoftThenDisable(t *testing.T) {
	p := pool.New("")
	p.Add(&auth.Auth{UID: "u1", AccessToken: "at", RefreshToken: "rt"})
	h := NewHandler(Config{Pool: p})

	for i := 1; i < pool.SessionDeadThreshold(); i++ {
		h.applyErrorPolicy("u1", upstream.ErrAuthExpired, "", "glm-5.2", nil)
		st, ok := p.Status("u1")
		if !ok {
			t.Fatalf("call %d: 账号消失", i)
		}
		if st.Disabled {
			t.Fatalf("call %d: 未达阈值不应禁用（一次 401 可能是抖动）", i)
		}
		if !st.Cooling {
			t.Fatalf("call %d: 应进入软冷却（避免死凭证反复撞 401）", i)
		}
		if st.Reason == "" {
			t.Errorf("call %d: reason 不应为空（面板要能看出是 401 而非 12153）", i)
		}
	}
	// 达阈值的那一次：禁用。
	h.applyErrorPolicy("u1", upstream.ErrAuthExpired, "", "glm-5.2", nil)
	st, _ := p.Status("u1")
	if !st.Disabled {
		t.Fatalf("连续 %d 次 401 后应禁用，got %+v", pool.SessionDeadThreshold(), st)
	}
	if st.Reason == "" {
		t.Error("禁用 reason 不应为空")
	}
}

// TestApplyErrorPolicyAuthExpiredNotCountedAsServerError 401 不应喂熔断器
// （fails/errTotal 只服务 5xx 语义；凭证问题不是上游故障）。
func TestApplyErrorPolicyAuthExpiredNotCountedAsServerError(t *testing.T) {
	p := pool.New("")
	p.Add(&auth.Auth{UID: "u1", AccessToken: "at", RefreshToken: "rt"})
	h := NewHandler(Config{Pool: p})
	h.applyErrorPolicy("u1", upstream.ErrAuthExpired, "", "glm-5.2", nil)
	st, _ := p.Status("u1")
	if st.ErrTotal != 0 {
		t.Errorf("401 不应累计 err_total，got %d", st.ErrTotal)
	}
}

// TestClassify401GatewayPageIsAuthExpired 端到端分类：APISIX 401 页 → auth_expired。
func TestClassify401GatewayPageIsAuthExpired(t *testing.T) {
	body := "<html><head><title>401 Authorization Required</title></head></html>"
	if got := upstream.Classify(401, body); got != upstream.ErrAuthExpired {
		t.Fatalf("Classify=%v want ErrAuthExpired", got)
	}
}
