# MongoDB

## MongoDB 简介
> mongoDB是一个基于分布式文件存储的数据库。由C++语言编写， 旨在为web应用提供可扩展的高性能数据存储解决方案
mongoDB是一个介于关系型数据库和非关系型数据库间的产品， 是非关系型数据库当中功能最丰富的，最像关系数据库的。它支持的数据结构非常松散， 是类似Json的bson格式，
因此可以存储较为复杂的数据类型。 Mongo最大特点是它支持的查询语言非常强大，其语言有点类似于面向对象的查询语言， 几乎可以实现类似关系数据库表单查询的绝大部分功能，而且还支持对数据库建立索引。
> 当访问的数据量达到50gb以上时，mongoDB的访问速度是mysql的5-10倍，数据量越大，速度体会越快
* 高可扩展性
* 没有复杂关系
* 低成本
* 架构灵活
* 半结构化数据
* 在存储海量数据的同时还有良好的查询性能
* ...
### 缺点
读写性能不是特别出色，对js执行性能很低，多表查询不及关系型数据库

## MongoDB安装
### 安装MongoDB Community Edition
> 最新版、OS: RHEL 7.2 Linux IBM Z Series、Package：server

* 配置MongoDB yum源
 - 打开 https://docs.mongodb.com/manual/tutorial/install-mongodb-on-red-hat/
 - 配置yum源
 ![配置yum源](./yum-resource.png '配置源')
```
vi /etc/yum.repos.d/mongodb-org.repo
```
```
[mongodb-org] 
name = MongoDB Repository
baseurl = https://mirrors.aliyun.com/mongodb/yum/redhat/$releasever/mongodb-org/3.6/x86_64/
gpgcheck = 1 
enabled = 1 
gpgkey = https://www.mongodb.org/static/pgp/server-4.2.asc
```

