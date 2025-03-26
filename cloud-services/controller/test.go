package controller

import (
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type PostDataParams struct {
	Title       string `json:"title" validate:"required"`
	Type        int    `json:"type" validate:"required,oneof=1 2"`
	Description string `json:"description" validate:"required"`
	Author      string `json:"author"`
}

func TestAPIController(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"message": "ok",
	})
}

func TestPostDataParse(c *fiber.Ctx) error {
	params := PostDataParams{}
	if err := c.BodyParser(&params); err != nil {
		return fmt.Errorf("%w: %s", exceptions.ParseJSONError, err)
	}

	valid := c.Locals("validator").(*validator.Validate)
	err := valid.Struct(&params)

	if err != nil {
		if _, ok := err.(*validator.InvalidValidationError); ok {
			return fmt.Errorf("%w: %s", exceptions.ParamsValidatorError, err)
		}
		return exceptions.ParamsValidatorError.WithValidatorError(err)
	}

	return c.JSON(fiber.Map{
		"message": "ok",
		"params":  params,
	})
}

func BindTestAPIRoutes(root fiber.Router) {
	root.Get("/", TestAPIController)
	root.Post("/post", TestPostDataParse)
}
