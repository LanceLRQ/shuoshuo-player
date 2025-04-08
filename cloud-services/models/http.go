package models

import (
	"reflect"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func NewJSONResponse(c *fiber.Ctx, data interface{}) error {
	return c.JSON(fiber.Map{
		"code":    0,
		"payload": data,
	})
}

// NewJSONResponseExcludeFields 创建JSON响应，支持字段过滤
// data: 要返回的数据
// excludeFields: 要排除的字段名列表（基于json标签）
func NewJSONResponseExcludeFields(c *fiber.Ctx, data interface{}, excludeFields []string) error {
	// 过滤字段
	filteredData := filterFields(data, excludeFields)

	return c.JSON(fiber.Map{
		"code":    0,
		"payload": filteredData,
	})
}

// filterFields 根据json标签过滤结构体字段
func filterFields(data interface{}, excludeFields []string) interface{} {
	val := reflect.ValueOf(data)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	// 如果不是结构体，直接返回
	if val.Kind() != reflect.Struct {
		return data
	}

	typ := val.Type()
	result := make(map[string]interface{})

	for i := 0; i < val.NumField(); i++ {
		field := typ.Field(i)
		jsonTag := field.Tag.Get("json")
		if jsonTag == "" || jsonTag == "-" {
			continue
		}

		// 获取json标签中的字段名（去掉omitempty等选项）
		fieldName := strings.Split(jsonTag, ",")[0]

		// 检查是否在排除列表中
		shouldExclude := false
		for _, exclude := range excludeFields {
			if strings.TrimSpace(exclude) == fieldName {
				shouldExclude = true
				break
			}
		}

		if !shouldExclude {
			result[fieldName] = val.Field(i).Interface()
		}
	}

	return result
}
