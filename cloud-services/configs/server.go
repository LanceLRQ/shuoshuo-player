package configs

import (
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/utils"
	"gopkg.in/yaml.v3"
	"os"
	"path/filepath"
)

func GetDefaultServerConfigPath() string {
	return "./server.yaml"
}

func GetDefaultServerConfig() ServerConfigStruct {
	return ServerConfigStruct{
		Listen:    "0.0.0.0:10715",
		PublicUrl: "http://localhost:10715",
		Security: ServerSecurityConfig{
			JWTSecret: utils.GenerateRandomJWTSecret(64),
			JWTExpire: int64(365 * 24),
		},
		Debug: true,
		Log: ServerLogConfig{
			AccessFile: "./temp/access.log",
			DebugFile:  "./temp/debug.log",
		},
		MongoDB: ServerMongoDBConfig{
			Host:     "mongodb",
			Port:     27017,
			DBName:   "ssplayer_cloud",
			User:     "admin",
			Password: "12345678",
		},
	}
}

// ReadConfig 读取配置
func ReadServerConfig(path string) (*ServerConfigStruct, error) {
	data, err := os.ReadFile(path)
	cfg := GetDefaultServerConfig()
	if os.IsNotExist(err) {
		err = WriteServerConfig(path, &cfg)
		return &cfg, err
	} else if err != nil {
		return nil, err
	}

	err = yaml.Unmarshal(data, &cfg)
	return &cfg, err
}

// WriteConfig 写入配置
func WriteServerConfig(path string, config *ServerConfigStruct) error {
	// 先进行校验
	// if err := config.Validate(); err != nil {
	// 	return err
	// }

	// 获取配置文件路径
	data, err := yaml.Marshal(config)
	if err != nil {
		return err
	}

	// 确保目录存在
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}
