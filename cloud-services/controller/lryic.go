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
	"strconv"
	"time"
)

type updateLyricParams struct {
	Title   string `json:"title" validate:"required" example:"视频标题，必填"`
	Content string `json:"content" validate:"required" example:"歌词内容，必填"`
}

// GetLyricByBvid 获取歌词信息
// @Summary 【公共】获取歌词信息
// @Description 获取歌词信息，公共方法无需鉴权
// @Tags Lyric
// @Produce json
// @Success 200 {object} models.Lyric "返回歌词信息"
// @Router       /api/lyric/{bvid} [get]
func GetLyricByBvid(c *fiber.Ctx) error {
	bvid := c.Params("bvid")

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	lyricsCollect := mongoCli.Collection("lyrics")

	var lyric models.Lyric
	opt := options.FindOne().SetProjection(bson.M{"_id": 0}) // 不返回 _id 字段
	err := lyricsCollect.FindOne(context.Background(), bson.M{"bvid": bvid, "is_deleted": false}, opt).Decode(&lyric)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return exceptions.LyricNotExistsError
		}
		log.Error(err)
		return exceptions.MongoDBError
	}

	// 返回歌词内容，不返回 id 字段
	return models.NewJSONResponseExcludeFields(c, lyric, []string{"id"})
}

// GetLyricList 获取数据库中所有的歌词列表
// @Summary 【管理】歌词列表
// @Description 获取数据库中所有的歌词列表
// @Tags Lyric
// @Param page query int64 false "页码" default(1)
// @Param limit query int64 false "每页数量" default(20)
// @Produce json
// @Success 200 {object} []models.Lyric "返回歌词列表"
// @Router       /api/lyric/manage/list [get]
func GetLyricList(c *fiber.Ctx) error {
	//权限检查
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	lyricsCollect := mongoCli.Collection("lyrics")

	filter := bson.M{"is_deleted": false}
	page, err := strconv.ParseInt(c.Query("page"), 10, 64)
	if err != nil {
		page = 1
	}
	pageSize, err := strconv.ParseInt(c.Query("limit"), 10, 64)
	if err != nil {
		pageSize = 20
	}

	total, err := lyricsCollect.CountDocuments(context.Background(), filter)
	if err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}

	lyrics := make([]models.Lyric, 0)
	skip := (page - 1) * pageSize
	opt := options.Find().SetSkip(skip).SetLimit(pageSize).SetSort(bson.M{"_id": -1})
	cursor, err := lyricsCollect.Find(context.Background(), filter, opt)
	if err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}
	defer cursor.Close(context.Background())

	if err = cursor.All(context.Background(), &lyrics); err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, fiber.Map{
		"list": lyrics,
		"pager": fiber.Map{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// GetLyricSnapshots 管理：获取当前歌词的历史版本列表
// @Summary 【管理】歌词历史版本列表
// @Description 获取当前歌词的历史版本列表，只返回最新的10条。
// @Tags Lyric
// @Param id path string true "支持bvid或ObjectId"
// @Produce json
// @Success 200 {object} []models.LyricSnapshots "返回歌词历史版本列表"
// @Router       /api/lyric/manage/{id}/snap [get]
func GetLyricSnapshots(c *fiber.Ctx) error {
	//权限检查
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	lyricsCollect := mongoCli.Collection("lyrics")
	lyricSnapshotsCollect := mongoCli.Collection("lyric_snapshots")

	id := c.Params("id")

	var lyric models.Lyric
	filter := bson.M{"bvid": id}
	objId, err := bson.ObjectIDFromHex(id)
	if err == nil {
		filter = bson.M{"_id": objId}
	}
	err = lyricsCollect.FindOne(context.Background(), filter).Decode(&lyric)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return exceptions.LyricNotExistsError
		}
		log.Error(err)
		return exceptions.MongoDBError
	}
	pipeline := []bson.M{
		{"$match": bson.M{"lyric_id": lyric.ID}},
		{"$lookup": bson.M{
			"from":         "accounts",  // 关联的集合名
			"localField":   "author_id", // Lyric 中的字段
			"foreignField": "_id",       // Account 中的字段
			"as":           "author",    // 输出字段名
		}},
		{"$unwind": bson.M{
			"path":                       "$author",
			"preserveNullAndEmptyArrays": true,
		}}, // 将 author 数组展开为对象
		{"$sort": bson.M{"_id": -1}},
		{"$limit": 10},
	}
	cursor, err := lyricSnapshotsCollect.Aggregate(context.Background(), pipeline)
	if err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}
	defer cursor.Close(context.Background())

	lyricSnapshots := make([]models.LyricSnapshots, 0)
	err = cursor.All(context.Background(), &lyricSnapshots)
	if err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, lyricSnapshots)
}

