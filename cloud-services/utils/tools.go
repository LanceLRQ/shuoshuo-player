package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

// ParseUint 字符串转uint64
func ParseUint(s string) uint64 {
	var n uint64
	_, _ = fmt.Sscanf(strings.TrimSpace(s), "%d", &n)
	return n
}

// ParseFloat 字符串转float64
func ParseFloat(s string) float64 {
	var f float64
	_, _ = fmt.Sscanf(strings.TrimSpace(s), "%f", &f)
	return f
}

// ObjectToJSONStringFormatted 将对象转换成JSON字符串并格式化
func ObjectToJSONStringFormatted(conf interface{}) string {
	b, err := json.Marshal(conf)
	if err != nil {
		return fmt.Sprintf("%+v", conf)
	}
	var out bytes.Buffer
	err = json.Indent(&out, b, "", "    ")
	if err != nil {
		return fmt.Sprintf("%+v", conf)
	}
	return out.String()
}

// ObjectToJSONByte 将对象转换成JSON字节数组
func ObjectToJSONByte(obj interface{}) []byte {
	b, err := json.Marshal(obj)
	if err != nil {
		return []byte("{}")
	}
	return b
}

// ObjectToJSONString 将对象转换成JSON字符串
func ObjectToJSONString(obj interface{}) string {
	b, err := json.Marshal(obj)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// JSONStringObject 解析JSON字符串
func JSONStringObject(jsonStr string, obj interface{}) bool {
	return JSONBytesObject([]byte(jsonStr), obj)
}

// JSONBytesObject 解析JSON字节数组
func JSONBytesObject(jsonBytes []byte, obj interface{}) bool {
	err := json.Unmarshal(jsonBytes, &obj)
	return err == nil
}
