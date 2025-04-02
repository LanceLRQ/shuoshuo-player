package controller

import (
	"context"
	"errors"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

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
func AccountGetView(c *fiber.Ctx) error {
	var account models.Account

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	accountsCollection := mongoCli.Collection("accounts")

	id := c.Params("id")
	var filter bson.M
	if id != "" {
		objId, err := bson.ObjectIDFromHex(id)
		if err == nil {
			filter = bson.M{"_id": objId}
		} else {
			filter = bson.M{"email": id}
		}
	} else {
		return exceptions.AccountNotExistsError
	}
	err := accountsCollection.FindOne(context.Background(), filter).Decode(&account)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return exceptions.AccountNotExistsError
		} else {
			log.Error(err)
			return exceptions.MongoDBError
		}
	}
	return models.NewJSONResponse(c, account)
}
func AccountAddView(c *fiber.Ctx) error {
	return nil
}
func AccountEditView(c *fiber.Ctx) error {
	return nil
}
func AccountDeleteView(c *fiber.Ctx) error {
	return nil
}

func BindAccountAPIRoutes(root fiber.Router) {
	root.Get("/list", AccountListView)
	root.Post("/", AccountAddView)
	root.Get("/:id", AccountGetView)
	root.Put("/:id", AccountEditView)
	root.Delete("/:id", AccountDeleteView)
}
