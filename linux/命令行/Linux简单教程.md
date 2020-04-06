# Linux 常见命令

> 如果是virtualBox，Linux想联网的话 需要设置网络为  *桥接网络*
## 启动网卡
### vi /etc/sysconfig/network-scripts/ifcfg-net0s3 进入网卡配置
```
    vi /etc/sysconfig/network-scripts/ifcfg-enp0s3
    // 进入输入模式修改ONBOOT
    ONBOOT=yes
    // 关机
    poweroff
```
## 下载net-tools
```
// 下载完后我们就可以用命令： ifconfig
yum install net-tools
```
## 下载vim
```
// 下载完后我们就可以用命令： vim
yum install vim
```

## 查看ip
* <strong>ifconfig</strong> ：  mini版没有安装此命令， 需要自己安装
* <strong>ip addr</strong> : 显示ip信息

## poweroff 关机
## reboot 重启

## 别的机器通过   ssh root@网卡ip地址就可以远程操作对应的linux系统服务器

## vi/vim
> vi编辑器是UNIX早期自带的文本编辑器，更能简单，不支持语法颜色；vim编辑器是在vi的基础上改进的版本，比vi功能更强大，支持语法颜色。vim是vi的升级版。
#### 命令模式
* /[内容] 正向搜索内容（n移到下一个关键词，N移到上一个关键词）
* ?[内容] 逆向搜索内容（N移到下一个关键词，n移到上一个关键词）
* i 切换到输入模式
#### 输入模式
* x 删除当前光标所在所处的字符
* : 切换到底线命令模式
* ESC进入命令模式
### 底线命令模式
* q 退出程序
* w 保存文件
* set number 显示行号

## 系统信息
* free-m 内存信息
* df -h 硬盘信息
* cat /proc/cpuinfo cpu信息

## 文件系统
* cd 进入目录
* ls 列出目录信息 ls -all（ll）
* touch 新建文件
* mkdir 新建目录
* rm  删除文件或目录
* cp 复制
* mv 移动（重命名）
* du -sh 查看文件目录大小信息

## 搜索、查找、读取
* tail 从文件尾部读取
* head 从文件头部读取
* cat 读取整个文件
* more/less 分页读取
* grep 搜索关键字
* find 查找文件
* | 通过管道传递命令
## 压缩和减压
* tar 用于压缩和减压
* tar -czvf 打包压缩
* tar -tzvf 列出压缩文件内容
* tar -xzvf 解压文件

## 用户操作
* useradd/adduser 添加用户
* passwd 设置密码
* userdel 删除用户
* sudo  提权

## 更换yum 源
* mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.backup

## 防火墙
### 服务设置
* 1 安装 yum install firewalld
* 2 启动 service firewalld stard
* 3 检查服务状态 service firewalld status
* 4 关闭/禁用 service firewalld stop/disabled

### 防火墙设置
* 查询服务 firewall-cmd --zone=public --list-services
* 查询开放端口 firewall-cmd --zone=public --list-ports
* 查询端口 firewall-cmd --zone=public --query-port=80/tcp
* 添加开放端口 firewall-cmd ---zone=public -add-port=3306/tcp
* 添加开放端口 firewall-cmd --zone=public --add-port=3306/tcp --permanent 永久添加
* 更新端口 firewall-cmd --reload

## 将服务加入/移除开机启动
```
// 加入
sudo systemctl start service_name
sudo systemctl enabled service_name
// 移除
sudo systemctl stop service_name
```
## 查看端口占用情况
```
netstat -antp|grep 80
```

## Apache
### 服务设置
* 1 安装 yum install httpd
* 2 启动 service httpd start
* 3 检查服务状态 service httpd status
* 4 关闭/重启 service httpd stop/restart

### Apache 设置
* 1 虚拟主机设置
* 2 伪静态操作
