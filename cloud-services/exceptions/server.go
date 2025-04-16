package exceptions

// Bad Request Errno Namespace: 4000xxx
// Unauthorized Errno Namespace: 4010xxx
// Server Errno Namespace: 5000xxx

var ParseJSONError = NewAppRequestError(4000000, "JSON数据解析错误")
var ParamsValidatorError = NewAppRequestError(4000001, "参数内容校验失败")
var ParseIdError = NewAppRequestError(4000002, "ID解析错误")

var LoginTokenExpiredError = NewAppRequestError(4010000, "登录信息失效，请重新登录")
var LoginEmptyTokenError = NewAppRequestError(4010001, "登录令牌内容为空")
var LoginAccountNotExistsOrPasswordWrong = NewAppRequestError(4010002, "用户名或密码错误")
var LoginAccountPermissionDeniedError = NewAppRequestError(4010002, "当前登录用户角色无权限访问")
var LoginAccountCannotDeleteSelfError = NewAppRequestError(4010003, "不能删除自己")
var LoginAccountTryLocked = NewAppRequestError(4010004, "错误密码尝试次数过多，账号已锁定")

var InternalServerError = NewAppServerError(5000000, "内部服务器错误")
var MongoDBError = NewAppServerError(5000001, "访问数据库服务失败")

// 5010xxx: Account控制器错误相关

var AccountNotExistsError = NewAppServerError(5010001, "账户不存在")
var AccountEmailExistsError = NewAppServerError(5010002, "该邮箱已被注册")

var LyricNotExistsError = NewAppServerError(5020001, "没有获取到歌词信息")
var InvalidBVIDError = NewAppServerError(5020002, "BVID格式无效")
var LyricContentEmptyError = NewAppServerError(5020003, "歌词内容不能为空")
