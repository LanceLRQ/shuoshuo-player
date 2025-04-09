package models

import "go.mongodb.org/mongo-driver/v2/bson"

type Account struct {
	ID       bson.ObjectID `json:"id,omitempty" bson:"_id,omitempty" example:"67edfaa28b6491ae6926f3e8"`
	NickName string        `json:"user_name" bson:"user_name" example:"foobar"`
	Password string        `json:"-" bson:"password" example:"foobar#1234"`
	Email    string        `json:"email" bson:"email" example:"foo@bar.com"`
	Role     int           `json:"role" bson:"role" example:"0"`
}
