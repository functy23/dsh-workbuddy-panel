package upstream

import "encoding/base64"

// base64StdDecode 标准 base64 解码（测试辅助，抽成函数便于上面复用）。
func base64StdDecode(s string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}
