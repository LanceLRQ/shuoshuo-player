## 说说播放器云服务本地开发环境

### 运行

```shell
./dev.sh start
```

### 创建超级用户
```shell
 ./dev.sh create-super-user foo@bar.com
```

### 停止
```shell
./dev.sh stop
```

### 实时日志
```shell
./dev.sh watch
```

### 其他命令请自行查看`dev.sh`

## Mongo配置 (已经自动化了，此处为留档)

```use admin;```

```javascript
db.createUser({
  user: "ssplayer_cloud",
  pwd: "12345678",
  roles: [{ role: "readWrite", db: "ssplayer_cloud" }]
});
```