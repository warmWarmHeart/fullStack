# Nginx简单教程
> Nginx(engine x)是一个高性能的HTTP和反向代理的web服务器， 同时也提供了IMAP/POP3/SMTP服务。
 Nginx是一款轻量级的Web服务器， 因为它的稳定性和丰富的功能集、示例配置文件和低系统资源消耗而闻名。
 其特点是占用内存少，并发能力强， 事实上Nginx的并发能力在同类型的web服务器中表现良好。

## 选择Nginx的理由
* 高并发 （官方测试Nginx能够支持5万并发连接，在实际生产环境中可支撑2-4万并发连接数）
> 得益于内核epoll Nginx是多进程+异步非阻塞模式（I/O 多路复用 epoll），
* 消耗内存少 在同等硬件环境下，Nginx的处理能能力相当于Apache的5-10倍
* 成本低廉 可免费用 可用于商业用途
* 其他理由：
    - 配置文件非常简单
    - 支持Rewrite重写规则
    - 内置健康检查功能
    -节省带宽
    - 稳定性高
    - ...

## Nginx的安装和配置

### 安装前准备

* gcc编译器： 用于官网源码进行编译，依赖于gcc环境

```
yum -y install gcc gcc-c++ autoconf automake
```

* 依赖模块： Nginx的一些模块需要第三方库支持

```
    yum -y install zlib zlib-devel openssl openssl-devel pcre pcre-devel
```
* 下载地址： http://nginx.org/en/download.html

```
    // wget 是一个从网络上自动下载文件的自由工具
    yum -y install wget
    wget -o /tmp/nginx.tar.gz http://nginx.org/download/nginx-1.16.1.tar.gz
```

### Nginx编译安装
* 解压

```
    tar -zxvf /tmp/nginx.tar.gz
    cd /tmp/nginx-1.16.1
```
    
* 配置安装路径
```
./configure --prefix=/usr/local/nginx         ##设置Nginx安装路径，如果没有指定，默认为/usr/local/nginx
make                                           ##make的过程是把各种语言写的源码文件，变成可执行文件和各种库文件
make install
```
    
