package utils

import (
	"crypto/rand"
	"encoding/base64"
	"golang.org/x/crypto/bcrypt"
)

// GenerateRandomJWTSecret 生成安全的随机JWT Secret
func GenerateRandomJWTSecret(length int) string {
	// 创建字节切片存储随机数据
	randomBytes := make([]byte, length)
	// 使用crypto/rand生成密码学安全的随机数
	_, err := rand.Read(randomBytes)
	if err != nil {
		return ""
	}
	// 将随机字节编码为base64字符串
	secret := base64.URLEncoding.EncodeToString(randomBytes)
	return secret
}

// CreatePasswordHash 创建密码hash
func CreatePasswordHash(pwd string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPasswordHash 检查密码是否匹配
// hash: 已hash过的密码数据
// pwd： 需要检查的密码
func CheckPasswordHash(hash, pwd string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(pwd))
	return err == nil
}
