package cmd

import (
	"context"
	"errors"
	"fmt"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/configs"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/constants"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/models"
	"github.com/LanceLRQ/shuoshuo-player/cloud-services/utils"
	"github.com/urfave/cli/v2"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
	"golang.org/x/term"
	"syscall"
	"time"
)

func CreateSuperAccount() *cli.Command {
	// 实现创建超级管理员账户的逻辑
	return &cli.Command{
		Name:      "create-super-account",
		Usage:     "创建超级账户",
		UsageText: "create-super-account <email>",
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
			args := c.Args().Slice()
			if len(args) != 1 {
				return fmt.Errorf("无效的参数数量，用法：create-super-account <email>\n")
			}

			email := args[0]

			fmt.Print("请输入密码(留空则自动生成)： ")
			passwordRaw, err := term.ReadPassword(syscall.Stdin)
			if err != nil {
				return err
			}

			password := string(passwordRaw)
			passwordShow := "********"

			if password == "" {
				// 生成随机8位大小写+数字的密码
				password, err = utils.GenerateRandomPassword(8)
				passwordShow = password
				if err != nil {
					return err
				}
			}

			fmt.Printf("\n\n=====创建账号=====\nEmail：%s\n密码：%s\n===========\n是否执行(y/N)", email, passwordShow)
			cmd := ""
			_, err = fmt.Scanf("%s", &cmd)
			if err != nil {
				cmd = "n"
			}

			if cmd == "yes" || cmd == "y" {
				cfg, err := configs.ReadServerConfig(c.String("config"))
				if err != nil {
					return err
				}
				conn := fmt.Sprintf(
					"mongodb://%s:%s@%s:%d/%s?authSource=admin",
					cfg.MongoDB.User,
					cfg.MongoDB.Password,
					cfg.MongoDB.Host,
					cfg.MongoDB.Port,
					cfg.MongoDB.DBName,
				)
				ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
				defer cancel()
				mongoClient, err := mongo.Connect(options.Client().ApplyURI(conn))
				if err != nil {
					return err
				}
				defer func() {
					ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
					defer cancel()
					if err = mongoClient.Disconnect(ctx); err != nil {
						panic(err)
					}
				}()
				err = mongoClient.Ping(ctx, readpref.Primary())
				if err != nil {
					return err
				}

				collection := mongoClient.Database(cfg.MongoDB.DBName).Collection("accounts")
				var account models.Account
				err = collection.FindOne(context.Background(), bson.M{"email": email}).Decode(&account)
				if err != nil {
					if !errors.Is(err, mongo.ErrNoDocuments) {
						return err
					}
				} else {
					fmt.Println("该邮箱已被注册")
					return nil
				}

				passwordHashed, err := utils.CreatePasswordHash(password)
				if err != nil {
					return err
				}
				user := &models.Account{
					Email:    email,
					Password: passwordHashed,
					Role:     constants.AccountRoleWebMaster,
				}

				_, err = collection.InsertOne(ctx, user)
				if err != nil {
					return err
				}
				fmt.Println("\n创建成功")
			}
			// 创建超级管理员账户
			return nil
		},
	}
}
