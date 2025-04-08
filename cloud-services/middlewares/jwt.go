package middlewares

import (
	"context"
	"errors"
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/models"
	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	log "github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type LoginSession struct {
	AccountId  string
	Account    *models.Account
	JwtPayload jwt.MapClaims
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

	session := LoginSession{
		AccountId:  accountId,
		JwtPayload: claims,
	}

	c.Locals("session", session)

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

// GetAccount 在上下文中获取 account 信息
func (s *LoginSession) GetAccount(c *fiber.Ctx) error {
	if s.Account != nil {
		return nil
	}
	
	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")

	var account models.Account

	objId, err := bson.ObjectIDFromHex(s.AccountId)
	if err != nil {
		return exceptions.AccountNotExistsError
	}

	err = accountsCollection.FindOne(context.Background(), bson.M{"_id": objId}).Decode(&account)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return exceptions.AccountNotExistsError
		} else {
			log.Error(err)
			return exceptions.MongoDBError
		}
	}
	s.Account = &account
	return nil
}
