#### MacOS 自签名命令

使用`yarn package`构建App后，进入`out`目录，对生成好的App进行自签名。

```shell
codesign --force --deep -s "说说播放器" ./说说播放器PC版.app
```

#### Windows下构建

修改`.env.example`为`.env`。环境变量内容说明：

```shell
WIN_CERT_FILE="数字证书文件位置"
CERT_PASSWORD="证书私钥密码"
```

使用`yarn make`构建安装包和绿色版可执行文件