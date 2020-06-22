# webSocket
WebSocket是HTML5开始提供的一种浏览器与服务器间进行全双工通讯的网络技术。 WebSocket通信协议于2011年被IETF定为标准 RFC 6455，WebSocketAPI 被 W3C 定为标准。

> 现在，很多网站为了实现即时通讯(real-time)，所用的技术都是轮询(polling)。轮询是在特定的的时间间隔(time interval)（如每1秒），由浏览器对服务器发出HTTP request，然后由服务器返回最新的数据给客服端的浏览器。这种传统的HTTP request d的模式带来很明显的缺点 – 浏览器需要不断的向服务器发出请求(request)，然而HTTP request 的header是非常长的，里面包含的数据可能只是一个很小的值，这样会占用很多的带宽。
而最比较新的技术去做轮询的效果是Comet – 用了AJAX。但这种技术虽然可达到全双工通信，但依然需要发出请求(reuqest)。在 WebSocket API，浏览器和服务器只需要要做一个握手的动作，然后，浏览器和服务器之间就形成了一条快速通道。两者之间就直接可以数据互相传送

## 特点
* server push
    > 它的最大特点就是，服务器可以主动向客户端推送信息，客户端也可以主动向服务器发送信息，是真正的双向平等对话，属于服务器推送技术的一种。
      
* 建立在 TCP 协议之上，服务器端的实现比较容易。
  
* 与 HTTP 协议有着良好的兼容性。默认端口也是80和443，并且握手阶段采用 HTTP 协议，因此握手时不容易屏蔽，能通过各种 HTTP 代理服务器。
  
* 数据格式比较轻量，性能开销小，通信高效。
  
* 可以发送文本，也可以发送二进制数据。
  
* 没有同源限制，客户端可以与任意服务器通信。
  
* 协议标识符是ws（如果加密，则为wss），服务器网址就是 URL。
![ws](img/ws.jpg)

## 简单实例
```javascript
var ws = new WebSocket("wss://echo.websocket.org");

ws.onopen = function(evt) { 
  console.log("Connection open ..."); 
  ws.send("Hello WebSockets!");
};

ws.onmessage = function(evt) {
  console.log( "Received Message: " + evt.data);
  ws.close();
};

ws.onclose = function(evt) {
  console.log("Connection closed.");
}
```

## 客户端API

* 构造函数 WebSocket： 用于新建 WebSocket 实例
```javascript
var ws = new WebSocket('ws://localhost:8080');
```
* ws.readyState: 返回实例的当前状态

| type| value | 说明 |
| ---- | ---- | ---- |
| CONNECTING | 正在连接 |
| OPEN | 连接成功 |
| CLOSING | 正在关闭 |
| CLOSED | 成功关闭，或者打开连接失败 |

```javascript
switch (ws.readyState) {
  case WebSocket.CONNECTING:
    // do something
    break;
  case WebSocket.OPEN:
    // do something
    break;
  case WebSocket.CLOSING:
    // do something
    break;
  case WebSocket.CLOSED:
    // do something
    break;
  default:
    // this never happens
    break;
}
```

* ws.onopen: 指定连接成功后的回调函数
```javascript
ws.onopen = function () {
  ws.send('Hello Server!');
}

// 用addEventListener指定多个回调函数
ws.addEventListener('open', function (event) {
  ws.send('Hello Server!');
});
```

* ws.onclose: 指定连接关闭后的回调函数
```javascript
ws.onclose = function(event) {
  var code = event.code;
  var reason = event.reason;
  var wasClean = event.wasClean;
  // handle close event
};

ws.addEventListener("close", function(event) {
  var code = event.code;
  var reason = event.reason;
  var wasClean = event.wasClean;
  // handle close event
});
```
* ws.onmessage: 收到服务器数据后的回调函数
> 注意，服务器数据可能是文本，也可能是二进制数据（blob对象或Arraybuffer对象）
```javascript
ws.onmessage = function(event) {
  var data = event.data;
  // 处理数据
};

ws.addEventListener("message", function(event) {
  var data = event.data;
  // 处理数据
});
```
> 除了动态判断收到的数据类型，也可以使用binaryType属性，显式指定收到的二进制数据类型。
```javascript

// 收到的是 blob 数据
ws.binaryType = "blob";
ws.onmessage = function(e) {
  console.log(e.data.size);
};

// 收到的是 ArrayBuffer 数据
ws.binaryType = "arraybuffer";
ws.onmessage = function(e) {
  console.log(e.data.byteLength);
};
```
* ws.send: 向服务器发送数据。
```javascript
// 文本
ws.send('your message');
// 发送 Blob 对象的例子。
var file = document.querySelector('input[type="file"]').files[0];
ws.send(file)
// 发送 ArrayBuffer 对象的例子。
var img = canvas_context.getImageData(0, 0, 400, 320);
var binary = new Uint8Array(img.data.length);
for (var i = 0; i < img.data.length; i++) {
  binary[i] = img.data[i];
}
ws.send(binary.buffer);
```
* ws.bufferedAmount：表示还有多少字节的二进制数据没有发送出去。它可以用来判断发送是否结束
```javascript
var data = new ArrayBuffer(10000000);
socket.send(data);

if (socket.bufferedAmount === 0) {
  // 发送完毕
} else {
  // 发送还没结束
}
```
* ws.onerror

**本文摘录自博客[websocket教程](http://www.ruanyifeng.com/blog/2017/05/websocket.html)**
