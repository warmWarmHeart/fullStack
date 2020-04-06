# redis

## redis 简介
> redis是一个远程内存数据库，不仅性能强，而且具有复制特性以及为解决问题而生的独一无二的数据模型。
redis是一个速度非常快的非关系型数据库，它可以存储键和5种不同类型值的之间的映射，
可以将存储到内存中的键值对数据持久化到硬盘， 可以使用复制特性来扩展读性能，又能使用客户端分片来扩展写性能。

## redis与其他数据库及软件对比

| 名称  | 类型 | 数据存储 | 数据查询 |
| -----| --- | ----| -------|
| Redis|使用内存存储的非关系型数据库 | 字符串、列表、集合、散列表、有序集合 | 每种数据类型都有自己的命令
| Memcached| 使用内存存储的键值缓存 | 键值之间的映射 | 创建、读取、更新、删除等 |
| MySQL| 关系型数据库 | 每个数据库包含多个表，每个表包含多行 | select/insert/update/delete等|
| MongoDB| 使用硬盘存储的非关系型数据库 | 每个数据包含多个表，每个表包含多个BSON文档 | 创建、读取、更新、删除等 |

## redis安装及配置
* 下载安装包并解压
* 安装gcc依赖
* 编译配置
* 编译安装
```
# 虚拟机安装可能遇到问题 可能是vbox网络设置链接方式设置有关，也可能是DNS解析有问题
wget http://download.redis.io/releases/redis-5.0.8.tar.gz
# 可以用mv 移动下载好的压缩包到你想移动的目录
tar -zxvf redis.5.0.8.tar.gz
cd redis.5.0.8
make MALLOC=libc #配置分配器 安装的时候需要使用配置该分配器到环境变量中
make install
```
* 启动redis服务的几种方式
```
redis-server #该命令可以启动redis服务 ctrl + c 结束
# 这种没有配置的启动方式不能在后台运行
```
```
cd /tmp/redis-5.0.8 # 打开源码
vim redis.config
# i进入输入模式 更改配置 （ daemonize yes ）
# cp redis.config /etc/redis.conf # 拷贝redis.conf到你指定的目录 方便稍后启动redis服务时候 指定 配置文件
redis-server /etc/redis.conf
# 接下来 redis就可以在后台运行
```
```
# 伪装成一个service, 通过下面配置 实现 service redis_6379 start这种启动方式
cd /tmp/redis.5.0.8/utils
./install_server.sh
# 1 选择redis端口 默认6379
# 2 选择redis配置名字 /etc/redis.conf
# 3 log日志 /var/log/redis.log
# 4 redis 数据目录 /var/lib/redis
# 5 redis执行路径 
```
```
redis-cli # 查看本地redis服务
exit # 退出redis-cli
```
* 结束redis进程
```
kill -9 [redis的pid]
```
### redis 常用配置
* 配置文件 redis.conf
    - ip绑定配置 bind  
    > 只接受来自该id的请求 不设置则接受所有请求
    - 保护模式配置 protected-mode
    > 开启后 如果未配置bind和masterauth 只能在本地操作redis且拒绝远程访问，如果配置bind和masterauth，远程只能连接redis但不能操作。 远程连接的话一般需要关闭
    - 端口配置 port
    - 后台运行配置 damonize
    - 进程文件配置 pidfile
    - 持久化配置 save
    > 格式： save 900 1    意思是 表示如果900秒内至少1个key发生变化（新增、修改和删除），则重写rdb文件
    - 连接认证配置 masterauth
    - ...
## redis数据结构及应用

### redis提供5中结构
| 结构类型  | 存储值 | 读写能力 |
| -----| --- | ----|
| STRING|可以是字符串、整数以及浮点数 | 对整个字符串或者字符串中的一部分操作；对整数浮点数执行increment或者decrement|
|LIST|链表，每个节点包含一个STRING|从链表两端push或者pop元素；根据偏移量对链表进行裁剪；读取单个或者多个元素；根据值查找或者移除元素|
|SET|包含STRING的无序集合，其值具有唯一性|添加、获取、移除单个元素；检查一个元素是否存在于集合中|
|HASH|包含键值对的无序散列表|添加、获取、移除单个键值对；获取所有键值对；|
|ZSET|STRING成员与浮点数分值之间的有序映射，排列顺序由分值大小决定|添加、获取、移除单个元素；根据分值范围或者成员获取元素|

### redis 操作

```
// 运行redis-cli控制台
redis-cli -h 127.0.0.1 -p 6379
// 用 set get del 分别进行设置获取和删除操作 STRING类型的数据
set name liuyanjun
get name
del name
// 用rpush list1 item、lrange list1 0 -1、lindex list1 1、lpop list1操作 List类型的数据
rpush list1 1
rpush list1 2
lrange list1 0 -1
lindex list1 1
lpop list1
// SET类型
sadd set1 item1 item5
sadd set1 item2 item8 // 可以批量操作
sismember set1 item // 判断是否存在
srem set1 item1 // 移除
smembers set1 // 查看所有成员
// HASH类型
hset hash1 key1 value1 // hash 设置键值对  key value
hgetall hash1 // 获取所有键值对
hdel hash1 value1 // 删除， 可以删除多个
// ZSET // 唯一的
zadd zset1 122 member1
zadd zset1 123 member2
zrange zset1 0 -1
zrange zset1 0 -1 withscores // 按峰值从小到大取值
zrem set1 member1 // 可批量删除
```

## redis 在Node.js中的应用
### 事件循环.md 连接redis
* 引入redis
> 先得让服务器防火墙允许外部访问的redis端口 `firewall-list --add-port=6379 --permanent`

```javascript
const redis = require('redis');
```
* 链接redis
```javascript
const client = redis.createClient(6379, '192.168.56.101');
```

### Node.js操作redis数据
* 操作STRING数据类型

* 操作LIST数据类型

* 操作SET数据类型

* 操作HASH数据类型
