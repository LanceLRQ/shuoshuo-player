package server

import (
	"context"
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/controller"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/middlewares"
	"github.com/go-playground/locales/zh"
	ut "github.com/go-playground/universal-translator"
	"github.com/go-playground/validator/v10"
	zhTranslations "github.com/go-playground/validator/v10/translations/zh"
	"github.com/gofiber/contrib/swagger"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	log "github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
	"runtime/debug"
	"strings"
	"time"
)

// @title 说说播放器服务端
// @version 1.0
// @description 说说播放器云端支持服务

// @termsOfService	https://github.com/LanceLRQ/shuoshuo-player
// @contact.name   	API Support
// @contact.url    	https://github.com/LanceLRQ/shuoshuo-player/issues
// @contact.email  	lancelrq@gmail.com
// @license.name 	MIT
// @license.url		https://github.com/LanceLRQ/shuoshuo-player/blob/master/LICENSE
// @host 			localhost:10175
// @BasePath 		/api

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name Authorization

var MongoDBConnectRetryMax int = 5

// StartHttpServer 启动服务器
func StartHttpServer(cfg *configs.ServerConfigStruct) error {
	app := fiber.New(fiber.Config{
		ErrorHandler: middlewares.AppErrorHandler,
	})

	// 连接 MongoDB
	mongoClosing := false
	mongoClient, err := StartMongoDBConnection(cfg, false)
	if err != nil {
		return err
	}
	// 当前函数退出时，自动关闭 MongoDB 连接
	defer func() {
		mongoClosing = true
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err = mongoClient.Disconnect(ctx); err != nil {
			panic(err)
		}
	}()
	// 监控Mongodb进程断线重连
	go func() {
		for !mongoClosing {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			err = mongoClient.Ping(ctx, readpref.Primary())
			cancel()
			if err != nil {
				fmt.Println("[MongoDB]连接断开，5秒后重连")
				retry := 0
				for retry < MongoDBConnectRetryMax {
					time.Sleep(5 * time.Second) // 等待一段时间后重连
					fmt.Printf("[MongoDB]正在进行第%d次重试...", retry)
					client, err := StartMongoDBConnection(cfg, true)
					if err != nil {
						fmt.Printf("失败。\n%s\n", err.Error())
						retry++
						if retry >= MongoDBConnectRetryMax {
							panic(err)
						}
					} else {
						fmt.Println("成功")
						mongoClient = client
						break
					}
				}
			} else {
				time.Sleep(1 * time.Second)
			}
		}
	}()

	// 使用 CORS 中间件
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",                              // 允许的域名
		AllowMethods: "GET,POST,HEAD,PUT,DELETE,PATCH", // 允许的 HTTP 方法
		AllowHeaders: "Origin, Content-Type, Accept",   // 允许的请求头
	}))

	// 注册验证器
	valid := validator.New()
	// 设置中文翻译器
	translate := zh.New()
	uni := ut.New(translate, translate)
	trans, _ := uni.GetTranslator("zh")
	// 注册默认中文翻译
	_ = zhTranslations.RegisterDefaultTranslations(valid, trans)

	// 注册全局validator
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("validator", valid)
		c.Locals("config", cfg)
		c.Locals("validator_trans", trans)
		c.Locals("mongodb", func() *mongo.Database {
			return mongoClient.Database(cfg.MongoDB.DBName) // 始终返回最新的 client
		})
		// Usage:
		//	mongoCli := c.Locals("mongodb").(func() *mongo.Database)
		//	fmt.Println(mongoCli())
		return c.Next()
	})

	// 初始化logger
	releaseLogFile, err := initServerLogger(cfg)
	if err != nil {
		return err
	}
	defer releaseLogFile()

	// recover中间件
	app.Use(recover.New(recover.Config{
		StackTraceHandler: func(c *fiber.Ctx, e interface{}) {
			log.Errorf("[Server] %s\n%s\n", e.(error).Error(), debug.Stack())
			return
		},
		EnableStackTrace: true,
	}))

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Shuoshuo Player Cloud Services.")
	})

	if cfg.Debug {
		// Swagger禁用缓存中间件
		app.Use(func(c *fiber.Ctx) error {
			if strings.HasPrefix(c.Path(), "/dev/docs") {
				c.Set("Cache-Control", "no-cache, no-store, must-revalidate")
				c.Set("Pragma", "no-cache")
				c.Set("Expires", "0")
			}
			return c.Next()
		})

		// 注册swagger页面
		app.Use(swagger.New(swagger.Config{ // custom
			BasePath: "/dev",
			FilePath: "./docs/swagger.json",
			Path:     "docs",
		}))

		// 注册debug页面
		controller.BindDebuggerRoutes(app, cfg)
	}

	// 注册需要认证的接口
	apiRouter := app.Group("/api")

	// 注册路由
	controller.BindPublicAPIRoutes(apiRouter)
	controller.BindAccountAPIRoutes(apiRouter.Group("/accounts", middlewares.LoginRequired(cfg), middlewares.WithLoginAccount))
	controller.BindLyricAPIRoutes(apiRouter.Group("/lyric/manage", middlewares.LoginRequired(cfg), middlewares.WithLoginAccount))
	controller.BindLiveSlicersAPIRoutes(apiRouter.Group("/live_slicer_men/manage", middlewares.LoginRequired(cfg), middlewares.WithLoginAccount))

	if cfg.Debug {
		fmt.Println("[DEBUG] 调试模式已开启")
		fmt.Printf("[DEBUG] Swagger文档访问：http://%s/dev/docs \n", strings.Replace(cfg.Listen, "0.0.0.0", "localhost", -1))
	}

	err = app.Listen(cfg.Listen)

	return err
}

func StartMongoDBConnection(cfg *configs.ServerConfigStruct, silence bool) (*mongo.Client, error) {
	// 连接MongoDB数据库

	conn := fmt.Sprintf(
		"mongodb://%s:%s@%s:%d/%s?authSource=admin",
		cfg.MongoDB.User,
		cfg.MongoDB.Password,
		cfg.MongoDB.Host,
		cfg.MongoDB.Port,
		cfg.MongoDB.DBName,
	)
	if !silence {
		fmt.Printf(
			"[MongoDB] 连接 mongodb://%s:%s@%s:%d/%s?authSource=admin\n",
			cfg.MongoDB.User,
			"******",
			cfg.MongoDB.Host,
			cfg.MongoDB.Port,
			cfg.MongoDB.DBName,
		)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	client, err := mongo.Connect(options.Client().ApplyURI(conn))
	if err != nil {
		return nil, err
	}
	err = client.Ping(ctx, readpref.Primary())
	if err != nil {
		return nil, err
	}
	return client, nil
}
