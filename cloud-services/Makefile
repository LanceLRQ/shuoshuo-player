# Makefile for Go project By DeepSeekV3

# 默认配置
APP_NAME      ?= shuoshuo-player-cloud-service
APP_VERSION   ?= 1.0.0
BUILD_DIR     ?= bin
CGO_ENABLED   ?= 0
BUILD_VERSION ?= v1.0.0
GOFLAGS       ?= -ldflags="-s -w -X main.version=$(BUILD_VERSION)" # 减小二进制体积

# 支持的平台列表
PLATFORMS     ?= linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64

# 默认构建目标
.DEFAULT_GOAL := build

# 设置TARGET_OS和TARGET_ARCH（如果通过命令行指定）
ifdef target
	TARGET_OS   = $(firstword $(subst /, ,$(target)))
	TARGET_ARCH = $(lastword $(subst /, ,$(target)))
else
	TARGET_OS   = linux
	TARGET_ARCH = amd64
endif

# 构建单个平台
.PHONY: build
build:
	@echo "Building for $(TARGET_OS)/$(TARGET_ARCH)..."
	@mkdir -p $(BUILD_DIR)
	CGO_ENABLED=$(CGO_ENABLED) GOOS=$(TARGET_OS) GOARCH=$(TARGET_ARCH) \
	go build $(GOFLAGS) -o $(BUILD_DIR)/$(APP_NAME) .

# 构建所有平台
.PHONY: build-all
build-all:
	@$(foreach platform,$(PLATFORMS), \
		$(MAKE) build target=$(platform) &&) \
	echo "All builds completed."

# 清理构建文件
.PHONY: clean
clean:
	@rm -rf $(BUILD_DIR)
	@echo "Cleanup complete."

# 运行应用
.PHONY: run
run: build
	@./$(BUILD_DIR)/$(APP_NAME)

# 显示帮助信息
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  build       - Build for current platform (default)"
	@echo "  build-all   - Build for all defined platforms ($(PLATFORMS))"
	@echo "  clean       - Remove build artifacts"
	@echo "  run         - Build and run the application"
	@echo "  help        - Show this help message"
	@echo ""
	@echo "Customization:"
	@echo "  APP_NAME    -   Set output binary name (default: app)"
	@echo "  BUILD_DIR   -   Set output directory (default: bin)"
	@echo "  CGO_ENABLED -   Set to 1 to enable CGO (default: 0)"
	@echo "  BUILD_VERSION - Set build version info (default: v1.0.0)"
	@echo ""
	@echo "Example usage:"
	@echo "  make build target=linux/arm64"
	@echo "  make build-all"
	@echo "  make APP_NAME=myapp BUILD_DIR=dist build"
