package panel

// rate_limit_meta_test.go 回归 issue #241：app.js 顶部是 'use strict'，
// rateLimitMeta 里 detail 未声明就赋值会抛 ReferenceError（严格模式不会创建隐式
// 全局），导致 renderAccounts 整表空白——而所有 Go 测试当时全绿。
//
// 这里用 node + vm 在严格模式下真实执行该函数，覆盖三种分支（单 until / 双时钟 /
// 无时间），任何隐式全局或抛错都会让本用例失败。

import (
	"os"
	"os/exec"
	"strings"
	"testing"
)

const rateLimitMetaScript = `const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8');
const hStart = src.indexOf('function esc(');
const hEnd = src.indexOf('function rateLimitMeta');
const fStart = src.indexOf('function rateLimitMeta');
const fEnd = src.indexOf('function formatTokenCount');
if ([hStart, hEnd, fStart, fEnd].some(v => v < 0)) throw new Error('rateLimitMeta helpers not found');
const ctx = { Date, Number, String, Math, RegExp, isNaN };
vm.createContext(ctx);
vm.runInContext("'use strict';" + src.slice(hStart, hEnd) + src.slice(fStart, fEnd) +
  ';this.rateLimitMeta = rateLimitMeta;this.rateLimitRowsHtml = rateLimitRowsHtml;', ctx);
const now = Date.now();
const out = {};
const run = (key, row) => {
  try { out[key] = ctx.rateLimitMeta(row, now); }
  catch (e) { out[key + 'Error'] = String((e && e.message) || e); }
};
run('untilOnly', { model: 'glm-5.2', kind: 'rate_limit', until: new Date(now + 60000).toISOString() });
run('dualClock', { model: 'glm-5.2', kind: 'rate_limit',
  reset_at: new Date(now + 120000).toISOString(), until: new Date(now + 60000).toISOString() });
run('noDeadline', { model: 'glm-5.2', kind: 'rate_limit' });
run('unavailable', { model: 'glm-5.2', kind: 'model_unavailable' });
run('nullRow', null);
try {
  out.html = ctx.rateLimitRowsHtml([{ model: 'a', kind: 'rate_limit', until: new Date(now + 30000).toISOString() }], now);
} catch (e) { out.htmlError = String((e && e.message) || e); }
process.stdout.write(JSON.stringify(out));
`

// TestRateLimitMetaNoImplicitGlobals 严格模式下三个分支都不得抛错，且 detail 非空。
func TestRateLimitMetaNoImplicitGlobals(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node not available; skipping JS runtime check")
	}
	f, err := os.CreateTemp(t.TempDir(), "ratelimit-*.cjs")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.WriteString(rateLimitMetaScript); err != nil {
		t.Fatal(err)
	}
	f.Close()
	out, err := exec.Command(node, f.Name(), "app.js").CombinedOutput()
	if err != nil {
		t.Fatalf("node run failed: %v\n%s", err, out)
	}
	got := string(out)
	for _, key := range []string{"untilOnly", "dualClock", "noDeadline", "unavailable", "nullRow"} {
		if strings.Contains(got, key+"Error") {
			t.Fatalf("%s 抛错（严格模式下未声明变量赋值会 ReferenceError）：%s", key, got)
		}
	}
	for _, want := range []string{`"untilOnly":{"model":"glm-5.2"`, `"detail":"预计`, `"detail":"网关`} {
		if !strings.Contains(got, want) {
			t.Errorf("缺少期望片段 %s，got=%s", want, got)
		}
	}
	if strings.Contains(got, "htmlError") {
		t.Errorf("rateLimitRowsHtml 抛错：%s", got)
	}
}
