package cmd

import (
	"fmt"
	"log"
	"os"

	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/server"
	"github.com/urfave/cli/v2"
)

func CommandEntry(version string) {
	app := &cli.App{
		Name:  "shuoshuo-player-cloud-services",
		Usage: "说说播放器云端服务",
		Commands: []*cli.Command{
			ConfigCommand(),
			&cli.Command{
				Name:    "serve",
				Usage:   "启动服务",
				Aliases: []string{"s"},
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:        "config",
						Aliases:     []string{"c"},
						Value:       configs.GetDefaultServerConfigPath(),
						Usage:       "配置文件路径",
						DefaultText: configs.GetDefaultServerConfigPath(),
					},
				},
				Action: func(c *cli.Context) error {
					cfg, err := configs.ReadServerConfig(c.String("config"))
					if err != nil {
						return err
					}
					return server.StartHttpServer(cfg)
				},
			},
			CreateSuperAccount(),
		},
		Action: func(c *cli.Context) error {
			fmt.Printf("说说播放器云端服务(built: %s)\n", version)
			return nil
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}
