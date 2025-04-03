package controller

import (
	"context"
	"errors"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/models"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/utils"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type accountAddPostParams struct {
	Email    string `json:"email" validate:"email,required"`
	NickName string `json:"nick_name" validate:"max=50"`
	Password string `json:"password" validate:"required"`
	Role     int    `json:"role" validate:"oneof=0 50 99"`
}

type accountModifyPostParams struct {
	Email    string `json:"email" validate:"omitempty,email"`
	NickName string `json:"nick_name" validate:"max=50"`
	Role     int    `json:"role" validate:"oneof=0 50 99"`
}

func getAccountByIdOrEmail(collect *mongo.Collection, id string) (*models.Account, error) {
	var account models.Account
	var filter bson.M
	if id != "" {
		objId, err := bson.ObjectIDFromHex(id)
		if err == nil {
			filter = bson.M{"_id": objId}
		} else {
			filter = bson.M{
				"$or": []bson.M{
					{"email": id},
					{"_id": objId},
				},
			}
		}
	} else {
		return nil, exceptions.AccountNotExistsError
	}

	err := collect.FindOne(context.Background(), filter).Decode(&account)
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
	var accounts []models.Account

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")
	cursor, err := accountsCollection.Find(context.Background(), bson.M{})
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
	id := c.Params("id")

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")

	account, err := getAccountByIdOrEmail(accountsCollection, id)
	if err != nil {
		return err
	}

	_, err = accountsCollection.DeleteOne(context.Background(), bson.M{"_id": account.ID})
	if err != nil {
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, account.ID)
}

func BindAccountAPIRoutes(root fiber.Router) {
	root.Get("/list", AccountListView)
	root.Post("/", AccountAddView)
	root.Get("/:id", AccountGetView)
	root.Put("/:id", AccountEditView)
	root.Delete("/:id", AccountDeleteView)
}
