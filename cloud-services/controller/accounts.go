package controller

import (
	"context"
	"errors"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/constants"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/middlewares"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/models"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/utils"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type accountAddPostParams struct {
	Email    string `json:"email" validate:"email,required"`
	NickName string `json:"nick_name" validate:"max=50"`
	Password string `json:"password" validate:"required"`
	Role     int    `json:"role" validate:"oneof=0 512 1024"`
}

type accountModifyPostParams struct {
	Email    string `json:"email" validate:"omitempty,email"`
	NickName string `json:"nick_name" validate:"max=50"`
	Password string `json:"password"`
	Role     int    `json:"role" validate:"oneof=0 512 1024"`
}

type accountUpdatePasswordParams struct {
	OldPassword string `json:"old_password" validate:"required" example:"旧密码"`
	Password    string `json:"password" validate:"required" example:"新密码"`
}

func getAccountByIdOrEmail(collect *mongo.Collection, id string) (*models.Account, error) {
	var account models.Account
	filter := bson.M{"email": id}
	if id != "" {
		objId, err := bson.ObjectIDFromHex(id)
		if err == nil {
			filter = bson.M{"_id": objId}
		}
	} else {
		return nil, exceptions.AccountNotExistsError
	}

	opt := options.FindOne().SetProjection(bson.M{"password": 0})
	err := collect.FindOne(context.Background(), filter, opt).Decode(&account)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, exceptions.AccountNotExistsError
		} else {
			log.Error(err)
			return nil, exceptions.MongoDBError
		}
	}
	return &account, nil
}

// AccountListView 获取用户列表
// @Summary 获取用户列表
// @Description 获取所有用户的信息列表
// @Tags Accounts
// @Accept json
// @Produce json
// @Success 200 {object} []models.Account "返回所有账户信息列表"
// @Router       /api/accounts/list [get]
func AccountListView(c *fiber.Ctx) error {
	//权限检查
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}

	accounts := make([]models.Account, 0)

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")
	opt := options.Find().SetProjection(bson.M{"password": 0})
	cursor, err := accountsCollection.Find(context.Background(), bson.M{}, opt)
	if err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}
	defer cursor.Close(context.Background())

	if err = cursor.All(context.Background(), &accounts); err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, accounts)
}

// AccountGetView 获取用户信息
// @Summary 获取用户信息
// @Description 获取用户的信息
// @Tags Accounts
// @Accept json
// @Produce json
// @Param id path string true "用户ID或者用户Email"
// @Success 200 {object} models.Account "返回账户信息"
// @Router       /api/accounts/{id} [get]
func AccountGetView(c *fiber.Ctx) error {
	//权限检查
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")

	id := c.Params("id")
	account, err := getAccountByIdOrEmail(accountsCollection, id)
	if err != nil {
		return err
	}

	return models.NewJSONResponse(c, account)
}

// AccountAddView 新增用户
// @Summary 新增用户
// @Tags Accounts
// @Accept json
// @Produce json
// @Param formData body accountAddPostParams true "用户信息"
// @Success 200 {object} models.Account "返回新账户信息"
// @Router       /api/accounts [post]
func AccountAddView(c *fiber.Ctx) error {
	//权限检查
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}

	formData := accountAddPostParams{}
	if err := utilsParseRequestData(c, &formData); err != nil {
		return err
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")
	var existAccount models.Account
	err := accountsCollection.FindOne(context.Background(), bson.M{"email": formData.Email}).Decode(&existAccount)
	if err != nil {
		if !errors.Is(err, mongo.ErrNoDocuments) {
			return err
		}
	} else {
		return exceptions.AccountEmailExistsError
	}

	passwordHashed, err := utils.CreatePasswordHash(formData.Password)
	if err != nil {
		return err
	}
	account := &models.Account{
		ID:       bson.NewObjectID(),
		Email:    formData.Email,
		NickName: formData.NickName,
		Password: passwordHashed,
		Role:     formData.Role,
	}

	_, err = accountsCollection.InsertOne(context.Background(), &account)
	if err != nil {
		return err
	}
	return models.NewJSONResponse(c, account)
}

