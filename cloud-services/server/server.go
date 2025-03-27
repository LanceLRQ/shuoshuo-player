package server

import (
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/controller"
	"github.com/go-playground/locales/zh"
	ut "github.com/go-playground/universal-translator"
	"github.com/go-playground/validator/v10"
	zhTranslations "github.com/go-playground/validator/v10/translations/zh"
	"github.com/gofiber/contrib/swagger"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	log "github.com/sirupsen/logrus"
	"runtime/debug"
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

// StartHttpServer 启动服务器
func StartHttpServer(cfg *configs.ServerConfigStruct) error {
	app := fiber.New(fiber.Config{
		ErrorHandler: AppErrorHandler,
	})
	// 使用 CORS 中间件
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",                              // 允许的域名
		AllowMethods: "GET,POST,HEAD,PUT,DELETE,PATCH", // 允许的 HTTP 方法
		AllowHeaders: "Origin, Content-Type, Accept",   // 允许的请求头
	}))

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

	// 注册swagger页面
	app.Use(swagger.New(swagger.Config{ // custom
		BasePath: "/dev",
		FilePath: "./docs/swagger.json",
		Path:     "docs",
	}))

	if cfg.Debug {
		// 注册debug页面
		bindDebuggerRoutes(app, cfg)
	}

	// 注册需要认证的接口，这行代码以后得所有路由访问都需要认证
	apiRouter := app.Group("/api", LoginRequired(cfg))

	// 注册路由 (TODO)
	controller.BindTestAPIRoutes(apiRouter.Group("/test"))

	err = app.Listen(cfg.Listen)

	return err
}
