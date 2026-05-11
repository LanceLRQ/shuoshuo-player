admindb = db.getSiblingDB('admin');

// 创建用户
admindb.createUser({
    user: "ssplayer_cloud",
    pwd: "12345678",
    roles: [
        { role: "readWrite", db: "ssplayer_cloud" },
        { role: "dbAdmin", db: "ssplayer_cloud" }
    ]
});