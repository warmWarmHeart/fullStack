const redis = require('redis');
const client = redis.createClient(6379, '192.168.56.101');

const cb =  (err, data) => {
    console.log(err, data)
};
// 字符串类型
// var res = client.set('age', 20, (err, data) => {
//     console.log(err, data)
// });
// var res = client.get('age', cb);

client.rpush('friends', '王五', '赵柳', cb);
client.lpush('friends', '王五1', '赵柳1', cb);
client.lrange('friends', 0, -1, cb);
// client.rrange('friends', 0, -1, cb);

// set
client.sadd('ids', 1,2,cb);
client.smembers('ids',cb);
client.srem('ids', 1 ,cb);
