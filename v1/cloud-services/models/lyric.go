package models

import "go.mongodb.org/mongo-driver/v2/bson"

type Lyric struct {
	ID         bson.ObjectID `json:"id,omitempty" bson:"_id,omitempty" example:"67edfaa28b6491ae6926f3e9"`
	Bvid       string        `json:"bvid" bson:"bvid" example:"BV1g6FTefEsc"`
	Title      string        `json:"title" bson:"title" example:"歌词标题"`
	Content    string        `json:"content" bson:"content" example:"歌词内容"`
	CreateTime int64         `json:"create_time" bson:"create_time"`
	UpdateTime int64         `json:"update_time" bson:"update_time"`
	IsDeleted  bool          `json:"-" bson:"is_deleted"`
}

type LyricSnapshots struct {
	ID         bson.ObjectID `json:"id,omitempty" bson:"_id,omitempty" example:"67edfaa28b6491ae6926f3e9"`
	LyricId    bson.ObjectID `json:"lyric_id,omitempty" bson:"lyric_id,omitempty" example:"67edfaa28b6491ae6926f3e7"`
	Title      string        `json:"title" bson:"title" example:"歌词标题"`
	Content    string        `json:"content" bson:"content" example:"歌词内容"`
	CreateTime int64         `json:"create_time" bson:"create_time" example:"123456789"`
	AuthorId   bson.ObjectID `json:"author_id,omitempty" bson:"author_id,omitempty" example:"67edfaa28b6491ae6926f3e8"`
	Author     Account       `json:"author" bson:"author"`
}
