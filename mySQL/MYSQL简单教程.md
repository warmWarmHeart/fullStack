# MySQL简单教程
> MySQL 是目前最流行的关系型数据库管理系统之一，在web应用方面，MySQL是最好的关系型数据库管理软件之一。
关系型数据库是将数据保存在不同的表中，使用SQL语言作为访问数据库的标准语言。
MySQL采用了双授权政策，分为社区版和商业版，由于体积小、速度快、总体拥有成本低，一些中小型网站都选择MySQL作为网站数据库

## 安装MYSQL前需要安装的依赖
> 可以通过 ```yum list installed | grep openssl``` 查看依赖有没有安装
* openssl ```yum install -y openssl```

>在计算机网络上，OpenSSL是一个开放源代码的软件库包，应用程序可以使用这个包来进行安全通信，避免窃听，同时确认另一端连接者的身份。这个包广泛被应用在互联网的网页服务器上

* perl ```yum install -y perl```
> Perl，一种功能丰富的计算机程序语言，运行在超过100种计算机平台上，适用广泛，从大型机到便携设备，从快速原型创建到大规模可扩展开发。
* 如果http开启的时候不能访问则需要打开宽松模式
 - setenforce=0 // 零时关闭
 - 永久更改setenforce
    ```
    vim /etc/setlinux/config
    i
    SELINUX=disabled
    :wq
    // 保存后需要重启
    reboot
    ```
## MySql安装及基础配置
* 官方yum源安装
    - 下载官网yum源
    > http://mirror.tuna.tsinghua.edu.cn/help/mysql/
    - yum install -y mysql-community-server
    > yum的时候可能遇到 `获取 GPG 密钥失败` 的问题， 可以将mysql-community.repo中的gpgcheck全部改为0
* 镜像站下载离线安装
    - 找到镜像文件
    - wget 下载
    - rpm 离线安装
    ```
    // 顺序不能错，common-》libs-》client-》server
    rpm -ivh mysql-community-common-8.0.19-1.e17.x86_64.rpm
    rpm -ivh mysql-community-libs-8.0.19-1.e17.x86_64.rpm
    // 上一步可能遇到 Failed dependencies: mariadb-libs...
    yum remove mariadb-libs
    rpm -ivh mysql-community-client-8.0.19-1.e17.x86_64.rpm
    rpm -ivh mysql-community-server-8.0.19-1.e17.x86_64.rpm

    ```
    - 基础配置
> MySQL官网放在国外服务器，所以下载速度非常慢，推荐使用国内镜像离线安装

## Mysql基本概念
### 结构化查询语言
> 结构化查询语言（Structured Query Language）简称：SQL，是一种特殊目的的编程语言，是数据库查询与程序设计语言，
用于村粗数据及查询、更新和管理关系型数据库，同时也是数据库脚本文件的扩展名
### SQL语言的分类
* 数据查询（DQL）
> 数据检索语句，用以从表中获取数据，select是DQL中用的最多的关键字，其他还包括where/order by/group by/having.
* 数据操作（DML）
> 关键字： insert/updata/delete, 分别用于插入、修改以及删除表中的行。
* 事务处理（TPL）
> 确保被DML语句影响的表的所有行为得到更新。TPL语句包含 begin transaction、commit、rollback。
* 数据控制（DCL）
> 通过grant或者revoke获取许可， 确定单个用户和用户组对数据库对象的访问。
* 数据定义（DDL）
> 关键字： create和drop。在数据库中创建新表或者删除表，以及为表加入索引等。
* 指针控制（CCL）
> declare cursor（声明游标）、fetch into（进入）和update where current（更新当前位置）用于对一个或者多个表单独行的操作
## Mysql服务
```
// 启动服务
service mysqld start
```
## 登录Mysql服务
```
// 安装后第一次登录服务器之前 mysql会生成一个零时密码放在/var/log/mysqld.log
grep password /var/log/mysqld.log
// 显示如下  A temporary password is generated for root@localhost: sTWpXZn=p5ai

// 登录
mysql -uroot -p
// 输入上面获取到的密码
sTWpXZn=p5a
// 更改用户 语句后面需要加英文分号
alter user user() identified by '123Qwe.';
// 退出重新登录
exit
...
```

