### Mongo配置

```use admin;```

```javascript
db.createUser({
  user: "ssplayer_cloud",
  pwd: "12345678",
  roles: [{ role: "readWrite", db: "ssplayer_cloud" }]
});
```