* 通过yum 安装MongoDB
> 安装的时候可能遇到问题 参考 ![该文档](https://www.cnblogs.com/yangjinjin/p/4745900.html '')
```
yum install -y mongodb
```
* 启动/停止MongoDB
> 注意  是mongod, 没有b
```
service mongod start
service mongod stop
```

### 配置mongodb
```
cd /usr/bin/mongod
// 配置mongo 数据存放路径
mongod --dbpath=/var/lib/mongo
// 在配置完mongod的dbpath后重新运行 service mongod start可能会出错，这时候运行service mongod status查看信息
// 可以通过journalctl -xe查看错误信息
service mongod status
// 上一步查看不出错误后可以打开mongodb的日志log 进行查看
tail -f /var/log/mongodb/mongod.log
```
* 可能显示如下：`Failed to unlink socket file /tmp/mongodb-27017.sock Operation not permitted`
```
ll /tmp/mongodb-27017.sock
// 可以看到该文件是root权限，但mongodb必须要用mongod的权限才能访问
// 网上查到 直接删除该文件就可以，实操确实可以
// 个人觉得更改权限也可以
service mongod start // 正常启动
```
### 更改权限
```
chown mongod:mongod -R 文件或者文件夹 
```

### MongoDB常用配置
* 配置文件mongod.conf
    - 日志配置 systemLog
    - 数据存储配置 storage
    - 进程管理配置 processManagement
    - 网络配置 net
    - 安全配置 security
 
### MongoDB 基础概念
* 文档： 数据的基本单元，相当于数据库中的行
    - 有键值对组成的有序集
    - 不仅区分大小写，还区分数据类型
* 集合： 多个文档组成的集合，文档可以是不同的结构，相当于关系型数据库表中的表
    - 不能以system开头，且不能使用保留字符
    - 动态模式可以使一个集合中包含多样化的文档对象
* 数据库： 多个集合聚合成数据库
    - 数据库名称区分大小写 
    - 几个特殊意义的数据库： admin（用户数据）、local（本地数据）、config（配置数据）

### MongoDB客户端shell
* 客户端shell可以使用命令行与MongoDB实例进行交互
* 它是一个功能完备的JavaScript解释器，所以又称为JavaScript shell， 可以运行任意JavaScript代码。
* 通过shell可以对数据进行基本操作： CURD

### MongoDB 连接
```
// 如果不需要账户密码，在shell中直接输入mongo登录
mongo
// 退出
exit
```
```
// 标准URI连接语法
mongodb://[username:password@]host1[:port1][,host2[:port2]][...][,hostN[portN]][/[database][?options]]
```
```
// mongo命令可以执行js文件
cd /tmp
vim run.js
// 编辑如 ./insertStudent.js 一样的代码
mongo /tmp/run.js
```
```
// 显示结果如下
BulkWriteResult({
	"writeErrors" : [ ],
	"writeConcernErrors" : [ ],
	"nInserted" : 999,
	"nUpserted" : 0,
	"nMatched" : 0,
	"nModified" : 0,
	"nRemoved" : 0,
	"upserted" : [ ]
})
```

### MongoDB用户管理
> MongoDB数据库默认没有用户名及密码的，即无权访问限制。为了方便数据库的管理和安全，需创建数据库用户

| 权限  | 说明 |
| -----| --- |
|read|允许用户读取指定数据库|
|readWrite|允许用户读写指定数据库|
|dbAdmin|允许用户在指定数据库中执行管理函数，如索引创建、删除，查看统计或访问|
|userAdmin|允许用户向system.users集合写入，可以找指定数据库里创建、删除和管理用户|
|clusterAdmin|只在admin数据库中可用，赋予用户所有分片和复制集相关函数的管理权限(集群)|
|readAnyDatabase|只在admin数据库中可用，赋予用户所有数据库的读权限|
|readWriteAnyDatabase|只在admin数据库中可用，赋予用户所有数据库的读写权限|
|userAdminAnyDatabase|只在admin数据库中可用，赋予用户所有数据库的userAdmin权限|
|dbAdminAnyDatabase|只在admin数据库中可用，赋予用户所有数据库的dbAdmin权限|
|root|只在admin数据库中可用。超级账户，超级权限|

### 用户权限设置
* 设置root超级权限
```
mongodb
show dbs
use admin
db.createUser({
    user: 'root',
    pwd: 'root',
    roles: [{
        role: 'root',
        db: 'admin'
    }],
})
show tables
//显示如下：
// system.users // 因此出有system 所以集合不能以system开头，否则会覆盖
// system.version
db.system.users.find().pretty(); // pretty 方法用来格式化获取的信息
mongo 'mongodb://root:root@127.0.0.1:27017' // 用root账户登录
```
* 用root创建别的user
```
show dbs
use list
db.createUser({
    user: 'teach',
    pwd: 'teach',
    roles: [{
        role: 'readWrite',
        db: 'list'
    }],
})
```

* 更新user
```
show dbs
use list
// 彻底更新账户
db.updateUser("teach",{roles:[ {role:"readWrite",db:"student"} ]})
// 更新密码
db.changeUserPassword("teach","teach1");
db.grantRolesToUser("usertest", [{role:"readWrite", db:"testDB"},{role:"read", db:"testDB"}])   // 修改权限
db.revokeRolesFromUser("usertest",[{role:"read", db:"testDB"}])   //# 删除权限：
db.dropUser('usertest') // 删除用户
```

* 开启mongod.conf中的security
```
    vim /etc/mongod.conf
```
```
     security:
     // 开启用户访问控制
     authorization: enabled
```
### CURD
* use database 切换数据库，如果不存在则创建
* show dbs 查看所有数据库
* db 查看当前数据库
* db.dropDatabase() 删除当前数据库
* db.createCollection(collectionName) 创建集合
* db.collection.renameCollection(rename) 重命名集合
### MongoDB文档操作
* db.collection.insert(document) 插入文档
```
db.student.insert({name: '张三', id: '10000'})
```
* db.collection.update(query, update, { upsert, multi, writeConcern }) 更新文档
    - query : update的查询条件，类似sql update查询内where后面的。
    - update : update的对象和一些更新的操作符（如$,$inc...）等，也可以理解为sql update查询内set后面的
    - upsert : 可选，这个参数的意思是，如果不存在update的记录，是否插入objNew,true为插入，默认是false，不插入。
    - multi : 可选，mongodb 默认是false,只更新找到的第一条记录，如果这个参数为true,就把按条件查出来多条记录全部更新。
    - writeConcern :可选，抛出异常的级别。
```
db.student.update({name: '张三'}, {$set: {sex: '男'}})
db.col.update( { "id" : { $gt : 1 } } , { $set : { "test2" : "OK"} } );
```
* db.collection.deleteOne(query) 删除单个文档
```
db.student.deleteOne({name: '张三'})

```
* db.collection.deleteMany(query) 删除多个文档
```
db.student.deleteMany({id: { $lt: 10 }})
```
* db.collection.find(query, projection) 查找文档
```
db.col.find({"likes": {$gt:50}, $or: [{"by": "菜鸟教程"},{"title": "MongoDB 教程"}]}).pretty()
```

### 文档查询 *$* 特殊符号
| 符号 | 含义 | 
| ---- | ----- | 
| ***$lt*** / ***$/lte*** |   小于 / 小于等于 |
| ***$gt*** / ***$/gte*** | 大于 / 大于等于| 
|  ***be*** | 不等于| 
| ***or*** | 条件查询| 
|  ***set*** | update操作时set| 
| ***unset*** | 删除字段| 

## node 连接 MongoDB

![参考文档](http://mongodb.github.io/node-mongodb-native/3.1/api/)

