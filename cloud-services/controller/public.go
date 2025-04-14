package controller

import (
	"context"
	"errors"
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/middlewares"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/models"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	log "github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"strings"
	"time"
)

type loginViewPostParams struct {
	Email    string `json:"email" validate:"email,required"`
	Password string `json:"password" validate:"required"`
}

type loginViewResponse struct {
	ID       string         `json:"id"`
	Token    string         `json:"token"`
	ExpireAt int64          `json:"expire_at"`
	Account  models.Account `json:"account"`
}

type checkLoginViewResponse struct {
	Login   bool           `json:"login"`
	Account models.Account `json:"account"`
}

// LoginView 处理登录请求
// @Summary 用户登录
// @Description 用户通过邮箱和密码登录系统
// @Tags Accounts
// @Accept json
// @Produce json
// @Param data body loginViewPostParams true "登录信息"
// @Success 200 {object} loginViewResponse "登录成功后返回token信息"
// @Router       /api/login [post]
func LoginView(c *fiber.Ctx) error {
	var account models.Account

	formData := loginViewPostParams{}
	if err := utilsParseRequestData(c, &formData); err != nil {
		return err
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")
	err := accountsCollection.FindOne(context.Background(), bson.M{
		"email": formData.Email,
	}).Decode(&account)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			// 如果不存账号，在提示用户不存在或密码错误
			return exceptions.LoginAccountNotExistsOrPasswordWrong
		} else {
			log.Error(err)
			return exceptions.MongoDBError
		}
	}

	if account.PasswordRetryCount >= 20 {
		return exceptions.LoginAccountTryLocked
	}

	wrong := false
	if !utils.CheckPasswordHash(account.Password, formData.Password) {
		account.PasswordRetryCount += 1
		wrong = true
	} else {
		account.PasswordRetryCount = 0
	}
	_, err = accountsCollection.UpdateOne(
		context.Background(),
		bson.M{"_id": account.ID},
		bson.M{
			"$set": bson.M{
				"password_retry_count": account.PasswordRetryCount,
			},
		})
	if err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}
	if wrong {
		return exceptions.LoginAccountNotExistsOrPasswordWrong
	}

	// 发放令牌
	cfg := c.Locals("config").(*configs.ServerConfigStruct)
	accountId := account.ID.Hex()
	token, expireAt, err := utils.NewJWTToken(accountId, account.PasswordSessionKey, cfg.Security.JWTSecret, time.Duration(cfg.Security.JWTExpire))
	if err != nil {
		return fmt.Errorf("%w: %s", exceptions.InternalServerError, err)
	}

	return models.NewJSONResponse(c, loginViewResponse{
		ID:       accountId,
		Token:    token,
		ExpireAt: expireAt,
		Account:  account,
	})
}

// CheckLoginView 检测是否登录
// @Summary 检测是否登录
// @Description 检测当前的鉴权信息是否有效
// @Tags Accounts
// @Accept json
// @Produce json
// @Success 200 {object} checkLoginViewResponse "用户登录状态信息"
// @Router       /api/login [get]
func CheckLoginView(c *fiber.Ctx) error {
	tokenText := c.Get("Authorization")
	if tokenText != "" {
		if strings.Index(tokenText, "Bearer ") == 0 {
			tokenText = strings.TrimPrefix(tokenText, "Bearer ")
		}
		cfg := c.Locals("config").(*configs.ServerConfigStruct)
		token := utils.ParseJWTToken(tokenText, cfg.Security.JWTSecret)
		if token != nil {
			claims := token.Claims.(jwt.MapClaims)
			accountId, ok := claims["account_id"].(string)
			if ok && accountId != "" {
				session := &middlewares.LoginSession{
					AccountId:  accountId,
					JwtPayload: claims,
				}
				err := session.GetAccount(c)
				if err == nil {
					return models.NewJSONResponse(c, checkLoginViewResponse{
						Login:   true,
						Account: *session.Account,
					})
				}
			}
		}
	}
	return models.NewJSONResponse(c, checkLoginViewResponse{
		Login: false,
	})
}

func BindPublicAPIRoutes(apiRoot fiber.Router) {
	apiRoot.Get("/login", CheckLoginView)
	apiRoot.Post("/login", LoginView)
	apiRoot.Get("/lyric/:bvid", GetLyricByBvid)
}
