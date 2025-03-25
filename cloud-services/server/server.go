package server

import (
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func StartHttpServer(cfg *configs.ServerConfigStruct) error {

	app := fiber.New()
	// 使用 CORS 中间件
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",                              // 允许的域名
		AllowMethods: "GET,POST,HEAD,PUT,DELETE,PATCH", // 允许的 HTTP 方法
		AllowHeaders: "Origin, Content-Type, Accept",   // 允许的请求头
	}))

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Hello, World!")
	})

	err := app.Listen(cfg.Listen)

	return err
}
