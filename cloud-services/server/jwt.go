package server

import (
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"strconv"
	"time"
)

// NewJWTToken 创建JWT令牌
func NewJWTToken(accountId int64, cfg *configs.ServerConfigStruct) (string, int64, error) {
	factory := jwt.New(jwt.SigningMethodHS256)

	expireAt := time.Now().Add(time.Duration(cfg.Security.JWTExpire) * time.Hour).Unix()

	claims := factory.Claims.(jwt.MapClaims)
	claims["account_id"] = strconv.FormatInt(accountId, 10)
	claims["exp"] = expireAt
	claims["iss"] = "sso@example.com"
	claims["nbf"] = time.Now().Unix()
	claims["iat"] = claims["nbf"]
	claims["sub"] = "login"
	claims["aud"] = "web"

	token, err := factory.SignedString([]byte(cfg.Security.JWTSecret))
	if err != nil {
		return "", 0, err
	}
	return "Bearer " + token, expireAt, nil
}

// ValidJWTToken 校验JWT令牌
func ValidJWTToken(token string, cfg *configs.ServerConfigStruct) bool {
	ret, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		return []byte(cfg.Security.JWTSecret), nil
	})
	if err != nil {
		return false
	}
	return ret.Valid
}

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
