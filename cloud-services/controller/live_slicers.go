package controller

import (
	"context"
	"errors"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/constants"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
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

type updateLiveSlicerParams struct {
	Mid  string `json:"mid" validate:"required" example:"B站ID"`
	Name string `json:"name" validate:"required" example:"B站用户名"`
	Face string `json:"face" validate:"required" example:"B站用户头像地址"`
}

// GetLiveSlicerMenList 返回切片Man列表
// @Summary 【公共】返回切片Man列表
// @Description 返回直播切片Man列表，公共方法无需鉴权
// @Tags Lyric
// @Param keyword query string false "关键词" default(1)
// @Param page query int64 false "页码" default(1)
// @Param limit query int64 false "每页数量" default(20)
// @Produce json
// @Success 200 {object} []models.LiveSlicerMan "返回切片Man列表"
// @Router       /api/live_slicer_men/list [get]
func GetLiveSlicerMenList(c *fiber.Ctx) error {
	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	slicerMenCollect := mongoCli.Collection("live_slicer_men")

	filter := bson.M{}
	page, err := strconv.ParseInt(c.Query("page"), 10, 64)
	if err != nil {
		page = 1
	}
	pageSize, err := strconv.ParseInt(c.Query("limit"), 10, 64)
	if err != nil {
		pageSize = 20
	}
	if c.Query("keyword") != "" {
		filter = bson.M{"name": bson.Regex{Pattern: c.Query("keyword"), Options: "i"}}
	}

	total, err := slicerMenCollect.CountDocuments(context.Background(), filter)
	if err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}

	slicerMen := make([]models.LiveSlicerMan, 0)
	skip := (page - 1) * pageSize
	opt := options.Find().SetSkip(skip).SetLimit(pageSize).SetSort(bson.M{"_id": -1})
	cursor, err := slicerMenCollect.Find(context.Background(), filter, opt)
	if err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}
	defer cursor.Close(context.Background())

	if err = cursor.All(context.Background(), &slicerMen); err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, fiber.Map{
		"list": slicerMen,
		"pager": fiber.Map{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// UpdateLiveSlicerMan 管理：新增或更新切片Man信息
// @Summary 【管理】新增/更新切片Man信息
// @Description 新增或更新切片Man信息
// @Tags Lyric
// @Param id path string true "ObjectId"
// @Accept json
// @Param formData body updateLyricParams true  "歌词信息"
// @Produce json
// @Success 200 {object} models.Lyric "返回歌词信息"
// @Router       /api/live_slicer_men/manage/{id} [post]
func UpdateLiveSlicerMan(c *fiber.Ctx) error {
	//权限检查
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}
	formData := updateLiveSlicerParams{}
	if err := utilsParseRequestData(c, &formData); err != nil {
		return err
	}

	id := c.Params("id")

	filter := bson.M{"mid": formData.Mid}
	if id != "" {
		objId, err := bson.ObjectIDFromHex(id)
		if err == nil {
			filter = bson.M{"_id": objId}
		}
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)()
	slicerMenCollect := mongoCli.Collection("live_slicer_men")

	var liveSlicerMan models.LiveSlicerMan
	err := slicerMenCollect.FindOne(context.Background(), filter).Decode(&liveSlicerMan)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			liveSlicerMan = models.LiveSlicerMan{
				ID:         bson.NewObjectID(),
				Mid:        formData.Mid,
				Name:       formData.Name,
				Face:       formData.Face,
				UpdateTime: time.Now().Unix(),
			}
			if _, err = slicerMenCollect.InsertOne(context.Background(), &liveSlicerMan); err != nil {
				log.Error(err)
				return exceptions.MongoDBError
			}
		} else {
			log.Error(err)
			return exceptions.MongoDBError
		}
	} else {
		// 检查需要更新的字段
		updatedFields, err := utils.FieldsToUpdate(c, formData, []string{"Name", "Face"})
		if err != nil {
			return err
		}
		// 更新
		err = utils.ShallowMergeStructFields(formData, &liveSlicerMan, updatedFields)
		if err != nil {
			return err
		}
		liveSlicerMan.UpdateTime = time.Now().Unix()
		if _, err = slicerMenCollect.ReplaceOne(context.Background(), bson.M{"_id": liveSlicerMan.ID}, &liveSlicerMan); err != nil {
			log.Error(err)
			return exceptions.MongoDBError
		}
	}

	return models.NewJSONResponse(c, liveSlicerMan)
}

// DeleteLiveSlicerMan 管理：删除切片man数据
// @Summary 【管理】删除切片man数据
// @Description 删除切片man数据
// @Tags Lyric
// @Param id path string true "ObjectId"
// @Produce json
// @Success 200 {object} string "返回操作成功的ID"
// @Router        /api/live_slicer_men/manage/{id} [delete]
func DeleteLiveSlicerMan(c *fiber.Ctx) error {
	if err := utilCheckPermissionOfSession(c, constants.AccountRoleWebMaster|constants.AccountRoleAdmin); err != nil {
		return err
	}
	var filter bson.M
	id := c.Params("id")
	objId, err := bson.ObjectIDFromHex(id)
	if err == nil {
		filter = bson.M{"_id": objId}
	}

	mongoCli := c.Locals("mongodb").(func() *mongo.Database)() // 获取 MongoDB 客户端"
	slicerMenCollect := mongoCli.Collection("live_slicer_men")

	var liveSlicerMan models.LiveSlicerMan
	err = slicerMenCollect.FindOne(context.Background(), filter).Decode(&liveSlicerMan)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return exceptions.LiveSlicerManNotExistsError
		}
		log.Error(err)
		return exceptions.MongoDBError
	}

	if _, err = slicerMenCollect.DeleteOne(context.Background(), filter); err != nil {
		log.Error(err)
		return exceptions.MongoDBError
	}

	return models.NewJSONResponse(c, liveSlicerMan.ID.Hex())
}

func BindLiveSlicersAPIRoutes(root fiber.Router) {
	root.Get("/list", GetLiveSlicerMenList)
	root.Post("/:id?", UpdateLiveSlicerMan)
	root.Delete("/:id", DeleteLiveSlicerMan)
}
