package utils

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gofiber/fiber/v2"
	"reflect"
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

// ShallowMergeStructFields 同步源结构体到目标结构体，只更新指定的字段
// source: 源结构体指针
// target: 目标结构体指针
// fieldsToUpdate: 需要更新的字段名切片，如果为nil或空则更新所有字段
func ShallowMergeStructFields(source, target interface{}, fieldsToUpdate []string) error {
	// 先解引用指针
	sourceValue := reflect.ValueOf(source)
	if sourceValue.Kind() == reflect.Ptr {
		sourceValue = sourceValue.Elem()
	}

	targetValue := reflect.ValueOf(target)
	if targetValue.Kind() != reflect.Ptr {
		return errors.New("target must be a pointer")
	} else {
		targetValue = targetValue.Elem()
	}

	sourceType := sourceValue.Type()
	targetType := targetValue.Type()

	// 创建需要更新的字段名映射，便于快速查找
	fieldsMap := make(map[string]bool)
	if len(fieldsToUpdate) > 0 {
		for _, field := range fieldsToUpdate {
			fieldsMap[field] = true
		}
	}

	// 遍历源结构体的所有字段
	for i := 0; i < sourceValue.NumField(); i++ {
		fieldName := sourceType.Field(i).Name
		fieldValue := sourceValue.Field(i)

		// 如果指定了需要更新的字段且当前字段不在列表中，则跳过
		if len(fieldsMap) > 0 && !fieldsMap[fieldName] {
			continue
		}

		// 查找目标结构体中同名的字段
		targetField, found := targetType.FieldByName(fieldName)
		if !found {
			continue // 目标结构体没有该字段则跳过
		}

		// 检查类型是否匹配
		sourceFieldType := sourceType.Field(i).Type
		targetFieldType := targetField.Type

		// 如果类型不匹配，尝试简单转换
		if sourceFieldType != targetFieldType {
			// 其他类型不匹配情况跳过
			continue
		}

		// 设置目标结构体的字段值
		targetValue.FieldByName(fieldName).Set(fieldValue)
	}

	return nil
}

// SnakeToCamel 将下划线命名转换为驼峰命名
func SnakeToCamel(s string) string {
	parts := strings.Split(s, "_")
	for i := 1; i < len(parts); i++ {
		parts[i] = strings.Title(parts[i])
	}
	return strings.Join(parts, "")
}

// FieldsToUpdate 函数用于从请求中提取需要更新的字段列表
func FieldsToUpdate(c *fiber.Ctx, obj interface{}, allowedFields []string) ([]string, error) {
	// 1. 解析请求体到map
	var requestData map[string]interface{}
	if err := json.Unmarshal(c.Body(), &requestData); err != nil {
		return nil, err
	}

	// 2. 构建字段名映射表（JSON标签名->结构体字段名）
	fieldMap := make(map[string]string)
	if obj != nil {
		t := reflect.TypeOf(obj)
		if t.Kind() == reflect.Ptr {
			t = t.Elem()
		}

		for i := 0; i < t.NumField(); i++ {
			field := t.Field(i)
			jsonTag := field.Tag.Get("json")
			if jsonTag == "" {
				continue
			}
			// 处理json标签中的逗号选项（如 `json:"name,omitempty"`）
			jsonName := strings.Split(jsonTag, ",")[0]
			if jsonName != "" {
				fieldMap[jsonName] = field.Name
			}
		}
	}

	// 3. 准备白名单映射
	allowedMap := make(map[string]bool)
	for _, field := range allowedFields {
		allowedMap[field] = true
	}

	// 4. 收集需要更新的字段
	var fieldsToUpdate []string
	for jsonName := range requestData {
		// 查找对应的结构体字段名
		structFieldName := ""
		if mappedName, exists := fieldMap[jsonName]; exists {
			structFieldName = mappedName
		} else {
			continue
		}

		// 检查是否在白名单中（如果白名单不为空）
		if len(allowedMap) == 0 || allowedMap[structFieldName] {
			fieldsToUpdate = append(fieldsToUpdate, structFieldName)
		}
	}

	return fieldsToUpdate, nil
}

type FilterMapFieldsOptions struct {
	Whitelist []string
	Blacklist []string
}

// FilterMapFields 过滤 map 中的字段
// data: 要过滤的 fiber.Map 或 map[string]interface{}
// options: 过滤选项
//   - Whitelist: 白名单，只保留这些字段（优先级高于黑名单）
//   - Blacklist: 黑名单，移除这些字段
//
// 返回过滤后的新 map
func FilterMapFields(data fiber.Map, options FilterMapFieldsOptions) fiber.Map {
	result := make(fiber.Map)

	// 预处理名单为 map 方便查找
	whitelist := make(map[string]bool)
	for _, field := range options.Whitelist {
		whitelist[field] = true
	}

	blacklist := make(map[string]bool)
	for _, field := range options.Blacklist {
		blacklist[field] = true
	}

	// 遍历原始数据
	for key, value := range data {
		fieldName := key

		// 白名单优先检查
		if len(options.Whitelist) > 0 {
			if !whitelist[fieldName] {
				continue // 不在白名单中则跳过
			}
		} else if len(options.Blacklist) > 0 {
			if blacklist[fieldName] {
				continue // 在黑名单中则跳过
			}
		}

		result[key] = value
	}

	return result
}
