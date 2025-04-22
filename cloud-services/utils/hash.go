package utils

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"math/big"
)

const randomCharset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const randomPwdSessionCharset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~!@#$%^&*()_+`-=<>?:{}|,./;'[]"

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

// GenerateRandomPassword 生成指定长度的随机密码，包含大小写字母和数字
func GenerateRandomPassword(length int) (string, error) {
	password := make([]byte, length)

	for i := range password {
		// 生成一个随机索引
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(randomCharset))))
		if err != nil {
			return "", fmt.Errorf("生成随机数失败: %v", err)
		}
		password[i] = randomCharset[num.Int64()]
	}

	return string(password), nil
}

// GenerateRandomPasswordSessionKey 生成指定长度的密码SessionKey
func GenerateRandomPasswordSessionKey(length int) string {
	password := make([]byte, length)
	for i := range password {
		// 生成一个随机索引
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(randomPwdSessionCharset))))
		if err != nil {
			return ""
		}
		password[i] = randomPwdSessionCharset[num.Int64()]
	}

	return string(password)
}
