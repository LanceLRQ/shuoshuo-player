package controller

import (
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/middlewares"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

// utilsParseRequestData 解析请求数据并进行验证
func utilsParseRequestData(c *fiber.Ctx, formData interface{}) error {
	if err := c.BodyParser(formData); err != nil {
		return fmt.Errorf("%w: %s", exceptions.ParseJSONError, err)
	}
	valid := c.Locals("validator").(*validator.Validate)
	err := valid.Struct(formData)
	if err != nil {
		return exceptions.ParamsValidatorError.WithValidatorError(c, err)
	}
	return nil
}

func utilCheckPermissionOfSession(c *fiber.Ctx, roleRequired int) error {
	// 获取会话
	session := c.Locals("session").(*middlewares.LoginSession)
	if err := session.GetAccount(c); err != nil {
		return err
	}
	// 检查权限
	if !session.CheckPermission(roleRequired) {
		return exceptions.LoginAccountPermissionDeniedError
	}
	return nil
}
