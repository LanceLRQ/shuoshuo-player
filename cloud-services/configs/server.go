package configs

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type ServerConfigStruct struct {
	Listen string `yaml:"listen" json:"listen"`
}

func GetDefaulfAppDataPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	appPath := fmt.Sprintf("%s/ollama-watchdog", dir)
	if err := os.MkdirAll(appPath, 0o755); err != nil {
		return ""
	}
	return appPath
}

func GetDefaultServerConfigPath() string {
	return "./server.yaml"
}

func GetDefaultServerConfig() ServerConfigStruct {
	return ServerConfigStruct{
		Listen: "0.0.0.0:10715",
	}
}

// ReadConfig 读取配置
func ReadServerConfig(path string) (*ServerConfigStruct, error) {
	data, err := os.ReadFile(path)
	cfg := GetDefaultServerConfig()
	if os.IsNotExist(err) {
		return &cfg, nil
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
