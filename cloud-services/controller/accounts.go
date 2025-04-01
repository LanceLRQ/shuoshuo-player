package controller

import (
	"context"
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/models"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/utils"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"time"
)

type loginViewPostParams struct {
	Email    string `json:"email" validate:"email,required"`
	Password string `json:"password" validate:"required"`
}

type loginViewResponse struct {
	ID       string `json:"id"`
	Token    string `json:"token"`
	ExpireAt int64  `json:"expire_at"`
}

// LoginView 处理登录请求
// @Summary 用户登录
// @Description 用户通过邮箱和密码登录系统
// @Tags Accounts
// @Accept json
// @Produce json
// @Param body body loginViewPostParams true "登录信息"
// @Success 200 {object} loginViewResponse "登录成功后返回token信息"
// @Router       /api/accounts/login [post]
func LoginView(c *fiber.Ctx) error {
	var account models.Account

	formData := loginViewPostParams{}
	if err := c.BodyParser(&formData); err != nil {
		return fmt.Errorf("%w: %s", exceptions.ParseJSONError, err)
	}
	valid := c.Locals("validator").(*validator.Validate)
	err := valid.Struct(&formData)
	if err != nil {
		return exceptions.ParamsValidatorError.WithValidatorError(c, err)
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")
	cursor, err := accountsCollection.Find(context.Background(), bson.M{
		"email": formData.Email,
	})
	if err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}
	defer cursor.Close(context.Background())

	r := cursor.Next(context.Background())
	if r {
		err := cursor.Decode(&account)
		if err != nil {
			log.Error(err)
			return exceptions.MongoDBError
		}
	} else {
		// 如果不存账号，在提示用户不存在或密码错误
		return exceptions.LoginAccountNotExistsOrPasswordWrong
	}

	if !utils.CheckPasswordHash(account.Password, formData.Password) {
		return exceptions.LoginAccountNotExistsOrPasswordWrong
	}

	// 发放令牌
	cfg := c.Locals("config").(*configs.ServerConfigStruct)
	accountId := account.ID.String()
	token, expireAt, err := utils.NewJWTToken(accountId, cfg.Security.JWTSecret, time.Duration(cfg.Security.JWTExpire))
	if err != nil {
		return fmt.Errorf("%w: %s", exceptions.InternalServerError, err)
	}

	return models.NewJSONResponse(c, loginViewResponse{
		ID:       accountId,
		Token:    token,
		ExpireAt: expireAt,
	})
}

func BindAccountAPIRoutes(root fiber.Router, handler fiber.Handler) {
	root.Post("/login", LoginView)
}