* 查看nginx是否安装成功
```
    cd /usr/local/nginx/sbin
    ./nginx
    
    ./nginx -s stop  #停止
```
### 环境变量的配置
 ```
    yum -y install vim
    vim /etc/profile
    // shift + G 跳转到最后一行，输入i进入命令模式
    NGINX_HOME=/usr/local/nginx
    export PATH=$PATH:$NGINX_HOME/sbin
    // 按esc,输入 :wq 保存退出 且输入source命令刷新 path配置
    source /etc/profile
 
    // 接下来就可以使用快捷方式nginx
 ```
 ### Nginx基本命令
 * nginx // 启动nginx
 * nginx -s stop // 关闭nginx
 * nginx -s quit // 关闭nginx 推荐 会处理完所有请求后关闭
 * nginx-s reload // 重启nginx
 ### 更改nginx默认页
 ```
    cd /usr/local/nginx/html/index.html
    i
    esc
    :wq
 ```
 
 ## Nginx配置和优化
 * 配置文件结构
 * 虚拟主机配置
 * 日志配置和切割
 * 压缩输出配置
 * ...
 
 ### 配置文件的结构
 ```
    cd /usr/local/nginx/conf/
 ```
 
 ```
 # 指定工作衍生的进程
 # ------------- 全局区域start----------
 # 使用的用户和组
 # user www www
 # user nobody;
 
 # 指定工作衍生的进程 可设置cup核数的双倍；
 worker_processes 1;
 
 # 指定错误日志存放路径
 # error_log logs/error.log;
 # error_log logs/error.log notice;
 # error_log logs/error.log info;
 
 #pid  logs/nginx.pid
 
 # ------------- 全局区域end----------

 # ------------- event区域 start----------
 # https://blog.csdn.net/qq_26711103/article/details/81117770
 events {
    # 允许最大连接数
    worker_connections 1024;
    accept_mutex on; #设置网路连接序列化，防止惊群现象发生，默认为on
    
    multi_accept on; #设置一个进程是否同时接受多个网络连接，默认为off
    
    #use epoll; #事件驱动模型，select|poll|kqueue|epoll|resig|/dev/poll|eventport
        
    client_header_buffer_size 4k;
    
    # 超时时间。 这里指的是http层面的keep-alive 并非tcp的keepalive
    keepalive_timeout 60;
    
    #为打开文件指定缓存，默认是没有启用的，max指定缓存最大数量，建议和打开文件数一致，inactive是指经过多长时间文件没被请求后删除缓存 打开文件最大数量为我们再main配置的worker_rlimit_nofile参数
    open_file_cache max=2000 inactive=60s;
    
    # 多长时间检查一次缓存的有效信息。如果有一个文件在inactive时间内一次没被使用，它将被移除
    open_file_cache_valid 60s;
    
    # open_file_cache指令中的inactive参数时间内文件的最少使用次数，如果超过这个数字，文件描述符一直是在缓存中打开的，如果有一个文件在inactive时间内一次没被使用，它将被移除
    open_file_cache_min_uses 1
 }
 # ------------- event区域 end----------
 
 # ------------- http区域 start----------
 http {
    # 文件扩展名与文件类型映射表 资源媒体类型：当web服务器收到静态的资源文件请求时，依据请求文件的后缀名在服务器的MIME配置文件中找到对应的MIME Type，再根据MIME Type设置HTTP Response的Content-Type，然后浏览器根据Content-Type的值处理文件。
    include mime.types;
    # 默认处理程序
    default_type application/octet-stream;
    # 默认字符集 一般不在这里设置 而是在html头部设置
    charset utf-8;
    
    # log_format main '$remote_addr - $remote_user [$time_local] "$request"'
    #                  '$status $body_bytes_sent "$http_referer"'
    #                  '"$http_user_agent" "$http_x_forwarded_for"'
    
    # access_log logs/access.log main;
    
    sendfile on;
    # tcp_nopush on;
    
    #keepalive_timeout 0;
    keepalive_timeout 65;
    
    #gzip on;
    #gzip_min_length 1k;
    #gzip_buffers 4 16k;
    #gzip_http_version 1.1;
    #gzip_comp_level 2;
    #gzip_type text/plain application/x-javascript text/css application/xml;
    #gzip_vary on;
    
    # 别名 可以在代理 proxy_pass那里使用别名
    # upstream myserver1 {
    #     配置多个server 就是负载均衡
    #     server 192.163,2,222:8080;
    #     server 192.163,2,222:8081;
    # }
    #  upstream myserver2 {
    #     server 192.163,2,222:8081;
    # }
    
    # 主机设置
    server {
        listen 80; # 端口
        server_name localhost; # 域名 如果以后有自己的域名 就是在这里配置  如： aa.domain.com
        
        # charset koi8-r;
        
        # 访问日志
        # access_log logs/access.log main;

        location / {
            root /data/bb.com; # 网站目录
            index index.html index.html;
            
            #代理
            #proxy_pass http:192.168.2.11:8080;
            #index index.html index.html;
        }
        
        # error_page 404 /404.html;
        # error_page 505 502 503 504 /50x.html;
        
      
    }
    
 }
 # ------------- http区域 end----------
 ```
 
 ## Nginx高级一些应用
 
 ### Rewrite 重写
 * Rewrite主要功能就是实现URL重写。
 * 通过Rewrite规则， 就可以实现规范的URL。
 
 ### 反向代理及负载均衡
 * 反向代理
    > 指以代理服务器来接收internet上的链接请求，然后将请求转发给网络上的服务器，并将从该服务器得到的结果返回给internet 上请求链接的客户端，此时代理服务器对外就像表现为一个服务器。
 * 负载均衡
    > 由多台服务器以对称的方式组成一个服务器集合，每台服务器都具有等价的地位，都可以独立对外提供服务而无需其他服务器的辅助
 ```
    server {
        location / {
            rewrite ^(.*).htmp$ /rewrite.html;
        }
    }
 ```
 
 ## 添加nginx到service ：支持service nginx start
 ```
    cd /usr/lib/systemd/system
    // 新建一个nginx.service
    //待完善
 ```
 
