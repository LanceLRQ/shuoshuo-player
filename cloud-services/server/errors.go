package server

import (
	"errors"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/exceptions"
	"github.com/gofiber/fiber/v2"
)

var jwtTokenWrongErrMsg = fiber.Map{"code": "400", "message": "Missing or malformed JWT"}
var jwtTokenInvalidErrMsg = fiber.Map{"code": "401", "message": "Invalid or expired JWT"}

// AppErrorHandler that process return errors from handlers
var AppErrorHandler = func(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	var appError *exceptions.AppError
	var fiberError *fiber.Error
	c.Set(fiber.HeaderContentType, fiber.MIMETextPlainCharsetUTF8)

	if errors.As(err, &appError) {
		var err1 *exceptions.AppError
		var ok bool
		if err1, ok = err.(*exceptions.AppError); !ok {
			if err1, ok = errors.Unwrap(err).(*exceptions.AppError); ok {
				return c.Status(err1.Code).JSON(&exceptions.AppError{
					Code:    err1.Code,
					Errno:   err1.Errno,
					Message: err.Error(),
					Payload: err1.Payload,
				})
			} else {
				return c.Status(fiber.StatusInternalServerError).JSON(&exceptions.AppError{
					Code:    code,
					Errno:   -1,
					Message: err.Error(),
				})
			}
		}
		return c.Status(err1.Code).JSON(err1)
	} else if errors.As(err, &fiberError) {
		e1 := err.(*fiber.Error)
		return c.Status(e1.Code).JSON(&exceptions.AppError{
			Code:    e1.Code,
			Message: err.Error(),
		})
	}

	return c.Status(code).JSON(&exceptions.AppError{
		Code:    code,
		Message: err.Error(),
	})
}

func jwtErrorHandler(c *fiber.Ctx, err error) error {
	if err.Error() == "Missing or malformed JWT" {
		return c.Status(fiber.StatusBadRequest).JSON(jwtTokenWrongErrMsg)
	}
	return c.Status(fiber.StatusUnauthorized).JSON(jwtTokenInvalidErrMsg)
}
