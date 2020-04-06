## Docker
## Docker介绍
* 使用最广泛的开源容器引擎
* 一种操作系统级的虚拟化技术
  > 运行一个容器就像运行一个进程一样
* 依赖于Linux内核特性：Namespace和Cgroups
    - Namespace 进行资源隔离
    - Cgroups 进行资源限制
* 一种简单的应用程序打包工具
##Docker的安装启动
* 安装
    > 安装文档：https://docs.docker.com/install/linux/docker-ce/centos/
    > docker安装要求：CentOS 7
    - 移除旧版本的docker
    
```
sudo yum remove docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-engine
                  
// 删除 /var/lib/docker目录
rm -rf docker
```
    - 安装docker ce版本
        > 安装前 先1 关闭防火墙 systemctl stop firewalld;2 关闭senLinux(vim /etc/selinux/config)
```
# 1
sudo yum install -y yum-utils \
  device-mapper-persistent-data \
  lvm2

# 2
sudo yum-config-manager \
    --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo
    
# 3
yum install -y docker-ce
```
* 启动
```
systemctl start docker
# 加入开机启动
systemctl enable docker
// 也可以以下方式启动
service docker start
```
* 执行第一个docker小栗子
```
docker run -p 80:80 -d nginx
// 安装完后，可以在vm外侧浏览器访问该vm的网卡ip nginx地址
```
## 容器vs虚拟机
![虚拟机VS容器](./img/虚拟机VS容器.jpg '')
* 虚拟机
    > 一台物理机可以虚拟多个GuestOS，每个OS上跑各自的应用程序，
    - infrastructure 物理硬件
    - Hypervisor 物理层和操作系统之间的软件层，用来模拟多个操作系统共用一套基础物理硬件
    
    - Guest OS 虚拟系统
    - Bins/Libs 二进制文件和库
    - APP 应用
* Container
    > 
    - infrastructure 物理硬件
    - Host OS 主机系统
    - Docker 系统级的虚拟化技术
    
    - Bins/Libs 二进制文件和库
    - APP 应用

||Container|VM|
| --- | --- | --- |
|启动速度|秒级|分钟级|
|运行性能|接近原生（直接运行到系统上的，与其他进程没有区别）|5%左右的损失(Hypervisor需要对上下层进行数据的转化模拟)|
|磁盘占用|MB|GB|
|数量|成败上千|一般几十台|
|隔离性|进程级别|系统级（更彻底）|
|操作系统|只支持Linux|几乎所有都支持|
|封装程度|只打包项目代码和依赖关系，共享宿主机内核|完整的操作系统|

## docker的应用场景
* 应用程序的打包和发布
* 应用程序的隔离
* 持续集成
    > 产出交付物 -> 镜像
* 部署微服务
    > 微服务：将一个臃肿的重量级服务拆解成 多个独立的 轻量级的 微小服务（灵活部署，弹性伸缩，节省服务器资源）
* 快速搭建测试环境
    > 以前使用一门新技术，需要做很多准备工作，安装启动等等，用docker下载镜像可以快速正常启动
* 提供PaaS产品（平台及服务）
    > PaaS产品可以快速生成 用户可以很轻松的部署管理容器

## docker使用
> [文档](https://docs.docker.com)
* docker info 或者 docker version 查看docker信息
* docker ps 查看运行中的容器
* docker inspect docker_container_id 查看docker容器的ip
    > 查看到ip 后可以使用命令 curl docker_container_ip 访问容器
* docker exec -it docker_container_id bash 通过容器id进入容器
    > 可以通过`ls`查看容器内部的文件目录（容器内很多命令不可以使用，因为docker为了简化镜像）

## 镜像管理

### 镜像概念
* 是什么
    - 一个分层存储的文件
    - 一个软件的环境
    - 一个镜像可以创建n个容器
    - 一种标准化的交付
    - 一个不包含Linux内核而又精简的Linux操作系统
        >镜像不是单一的一个文件，而是由很多次构成。我们可以通过`docker history <ID/NAME>` 查看镜像中各个对应着Dockerfile中的一条指令。
Docker镜像默认存储在`/var/lib/docker/\<storage-driver\>`中。storage-driver可以用 `docker info`查看具体值。
```
// 安装tree 命令 来查看具体docker镜像的目录结构
yum install -y tree

cd /var/lib/docker/\<storage-driver\>

tree
```
* 从哪儿来
    > Docker Hub是由Docker公司负责维护的公共注册中心，包含大量的容器镜像，Docker工具默认从这个公共镜像库下载镜像：[地址](http://hub.docker.com/explore)
```
# 通过docker search image_name查看 docker镜像库中有哪些镜像 如：
docker search nginx
```
* 配置镜像加速器: [地址](https://www.daocloud.io/mirror)
```
# 查看镜像服务器是国外的还是国内的，国外的比较慢
docker info
# 找到 Registry: https://index.docker.io/v1/
ping index.docker.io
# 显示PING us-east-1-elbio-rm5bon1qaeo4-623296237.us-east-1.elb.amazonaws.com (34.193.164.221) 56(84) bytes of data.
# amazonaws.com (34.193.164.221) 美国的域名ip
# 配置一个加速器
curl -sSL https://get.daocloud.io/daotools/set_mirror.sh | sh -s http://f1361db2.m.daocloud.io
```
> [查看各个系统docker加速器的配置](https://www.daocloud.io/mirror)
### 镜像与容器联系
> 容器其实就是在镜像最上面加了一层读写层，在运行容器里文件改动时，先会从镜像里要写的文件复制到容器自己的文件系统中（读写层）。
如果容器删除了，最上面的读写层也删除了， 改动也就丢失了。所以无论多少个容器共享一个镜像，所做的写操作都是从镜像的文件系统中复制过来操作的，并不会修改镜像的源文件，这种方式提高磁盘利用率。
弱项持久化这些改动，可以通过docker commit将容器保存成一个新的新镜像
