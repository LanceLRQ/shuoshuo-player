package server

import (
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	log "github.com/sirupsen/logrus"
	"os"
)

type CustomFileLogHooks struct {
	logFile  *os.File
	logLevel []log.Level
}

// NewCustomFileLogHooks 初始化文件日志
//
// Usage:
//
//	NewCustomFileLogHooks("app.log", log.AllLevels)
//	NewCustomFileLogHooks("app.log", []log.Level{
//		log.ErrorLevel,
//		log.PanicLevel,
//	})
func NewCustomFileLogHooks(file string, level []log.Level) (*CustomFileLogHooks, error) {
	f, err := os.OpenFile(file, os.O_RDWR|os.O_CREATE|os.O_APPEND, 0644)
	if err != nil {
		return nil, err
	}
	hook := &CustomFileLogHooks{
		logFile:  f,
		logLevel: level,
	}
	return hook, nil
}

// Fire 将日志写入到文件中
func (h *CustomFileLogHooks) Fire(entry *log.Entry) error {
	line, err := entry.String()
	if err != nil {
		_, err = fmt.Fprintf(os.Stderr, "Unable to read entry, %v", err)
		return err
	}

	if _, err := h.logFile.Write([]byte(line)); err != nil {
		return err
	}
	if len(entry.Data) > 0 {
		formatter := log.JSONFormatter{}
		jsonLine, err := formatter.Format(entry)

		if err != nil {
			_, err = fmt.Fprintf(os.Stderr, "Unable to read entry, %v", err)
			return err
		}
		if _, err := h.logFile.Write([]byte(jsonLine)); err != nil {
			return err
		}
	}
	return nil
}

// Levels 返回日志等级定义
func (h *CustomFileLogHooks) Levels() []log.Level {
	return h.logLevel
}

// Close 释放日志文件
func (h *CustomFileLogHooks) Close() error {
	return h.logFile.Close()
}

func initServerLogger(cfg *configs.ServerConfigStruct) (func(), error) {
	log.SetFormatter(&log.TextFormatter{
		FullTimestamp:   true,
		TimestampFormat: "2006-01-02 15:04:05",
	})
	log.SetOutput(os.Stdout)
	log.SetLevel(log.DebugLevel)

	hooks := make([]*CustomFileLogHooks, 0, 1)

	if cfg.Log.DebugFile != "" {
		fmt.Printf("[Server] debug log: %s\n", cfg.Log.DebugFile)
		debugHook, err := NewCustomFileLogHooks(cfg.Log.DebugFile, []log.Level{
			log.DebugLevel, log.TraceLevel,
		})
		if err != nil {
			log.Printf("WARN! Open debug log file (%s) error: %s\n", cfg.Log.DebugFile, err.Error())
		}
		log.AddHook(debugHook)
		hooks = append(hooks, debugHook)
	}

	if cfg.Log.AccessFile != "" {
		fmt.Printf("[Server] access log: %s\n", cfg.Log.AccessFile)
		accessHook, err := NewCustomFileLogHooks(cfg.Log.AccessFile, []log.Level{
			log.InfoLevel, log.WarnLevel, log.ErrorLevel, log.FatalLevel, log.PanicLevel,
		})
		if err != nil {
			log.Printf("WARN! Open access log file (%s) error: %s\n", cfg.Log.AccessFile, err.Error())
		}
		log.AddHook(accessHook)
		hooks = append(hooks, accessHook)
	}

	return func() {
		for _, h := range hooks {
			_ = h.Close()
		}
	}, nil
}
