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
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"time"
)

type updateLyricParams struct {
	Content string `json:"content" validate:"required"`
}

func GetLyricByBvid(c *fiber.Ctx) error {
	bvid := c.Params("bvid")

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	lyricsCollect := mongoCli.Collection("lyrics")

	var lyric models.Lyric
	opt := options.FindOne().SetProjection(bson.M{"_id": 0}) // 不返回 _id 字段
	err := lyricsCollect.FindOne(context.Background(), bson.M{"bvid": bvid}, opt).Decode(&lyric)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return exceptions.LyricNotExistsError
		}
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, lyric)
}

// GetLyricList 管理：获取数据库中所有的歌词列表
func GetLyricList(c *fiber.Ctx) error {

	return nil
}

// GetLyricSnapshots 管理：获取当前歌词的历史版本列表
func GetLyricSnapshots(c *fiber.Ctx) error {

	return nil
}

// UpdateLyric 管理：新增或更新歌词内容
// 特例：ID可以是BVID文字或者bson.ObjectID
func UpdateLyric(c *fiber.Ctx) error {
	//权限检查
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}
	formData := updateLyricParams{}
	if err := utilsParseRequestData(c, &formData); err != nil {
		return err
	}

	id := c.Params("id")

	filter := bson.M{"bvid": id}
	objId, err := bson.ObjectIDFromHex(id)
	if err == nil {
		filter = bson.M{"_id": objId}
	}

	if formData.Content == "" {
		return exceptions.LyricContentEmptyError
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	lyricsCollect := mongoCli.Collection("lyrics")

	var lyric models.Lyric
	isCreate := false
	err = lyricsCollect.FindOne(c.Context(), filter).Decode(&lyric)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			if !utils.IsValidBVID(id) {
				return exceptions.InvalidBVIDError
			}
			isCreate = true
			lyric = models.Lyric{
				ID:         bson.NewObjectID(),
				Bvid:       id,
				Content:    formData.Content,
				CreateTime: time.Now().Unix(),
				UpdateTime: time.Now().Unix(),
			}
		} else {
			return exceptions.MongoDBError
		}
	}
	lyric.Content = formData.Content
	lyric.UpdateTime = time.Now().Unix()

	if isCreate {
		if _, err = lyricsCollect.InsertOne(context.Background(), &lyric); err != nil {
			return exceptions.MongoDBError
		}
	} else {
		if _, err = lyricsCollect.ReplaceOne(context.Background(), filter, &lyric); err != nil {
			return exceptions.MongoDBError
		}
	}

	// 创建快照
	session := c.Locals("session").(*middlewares.LoginSession)
	lyricSnapshot := models.LyricSnapshots{
		LyricId:    lyric.ID,
		AuthorId:   session.Account.ID,
		Content:    lyric.Content,
		CreateTime: lyric.UpdateTime,
	}
	lyricSnapshotsCollect := mongoCli.Collection("lyric_snapshots")
	if _, err = lyricSnapshotsCollect.InsertOne(context.Background(), &lyricSnapshot); err != nil {
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, lyric)
}

// DeleteLyric 管理：删除歌词信息
func DeleteLyric(c *fiber.Ctx) error {

	return nil
}

func BindLyricAPIRoutes(root fiber.Router) {
	root.Get("/list", GetLyricList)
	root.Get("/:id/snap", GetLyricSnapshots)
	root.Post("/:id", UpdateLyric) //
	root.Delete("/:id", DeleteLyric)
}
