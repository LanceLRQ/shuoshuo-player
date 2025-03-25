package utils

import (
	"github.com/bwmarrin/snowflake"
	"regexp"
)

const encodeBase58MapRegex = "^[123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ]+$"

func GetSnowflakeId() (snowflake.ID, error) {
	node, err := snowflake.NewNode(1)
	if err != nil {
		return 0, err
	}
	return node.Generate(), nil
}

func IsBase58(text string) bool {
	re, err := regexp.Compile(encodeBase58MapRegex)
	if err != nil {
		return false
	}
	return re.Match([]byte(text))
}
