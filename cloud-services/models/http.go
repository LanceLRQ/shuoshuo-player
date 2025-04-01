package models

import "github.com/gofiber/fiber/v2"

func NewJSONResponse(c *fiber.Ctx, data interface{}) error {
	return c.JSON(fiber.Map{
		"code":    0,
		"payload": data,
	})
}
