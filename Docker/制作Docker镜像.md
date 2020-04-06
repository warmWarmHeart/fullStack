# DockerFile
## DockerFile格式
```
# 基于哪个原始镜像做镜像
FROM centos:lastest
# 镜像作者
MAINTAINER liuyanjun
# 安装依赖
RUN yum install gcc -y
# 拷贝一个脚本文件到镜像的/usr/bin目录
COPY run.sh /usr/bin
# 指定端口
EXPOSE 80
# 执行脚本
CMD [ "run.sh" ]
```
## DockerFile指令

|指令|描述|
| --- | --- |
| FROM | 构建新镜像基于哪个镜像 |
| MAINTAINER | 镜像维护者姓名或者邮箱地址 |
| RUN | 构建镜像时运行的Shell命令 |
| COPY | 拷贝文件或者目录到镜像中 |
| ENV | 设置环境变量 |
| USER | 为RUN、CMD和ENTRYPOIN执行命令指定运行用户 |
| EXPOSE | 声明容器运行的服务端口 |
| HEALTHCKECK | 容器中服务健康检查 |
| WORKDIR | 为RUN、CMD、ENTRYPOINT、COPY和ADD设置工作目录 |
| ENTRYPOINT | 运行容器时执行，如果有多个ENTRYPOINT指令，最后一个生效 |
| CMD | 运行容器时执行，如果有多个CMD指令，最后一个生效 |

## Build镜像
> `docker build --help`查看帮助命令

```
Usage: docker build [OPTIONS] PATH | URL | -[flags]
```
* Options:
    - t, --tag list # 镜像名称
    -f, --file string # 指定Dockerfile文件位置
    
```
## . 上下文，当前目录
# docker build .
# docker build -t shykes/myapp .
# docker build -t shykes/myapp -f /path/Dockerfile/path
# docker build -t shykes/myapp http://www.example.com/Dockerfile
```
## 构建Nginx、PHP、Tomcat基础镜像
### 构建Nginx基础镜像
* 步骤梳理：
```
* yum 或者 源码编译安装    RUN
    - configure
    - make
    - make install
* 启动哪些模块    RUN
* nginx初始化   RUN 
* 启动 CMD ENTRIPOINT
```

* Dockerfile-nginx示例：
```
# yum clean 、rm -rf等指令可以减少dockerfile大小
FROM centos:7
MAINTAINER liuyj
RUN yum install -y gcc gcc-c++ make \
        openssl-devel pcre-devel gd-devel \
        iproute net-tools telnet wget curl && \
        yum clean all && \
        rm -rf /var/cache/yum/*
RUN wget http://nginx.org/download/nginx-1.16.1.tar.gz && \
    tar zxf nginx-1.16.1.tar.gz && \
    cd nginx-1.16.1 && \
    ./configure --prefix=/usr/local/nginx \
    --with-http_ssl_module \
    --with-http_stub_status_module && \
    make -j 4 && make install && \
    rm -rf /usr/local/nginx/html/* && \
    echo 'ok' >> /usr/local/nginx/html/status.html && \
    cd / && rm -rf nginx-1.16.1* && \
    ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
ENV PATH $PATH:/usr/local/nginx/sbin
COPY nginx.conf /usr/local/nginx/conf/nginx.conf
WORKDIR /usr/local/nginx
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
```
```
FROM centos:7
MAINTAINER by liuyj
WORKDIR /usr/local/src
RUN yum install -y wget
RUN wget http://nginx.org/download/nginx-1.12.1.tar.gz
RUN tar zxvf nginx-1.12.1.tar.gz
WORKDIR nginx-1.12.1
RUN yum -y install gcc gcc-c++ pcre-devel zlib-devel openssl*
RUN useradd -M -u 40 -s /sbin/nologin nginx
RUN ./configure --prefix=/usr/local/nginx --user=nginx --group=nginx --with-file-aio --with-http_stub_status_module --with-http_gzip_static_module --with-http_flv_module --with-http_ssl_module --with-http_realip_module
RUN make
RUN make install
RUN ln -s /usr/local/nginx/sbin/* /usr/local/sbin/
RUN /usr/local/nginx/sbin/nginx
RUN echo "daemon off;">>/usr/local/nginx/conf/nginx.conf

ADD run.sh /usr/local/sbin/run.sh
RUN chmod 755 /usr/local/sbin/run.sh
EXPOSE 80
CMD ["/usr/local/sbin/run.sh"]
```
* 构建
```
docker build -t nginx:v1 -f Dockerfile-nginx .
```
### 构建PHP基础镜像

### 构建Tomcat基础镜像

