package utils

import (
	"github.com/golang-jwt/jwt/v5"
	"time"
)

// NewJWTToken 创建JWT令牌
func NewJWTToken(accountId, pwdSessionKey, jwtSecret string, jwtExpire time.Duration) (string, int64, error) {
	factory := jwt.New(jwt.SigningMethodHS256)

	expireAt := time.Now().Add(jwtExpire * time.Hour).Unix()

	claims := factory.Claims.(jwt.MapClaims)
	claims["account_id"] = accountId
	claims["pwd_session"] = pwdSessionKey
	claims["exp"] = expireAt
	claims["iss"] = "sso@shuoshuo.sikong.ren"
	claims["nbf"] = time.Now().Unix()
	claims["iat"] = claims["nbf"]
	claims["sub"] = "login"
	claims["aud"] = "web"

	token, err := factory.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", 0, err
	}
	return "Bearer " + token, expireAt, nil
}

// ParseJWTToken 解析JWT令牌
func ParseJWTToken(token string, jwtSecret string) *jwt.Token {
	ret, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	})
	if err != nil {
		return nil
	}
	return ret
}

// ValidJWTToken 校验JWT令牌
func ValidJWTToken(token string, jwtSecret string) bool {
	ret := ParseJWTToken(token, jwtSecret)
	if ret == nil {
		return false
	}
	return ret.Valid
}
