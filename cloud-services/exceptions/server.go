package exceptions

// Bad Request Errno Namespace: 4000xxx
// Unauthorized Errno Namespace: 4010xxx
// Server Errno Namespace: 5000xxx

var ParseJSONError = NewAppRequestError(4000000, "JSON数据解析错误")
var ParamsValidatorError = NewAppRequestError(4000001, "参数内容校验失败")
var ParseIdError = NewAppRequestError(4000002, "ID解析错误")

var LoginEmptyTokenError = NewAppRequestError(4010001, "登录令牌内容为空")
var LoginAccountNotExistsOrPasswordWrong = NewAppRequestError(4010002, "用户名或密码错误")

var InternalServerError = NewAppServerError(5000000, "内部服务器错误")
var MongoDBError = NewAppServerError(5000001, "访问数据库服务失败")

// 5010xxx: Account控制器错误相关

var AccountNotExistsError = NewAppServerError(5010001, "账户不存在")
var AccountEmailExistsError = NewAppServerError(5010002, "该邮箱已被注册")
