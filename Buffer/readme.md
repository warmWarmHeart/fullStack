# Buffer

## 大端序 VS 小端序
很多同学在看 Buffer API 文档时，会发现很多 API 都是 xxxBE 和 xxxLE 两个版本成对出现的，比如：readInt32BE 和 readInt32LE，writeDoubleBE 和 writeDoubleLE 等等。BE 和 LE 分别代表什么含义？它们有什么区别？我们应该用 BE 还是 LE 呢？细心的同学可能还会问为什么 writeInt8 这个 API 没有 BE 和 LE 的版本？
它们的区别在于：Int8 只需要一个字节就可以表示，而 Short，Int32，Double 这些类型一个字节放不下，我们就要用多个字节表示，这就要引入「字节序」的概念，也就是字节存储的顺序。对于某一个要表示的值，是把它的低位存到低地址，还是把它的高位存到低地址，前者叫小端字节序（Little Endian），后者叫大端字节序（Big Endian）。大端和小端各有优缺点，不同的CPU厂商并没有达成一致，但是当网络通讯的时候大家必须统一标准，不然无法通讯了。为了统一网络传输时候的字节的顺序，TCP/IP 协议 RFC1700 里规定使用「大端」字节序作为网络字节序，所以，我们在开发网络通讯协议的时候操作 Buffer 都应该用大端序的 API，也就是 BE 结尾的。