// AccountEditView 修改用户
// @Summary 修改用户信息
// @Tags Accounts
// @Accept json
// @Produce json
// @Param formData body accountModifyPostParams true "用户信息"
// @Success 200 {object} models.Account "返回新账户信息"
// @Router       /api/accounts/{id} [put]
func AccountEditView(c *fiber.Ctx) error {
	//权限检查
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}

	id := c.Params("id")

	formData := accountModifyPostParams{}
	if err := utilsParseRequestData(c, &formData); err != nil {
		return err
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")

	account, err := getAccountByIdOrEmail(accountsCollection, id)
	if err != nil {
		return err
	}

	session := c.Locals("session").(*middlewares.LoginSession)
	// 不能管理同级别或者更高级别的其他用户
	if session.Account.ID != account.ID && session.Account.Role <= account.Role {
		return exceptions.LoginAccountPermissionDeniedError
	}

	// 检查需要更新的字段
	updatedFields, err := utils.FieldsToUpdate(c, formData, []string{"Email", "NickName", "Role"})
	if err != nil {
		return err
	}

	// 更新账户信息
	err = utils.ShallowMergeStructFields(formData, account, updatedFields)
	if err != nil {
		return err
	}

	if formData.Password != "" {
		hashedPassword, err := utils.CreatePasswordHash(formData.Password)
		if err != nil {
			return exceptions.InternalServerError
		}
		account.Password = hashedPassword
	}

	// 更新数据库中的账户信息
	filter := bson.M{"_id": account.ID}
	update := bson.D{{"$set", account}}
	_, err = accountsCollection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, account)
}

// AccountDeleteView 删除用户
// @Summary 删除用户
// @Tags Accounts
// @Accept json
// @Produce json
// @Success 200 {object} string "被删除用户的ID"
// @Router       /api/accounts/{id} [delete]
func AccountDeleteView(c *fiber.Ctx) error {
	//权限检查
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}

	id := c.Params("id")

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")

	account, err := getAccountByIdOrEmail(accountsCollection, id)
	if err != nil {
		return err
	}

	session := c.Locals("session").(*middlewares.LoginSession)
	// 禁止自删除
	if session.Account.ID.Hex() == account.ID.Hex() {
		return exceptions.LoginAccountCannotDeleteSelfError
	}
	// 不能管理比自己高级别的用户
	if session.Account.Role < account.Role {
		return exceptions.LoginAccountPermissionDeniedError
	}

	_, err = accountsCollection.DeleteOne(context.Background(), bson.M{"_id": account.ID})
	if err != nil {
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, account.ID.Hex())
}

// AccountUpdatePasswordView 更新当前用户的密码
// @Summary 更新当前用户的密码
// @Tags Accounts
// @Accept json
// @Produce json
// @Param formData body accountUpdatePasswordParams true "用户信息"
// @Success 200 {object} string "当前用户的ID"
// @Router       /api/accounts/password [post]
func AccountUpdatePasswordView(c *fiber.Ctx) error {
	formData := accountUpdatePasswordParams{}
	if err := utilsParseRequestData(c, &formData); err != nil {
		return err
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")

	session := c.Locals("session").(*middlewares.LoginSession)
	if err := session.GetAccount(c); err != nil {
		return err
	}
	account := session.Account

	if !utils.CheckPasswordHash(account.Password, formData.OldPassword) {
		return exceptions.LoginAccountNotExistsOrPasswordWrong
	}

	np, err := utils.CreatePasswordHash(formData.Password)
	if err != nil {
		return exceptions.InternalServerError
	}

	account.Password = np

	_, err = accountsCollection.ReplaceOne(context.Background(), bson.M{"_id": account.ID}, &account)
	if err != nil {
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, account.ID.Hex())
}

func BindAccountAPIRoutes(root fiber.Router) {
	root.Get("/list", AccountListView)
	root.Post("/password", AccountUpdatePasswordView)
	root.Post("/", AccountAddView)
	root.Get("/:id", AccountGetView)
	root.Put("/:id", AccountEditView)
	root.Delete("/:id", AccountDeleteView)
}