// UpdateLyric 管理：新增或更新歌词内容
// @Summary 【管理】新增/更新歌词内容
// @Description 新增或更新歌词内容
// @Tags Lyric
// @Param id path string true "支持bvid或ObjectId"
// @Accept json
// @Param formData body updateLyricParams true  "歌词信息"
// @Produce json
// @Success 200 {object} models.Lyric "返回歌词信息"
// @Router       /api/lyric/manage/{id} [post]
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

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	lyricsCollect := mongoCli.Collection("lyrics")

	var lyric models.Lyric
	err = lyricsCollect.FindOne(context.Background(), filter).Decode(&lyric)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			if !utils.IsValidBVID(id) {
				return exceptions.InvalidBVIDError
			}
			lyric = models.Lyric{
				ID:         bson.NewObjectID(),
				Bvid:       id,
				Title:      formData.Title,
				Content:    formData.Content,
				CreateTime: time.Now().Unix(),
				UpdateTime: time.Now().Unix(),
				IsDeleted:  false,
			}
			if _, err = lyricsCollect.InsertOne(context.Background(), &lyric); err != nil {
				log.Error(err)
				return exceptions.MongoDBError
			}
		} else {
			log.Error(err)
			return exceptions.MongoDBError
		}
	} else {
		// 检查需要更新的字段
		updatedFields, err := utils.FieldsToUpdate(c, formData, []string{"Title", "Content"})
		if err != nil {
			return err
		}
		// 更新
		err = utils.ShallowMergeStructFields(formData, &lyric, updatedFields)
		if err != nil {
			return err
		}
		lyric.UpdateTime = time.Now().Unix()
		lyric.IsDeleted = false
		if _, err = lyricsCollect.ReplaceOne(context.Background(), bson.M{"_id": lyric.ID}, &lyric); err != nil {
			log.Error(err)
			return exceptions.MongoDBError
		}
	}

	// 创建快照
	session := c.Locals("session").(*middlewares.LoginSession)
	lyricSnapshot := models.LyricSnapshots{
		LyricId:    lyric.ID,
		AuthorId:   session.Account.ID,
		Content:    lyric.Content,
		Title:      lyric.Title,
		CreateTime: lyric.UpdateTime,
	}
	lyricSnapshotsCollect := mongoCli.Collection("lyric_snapshots")
	if _, err = lyricSnapshotsCollect.InsertOne(context.Background(), &lyricSnapshot); err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, lyric)
}

// DeleteLyric 管理：删除歌词信息(假删除)
// @Summary 【管理】删除歌词信息
// @Description 删除歌词信息，但不会真正删除，下一次更新歌词的时候会重新恢复。
// @Tags Lyric
// @Param id path string true "支持bvid或ObjectId"
// @Produce json
// @Success 200 {object} string "返回操作成功的ID"
// @Router       /api/lyric/manage/{id} [delete]
func DeleteLyric(c *fiber.Ctx) error {
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}
	id := c.Params("id")
	filter := bson.M{"bvid": id, "is_deleted": false}
	objId, err := bson.ObjectIDFromHex(id)
	if err == nil {
		filter = bson.M{"_id": objId, "is_deleted": false}
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	lyricsCollect := mongoCli.Collection("lyrics")

	var lyric models.Lyric
	err = lyricsCollect.FindOne(context.Background(), filter).Decode(&lyric)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return exceptions.LyricNotExistsError
		}
		log.Error(err)
		return exceptions.MongoDBError
	}

	lyric.IsDeleted = true
	if _, err = lyricsCollect.ReplaceOne(context.Background(), bson.M{"_id": lyric.ID}, &lyric); err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, lyric.ID.Hex())
}

func BindLyricAPIRoutes(root fiber.Router) {
	root.Get("/list", GetLyricList)
	root.Get("/:id/snap", GetLyricSnapshots)
	root.Post("/:id", UpdateLyric)
	root.Delete("/:id", DeleteLyric)
}
