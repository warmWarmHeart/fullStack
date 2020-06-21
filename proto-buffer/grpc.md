# gRPC
## gRPC是什么？
[GRPC官方文档](http://doc.oschina.net/grpc?t=56831)
gRPC  是一个高性能、开源和通用的 RPC 框架，面向移动和 HTTP/2 设计

gRPC 基于 HTTP/2 标准设计，带来诸如双向流、流控、头部压缩、单 TCP 连接上的多复用请求等特。这些特性使得其在移动设备上表现更好，更省电和节省空间占用。

所谓RPC(remote procedure call 远程过程调用)框架实际是提供了一套机制，使得应用程序之间可以进行通信，而且也遵从server/client模型。使用的时候客户端调用server端提供的接口就像是调用本地的函数一样。如下图所示就是一个典型的RPC结构图。
![grpc](img/grpc.png)

## gRPC vs. Restful API
gRPC和restful API都提供了一套通信机制，用于server/client模型通信，而且它们都使用http作为底层的传输协议(严格地说, gRPC使用的http2.0，而restful api则不一定)。不过gRPC还是有些特有的优势，如下：

* gRPC可以通过protobuf来定义接口，从而可以有更加严格的接口约束条件。
* 另外，通过protobuf可以将数据序列化为二进制编码，这会大幅减少需要传输的数据量，从而大幅提高性能。
* gRPC可以方便地支持流式通信(理论上通过http2.0就可以使用streaming模式, 但是通常web服务的restful api似乎很少这么用，通常的流式数据应用如视频流，一般都会使用专门的协议如HLS，RTMP等，这些就不是我们通常web服务了，而是有专门的服务器应用。）

## 使用场景
需要对接口进行严格约束的情况，比如我们提供了一个公共的服务，很多人，甚至公司外部的人也可以访问这个服务，这时对于接口我们希望有更加严格的约束，我们不希望客户端给我们传递任意的数据，尤其是考虑到安全性的因素，我们通常需要对接口进行更加严格的约束。这时gRPC就可以通过protobuf来提供严格的接口约束。
对于性能有更高的要求时。有时我们的服务需要传递大量的数据，而又希望不影响我们的性能，这个时候也可以考虑gRPC服务，因为通过protobuf我们可以将数据压缩编码转化为二进制格式，通常传递的数据量要小得多，而且通过http2我们可以实现异步的请求，从而大大提高了通信效率。

## gRPC 概念
### 服务定义
```
service HelloService {
  rpc SayHello (HelloRequest) returns (HelloResponse);
}

message HelloRequest {
  required string greeting = 1;
}

message HelloResponse {
  required string reply = 1;
}
```

### gRPC 允许你定义四类服务方法
* 单项 RPC
即客户端发送一个请求给服务端，从服务端获取一个应答，就像一次普通的函数调用。
使用场景：普通的远程调用，像http一样，即请求-响应。
```
rpc SayHello(HelloRequest) returns (HelloResponse){
}
```
* 服务端流式 RPC
即客户端发送一个请求给服务端，可获取一个数据流用来读取一系列消息。客户端从返回的数据流里一直读取直到没有更多消息为止
使用场景：一次请求，建立连接后，服务端多次数据返回。比如请求某个股票接口，需要源源不断获取实时的股票信息。
```
rpc LotsOfReplies(HelloRequest) returns (stream HelloResponse){
}
```
* 客户端流式 RPC
即客户端用提供的一个数据流写入并发送一系列消息给服务端。一旦客户端完成消息写入，就等待服务端读取这些消息并返回应答。
使用场景：一次请求，建立连接后，客户端在此连接上多次向服务端发送消息，待客户端发送完毕，服务端再返回响应。比如以下实例： 做一个加法的服务，服务端接收客户端传过来的一系列的数字（int型），然后进行所有数字的和、数字数量和平均值的统计，将最终统计结果返回给调用者。
```
rpc LotsOfGreetings(stream HelloRequest) returns (HelloResponse) {
}
```
* 双向流式 RPC
即两边都可以分别通过一个读写数据流来发送一系列消息。这两个数据流操作是相互独立的，所以客户端和服务端能按其希望的任意顺序读写，例如：服务端可以在写应答前等待所有的客户端消息，或者它可以先读一个消息再写一个消息，或者是读写相结合的其他方式。每个数据流里消息的顺序会被保持。
使用场景：一次请求，建立连接后，客户端与服务端可向对方发送消息，比如机器人聊天程序，以下是实现一个极其简易的聊天室
```
rpc BidiHello(stream HelloRequest) returns (stream HelloResponse){}
```
