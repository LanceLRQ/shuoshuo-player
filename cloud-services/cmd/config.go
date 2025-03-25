package cmd

import (
	"fmt"

	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/urfave/cli/v2"
)

func ConfigCommand() *cli.Command {
	return &cli.Command{
		Name:    "config",
		Aliases: []string{"cfg"},
		Usage:   "修改配置",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:        "config",
				Aliases:     []string{"c"},
				Value:       configs.GetDefaultServerConfigPath(),
				Usage:       "配置文件路径",
				DefaultText: configs.GetDefaultServerConfigPath(),
			},
		},
		Subcommands: []*cli.Command{
			{
				Name:  "get",
				Usage: "获取当前配置的值",
				Action: func(c *cli.Context) error {
					if c.NArg() < 1 {
						return fmt.Errorf("参数错误")
					}

					key := c.Args().Get(0)

					cfg, err := configs.ReadServerConfig(c.String("config"))
					if err != nil {
						return err
					}
					value, err := configs.GetConfigValue(cfg, key)
					if err != nil {
						return err
					}
					fmt.Printf("%v\n", value.Interface())
					return nil
				},
			},
			{
				Name:  "set",
				Usage: "设置配置值",
				Action: func(c *cli.Context) error {
					if c.NArg() < 2 {
						return fmt.Errorf("参数错误")
					}

					key := c.Args().Get(0)
					value := c.Args().Get(1)

					cfg, err := configs.ReadServerConfig(c.String("config"))
					if err != nil {
						return err
					}

					err = configs.SetConfigValue(cfg, key, value)
					if err != nil {
						return err
					}

					// 写入
					return configs.WriteServerConfig(c.String("config"), cfg)
				},
			},
		},
	}
}
