package configs

type ServerConfigStruct struct {
	Listen    string               `yaml:"listen" json:"listen"`
	PublicUrl string               `yaml:"public_url" json:"public_url"`
	Security  ServerSecurityConfig `yaml:"security" json:"security"`
	Debug     bool                 `yaml:"debug" json:"debug"`
	Log       ServerLogConfig      `yaml:"log" json:"log"`
}

type ServerSecurityConfig struct {
	JWTSecret string `yaml:"jwt_secret" json:"jwt_secret"`
	JWTExpire int64  `yaml:"jwt_expire" json:"jwt_expire"`
}

type ServerLogConfig struct {
	AccessFile string `yaml:"access_file" json:"access_file"`
	DebugFile  string `yaml:"debug_file" json:"debug_file"`
}
