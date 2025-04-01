package server

import (
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func LoginRequired(cfg *configs.ServerConfigStruct) fiber.Handler {
	return jwtware.New(jwtware.Config{
		AuthScheme:   "Bearer",
		ContextKey:   "jwt_token",
		SigningKey:   jwtware.SigningKey{Key: []byte(cfg.Security.JWTSecret)},
		ErrorHandler: jwtErrorHandler,
	})
}

func WithLoginAccount(c *fiber.Ctx) error {
	token, ok := c.Locals("jwt_token").(*jwt.Token)
	if !ok || token == nil {
		return fmt.Errorf("WithLoginAccount middlerware must be the next of LoginRequired")
	}
	claims := token.Claims.(jwt.MapClaims)
	accountId, ok := claims["account_id"].(string)
	if !ok || accountId == "" {
		// 按401处理
		return c.Status(fiber.StatusUnauthorized).JSON(jwtTokenInvalidErrMsg)
	}

	// 从数据库检索账号信息
	//account := models.Account{}
	//result := DB.First(&account, accountId)
	//if result.Error != nil {
	//	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
	//		return c.Status(fiber.StatusUnauthorized).JSON(jwtTokenInvalidErrMsg)
	//	}
	//	return fmt.Errorf("%w: %s", MySQLError, result.Error)
	//}
	// 写入account信息
	//c.Locals("account", account)

	return c.Next()
}
