package models

import "go.mongodb.org/mongo-driver/v2/bson"

type LiveSlicerMan struct {
	ID         bson.ObjectID `json:"id,omitempty" bson:"_id,omitempty" example:"67edfaa28b6491ae6926f3e9"`
	Mid        string        `json:"mid" bson:"mid" example:"3461583028095182"`
	Name       string        `json:"name" bson:"name" example:"洛悠Crystal"`
	Face       string        `json:"face" bson:"face" example:"https://i1.hdslb.com/bfs/face/20f47d363780bfc1427e69701f2dbc2424835bc0.jpg@128w_128h_1c_1s.webp"`
	UpdateTime int64         `json:"update_time" bson:"update_time"`
}