## 远程工具连接mysql服务器
```
// 前提，确保mysql.user表中的host字段为 %（localhost代表只能本地访问）
select HOST, user from mysql.user where user='root';
// 显示如下, 需要将HOST 改为 '%', 匹配所有
+-----------+------+
| HOST      | user |
+-----------+------+
| localhost | root |
+-----------+------+

// 更改host
update mysql.user set HOST="%" where user='root';
// 防火墙添加3306访问端口
firewall-cmd --add-port=3306/tcp --permanent
firewall-cmd --reload

// 卸载component_validate_password，原因：该组件会导致Node.js远程连接时候密码解析错误
// 注意：生产环境最好不要卸载！！！
// 先查看该组件所在位置
select * from mysql.component;
// 显示如下：
+--------------+--------------------+------------------------------------+
| component_id | component_group_id | component_urn                      |
+--------------+--------------------+------------------------------------+
|            1 |                  1 | file://component_validate_password |
+--------------+--------------------+------------------------------------+

// 卸载新的加密方式
uninstall component 'file://component_validate_password';
// 设置以旧方式加密密码
alter user 'root@%' identified with mysql_native_password by 'password';
// 然后就可以用Navicat之类的软件远程登录mysql服务器
```
### 创建用户
```
create user if not exists 'liu'
```

## MySQL设置
```
vim /etc/my.cnf
// 数据目录
datadir=/var/lib/mysql
// socket文件目录 连接方式由http变为socket的时候就需要用到它
socket=/var/lib/mysql/mysql.sock
// error log 日志
log-error=/var/log/mysqld.log
// 进程id保存文件
pid-file=/var/run/mysqld/mysqld.pid
```

## mysql 简单命令
```
? (\?) “help”的同义词。

clear（\c）清除当前输入语句。

connect（\r）重新连接到服务器。可选参数是db和host。

delimiter（\d）设置语句分隔符。

edit（\e）编辑命令。

ego（\G）向mysql服务器发送命令，垂直显示结果。

exit（\q）退出mysql。和辞职一样。

go（\g）向mysql服务器发送命令。

help（\h）显示此帮助。

nopage（\n）禁用寻呼机，打印到标准输出。

notee（\t）不写入outfile。

pager（\P）设置寻呼机[到寻呼机]。通过寻呼机打印查询结果。

print（\p）打印当前命令。

prompt（\R）更改mysql提示。

quit（\q）退出mysql。

rehash（\#）重建完成哈希。

source（\.）执行一个SQL脚本文件。以文件名作为参数。

status（\s）从服务器获取状态信息。

system（\！）执行系统外壳命令。如： \! echo 'haha'

tee（\T）设置outfile[到outfile]。将所有内容附加到给定的输出文件中。

use（\u）使用其他数据库。以数据库名称作为参数。 用来设置默认的数据库

charset（\C）切换到另一个字符集。可能需要使用多字节字符集处理binlog。

warnings（\W）在每个语句后显示警告。

nowarning（\w）不在每个语句后显示警告。
```

## 命令行连接

* mysql [options] [database]
    - -u, -user=username  用户名，默认root
    - -h, -host=hostname 远程主机名， 默认localhost
    - -P, -port=3306 监听端口， 默认3306/tcp
    - -p, -password[=password] 密码,默认为空，一般不建议明文
    - -D, -database=database 连接到服务器后指明默认数据库
    - -e, -execute='某一条命令，如show databases' 连接到服务器后执行命令后直接返回

* help contents  查看mysql文档

## 默认的系统函数
* select user() 查询当前用户
* select database() 查询当前数据库
* show engines 显示引擎
* show charset 显示charset

