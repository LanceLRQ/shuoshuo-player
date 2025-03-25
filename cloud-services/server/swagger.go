package server

import (
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/gofiber/contrib/swagger"
	"github.com/gofiber/fiber/v2"
)

func RegisterSwagger(app *fiber.App, cfg *configs.ServerConfigStruct) {
	app.Use(swagger.New(swagger.Config{ // custom
		BasePath: "/",
		FilePath: "./docs/swagger.json",
		Path:     "swagger",
		Title:    "Swagger API Docs",
	}))
}
