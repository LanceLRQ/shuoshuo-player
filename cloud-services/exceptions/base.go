package exceptions

import (
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

// AppError App服务异常信息
// code为状态码，errno为这次异常对应的识别代码
// payload 为可选的内容，一般不返回
type AppError struct {
	Code    int         `json:"code"`
	Errno   int         `json:"errno,omitempty"`
	Message string      `json:"message"`
	Payload interface{} `json:"payload,omitempty"`
}

func (e *AppError) Error() string {
	return e.Message
}

func (e *AppError) WithPayload(payload interface{}) *AppError {
	return &AppError{
		Code:    e.Code,
		Errno:   e.Errno,
		Message: e.Message,
		Payload: payload,
	}
}

func (e *AppError) WithValidatorError(err error) *AppError {
	if vErrs, ok := err.(validator.ValidationErrors); ok {
		vMsg := make([]string, 0, 1)
		for _, vErr := range vErrs {
			vMsg = append(vMsg, vErr.Error())
		}
		return &AppError{
			Code:    e.Code,
			Errno:   e.Errno,
			Message: e.Message,
			Payload: struct {
				Errors []string `json:"errors"`
			}{
				Errors: vMsg,
			},
		}
	}
	return e
}

// NewAppServerError 创建一个AppError(500)
func NewAppServerError(errno int, message string) *AppError {
	err := &AppError{
		Code:    fiber.StatusInternalServerError,
		Errno:   errno,
		Message: message,
	}
	return err
}

// NewAppRequestError 创建一个AppError(400)
func NewAppRequestError(errno int, message string) *AppError {
	err := &AppError{
		Code:    fiber.StatusBadRequest,
		Errno:   errno,
		Message: message,
	}
	return err
}
