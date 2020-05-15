# Fiber对象
看这篇解读前可以先在你的React项目的浏览器控制台执行下面语句，便可以查看你页面某个元素对应的React中Fibe对象

```javascript
// app 是 想看的一个元素Id，也可以换成别的
console.log(document.getElementById('app')._reactRootContainer._internalRoot.current)
```