## 数据类型
* 定长字符
    - char 不区分大写小
    - binary 二进制数据流 区分大小写
* 变长字符
    - varchar 不区分大小写
    - varbinary 二进制流，可用于存储图片、音乐、短视频
* 对象存储 字符型
    - text、tinytext、smalltext、mediumtext、longtext
    - blob、tinyblob、smallblob、mediumblob、longblob
* 内置类型
    - enum 单选字符串，适合存储表单界面中的"单选值"
    - set 多选字符型，用于存储表单界面中的"多选值"
* 精确数值
    - tinyint、smallint、mediumint、int/interger、bigint
    - decimal（定点数）
* 近似值
    - float、double
* 日期时间
    - date(YYYY-MM-DD)
    - time(HH:mm:ss)
    - year(YYYY)
    - datetime(YYYY-MM-DD HH:mm:ss)
    - timestamp(时间戳)

## 数据库管理
* 创建数据库
```
create {database | schema} [if not exists] db_name [create_specification];
create database if not exists list charset utf8;
// 创建完后 查看创建好的数据库
show databases;
```
* 修改数据库
```
alter {database | schema} [db_name] alter_specification;
```
* 删除数据库
```
drop {database | schema} [if exists] db_name;
```
* 查看数据库
```
show {databases | schema} [like 'pattern%'];
// 切换数据库
use db_name
```
## 表管理
* 创建表
```
// temporary代表零时表，表放在内存中，当前连接有效  关闭连接后就删除该表
create [temporary] table [if not exists] tbl_name (create_definition) [table_options] [partition_options];
// unsigned 无符号型；not null 不允许为空；auto_increment 自动增长；primary key 主键；comment 说明
create table if not exists student(
    id int(11) unsigned not null auto_increment primary key comment '自增ID',
    name varchar(255) default null comment '姓名',
    score int(3) default 0 comment '成绩'
) engine InnoDB charset utf8 comment '学生成绩表';
```
* 查看表
```
{explain | desc | describe } tbl_name;

// 查看创建表的语句
show create table tbl_name \G;
```
* 删除表
```
drop [temporary] table [if exists] tbl_name [, tbl_name....];
```
* 复制表结构
    - create table tb1_name1 select * from tbl_name where 1=0;
        > 复制表tbl_name的表结构到tbl_name1， where 1=0阻止复制表中数据； 这种方式会丢失 自动自增auto_increment和 主键primary key的设置和表外部设置（engines 和charset等）
    - create table tbl_name1 like tbl_name;   （推荐)
* 修改表
```
# 修改表名
alter table `tab_name` rename [to | as] `new_table_name`;

# 修改字段名
alter table tab_name rename column old_col_name to new_colname;

# 修改索引名
alter table tab_name rename [index | key] old_index_name to new_index_name;

# 新增字段名（最后、最前、指定字段后）
alter table tab_name add column col_name col_definition [first | after col_name];

# 删除字段
alter table tab_name drop column col_name;

# 修改字段属性
alter table tab_name modify column col_name col_definition [first | after col_name];
alter table tab_name modify column col_name new_col_name [first | after col_name];
```
## 数据操作
```
#插入
insert into tbl_name values(value1, value2, ...);
insert into tbl_name(col1,col2,...) values(value1, value2, ...);
insert into tbl_name values(value1, value2, ...),(value1,value2,...);
insert into tbl_name(col1,col2,...) values(value1, value2, ...),(value1,value2,...);
# 修改
update tbl_name set col1=value1,col2=value2... [where where_condition] [order by...] [limit row_count];

# 删除
delete from tbl_name [where condition];
truncate tb1_name;
```
### 数据操作-查询
* 简单查询 select * from tab_name;
* 条件查询 where
    - 单条件 
    - 多条件 and/or
    - 其他条件 between...and/not/is null/ is not null/not in/like/not like
* 排序 order by
* 限制查询数量 limit
* 统计函数 count/avg/sum/max/min
* 分组查询 group by

