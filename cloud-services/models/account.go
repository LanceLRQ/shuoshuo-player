package models

import "go.mongodb.org/mongo-driver/v2/bson"

type Account struct {
	ID       bson.ObjectID `json:"id,omitempty" bson:"_id,omitempty" example:"67edfaa28b6491ae6926f3e8"`
	NickName string        `json:"user_name" bson:"user_name" example:"foobar"`
	Password string        `json:"-" bson:"password" example:"foobar#1234"`
	Email    string        `json:"email" bson:"email" example:"foo@bar.com"`
	Role     int           `json:"role" bson:"role" example:"0"`
	// 密码会话密钥，用于密码重置后，让其他token直接失效
	PasswordSessionKey string `json:"-" bson:"password_session_key"`
	PasswordRetryCount int    `json:"-" bson:"password_retry_count"`
}
