package utils

import (
	"github.com/bwmarrin/snowflake"
	"regexp"
)

const encodeBase58MapRegex = "^[123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ]+$"
const b58Alphabet = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"

func GetSnowflakeId() (snowflake.ID, error) {
	node, err := snowflake.NewNode(1)
	if err != nil {
		return 0, err
	}
	return node.Generate(), nil
}
func GetSnowflakeBase58() string {
	ret, err := GetSnowflakeId()
	if err != nil {
		return ""
	}
	return ToBase58(ret.Int64())
}

func ToBase58(num int64) string {
	base := int64(len(b58Alphabet))
	result := ""
	for num > 0 {
		remainder := num % base
		result = string(b58Alphabet[remainder]) + result
		num /= base
	}
	return result
}

func FromBase58(text string) int64 {
	base := int64(len(b58Alphabet))
	result := int64(0)
	for _, char := range text {
		index := int64(0)
		for i, c := range b58Alphabet {
			if c == char {
				index = int64(i)
				break
			}
		}
		result = result*base + index
	}
	return result
}

func IsBase58(text string) bool {
	re, err := regexp.Compile(encodeBase58MapRegex)
	if err != nil {
		return false
	}
	return re.Match([]byte(text))
}
