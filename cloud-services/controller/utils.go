package controller

import (
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

func utilsParseRequestData(c *fiber.Ctx, formData interface{}) error {
	if err := c.BodyParser(formData); err != nil {
		return fmt.Errorf("%w: %s", exceptions.ParseJSONError, err)
	}
	valid := c.Locals("validator").(*validator.Validate)
	err := valid.Struct(formData)
	if err != nil {
		return exceptions.ParamsValidatorError.WithValidatorError(c, err)
	}
	return nil
}
