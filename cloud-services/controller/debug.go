package controller

import (
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/middlewares"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/utils"
	"github.com/gofiber/fiber/v2"
	"strings"
	"time"
)

// GetJWTTestToken
// @Summary      【调试】获取随机的JWT Token
// @Description  获取随机的JWT Token
// @Tags         Debug
// @Accept       json
// @Produce      json
// @Consumes     json
// @Success      200 {object} map[string]interface{}
// @Router       /debug/jwt/test [get]
func GetJWTTestToken(c *fiber.Ctx) error {
	cfg := c.Locals("config").(*configs.ServerConfigStruct)
	// 发放令牌
	accountId, _ := utils.GetSnowflakeId()
	token, expireAt, err := utils.NewJWTToken(accountId.String(), "123", cfg.Security.JWTSecret, time.Duration(cfg.Security.JWTExpire))
	if err != nil {
		return fmt.Errorf("%w: %s", exceptions.InternalServerError, err)
	}
	return c.JSON(fiber.Map{
		"Id":       accountId,
		"Token":    token,
		"ExpireAt": expireAt,
	})
}

func ValidJWTTestToken(c *fiber.Ctx) error {
	cfg := c.Locals("config").(*configs.ServerConfigStruct)
	token := c.Query("token")
	if token == "" {
		return exceptions.LoginEmptyTokenError
	}
	if strings.Index(token, "Bearer ") == 0 {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	valid := utils.ValidJWTToken(token, cfg.Security.JWTSecret)
	return c.JSON(fiber.Map{
		"valid": valid,
	})
}

func BindDebuggerRoutes(app *fiber.App, cfg *configs.ServerConfigStruct) {
	dGroup := app.Group("/debug")
	dGroup.Get("/jwt/get", GetJWTTestToken)
	dGroup.Get("/jwt/valid", ValidJWTTestToken)
	dGroup.Get("/jwt/test", middlewares.LoginRequired(cfg), func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "ok",
		})
	})
}
