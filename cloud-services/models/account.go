package models

import "go.mongodb.org/mongo-driver/v2/bson"

type Account struct {
	ID       bson.ObjectID `json:"id,omitempty" bson:"_id,omitempty"`
	NickName string        `json:"user_name" bson:"user_name"`
	Password string        `json:"-" bson:"password"`
	Email    string        `json:"email" bson:"email"`
	Role     int           `json:"role" bson:"role"`
}
