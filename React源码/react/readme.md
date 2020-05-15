# 这里主要会分析reat中的方法

## Component

```javascript
function Component(props, context, updater) {
  this.props = props;
  this.context = context;
  //如果一个组件有字符串引用，我们稍后将分配一个不同的对象。
  this.refs = emptyObject;
  //我们初始化了默认的更新程序，但是真正的更新程序被渲染器注入。
  // 这里会在执行react-dom的render方法的时候注入： adoptClassInstance、constructClassInstance
  this.updater = updater || ReactNoopUpdateQueue;
}
```

```javascript
Component.prototype.setState = function(partialState, callback) {
 
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};
Component.prototype.forceUpdate = function(callback) {
  this.updater.enqueueForceUpdate(this, callback, 'forceUpdate');
};
```

* `enqueueSetState`主要是获取程序运行开始到当前时间差，并且利用此差值计算出一个过期该任务过期时间，最后生成一个用来标记此任务的`update`对象，然后将它绑定到实例`fiber`上的`UpdateQueue.shared.pending`
最后开始执行`scheduleUpdateOnFiber()`。`scheduleUpdateOnFiber()`是`react`很重要的一个调度Fiber更新函数,后面会详细讲解
> `enqueueReplaceState`和`enqueueForceUpdate`跟`enqueueSetState`的步骤基本相同，只是将创建的`update`对象的`tag`属性分别设置为`ReplaceState`和`ForceUpdate`
```javascript
const classComponentUpdater = {
  isMounted(component: React$Component<any, any>): boolean {
      // Fiber参考 [Fiber源码分析](../Fiber/Fiber源码详解)
      // component._reactInternalFiber 是在render阶段绑定上的。 adoptClassInstance/constructClassInstance绑定的fiber
      const fiber: ?Fiber = getInstance(component);
      if (!fiber) {
          return false;
      }
      // getNearestMountedFiber 会返回null, 除非fiber.tag是HostRoot
      return getNearestMountedFiber(fiber) === fiber;
  },
  // inst实例，payload就是setState的第一个参数 可以是function也可以是对象，callback是setState第二个参数
  enqueueSetState(inst, payload, callback) {
    const fiber = getInstance(inst);
    const currentTime = requestCurrentTimeForUpdate(); // 获取程序执行到此时的事件差
    const suspenseConfig = requestCurrentSuspenseConfig(); // 悬停的配置
    const expirationTime = computeExpirationForFiber( // 计算一个执行此任务的过期时间，该时间决定该任务执行的优先级 ！@@！
      currentTime,
      fiber,
      suspenseConfig,
    );

    // 生成一个Update对象 数据格式是{
    //  expirationTime, // 这里的expirationTime可能比renderExpirationTime 小 1
    //  suspenseConfig,
    //  四个状态，更新updateState 0、替换replaceState 1、强制forceUpdate 2、throw 捕获 captureUpdate 3
    //  tag: UpdateState,
    //  payload: null, //  实际操作内容，在外面赋值上去 update.payload = { element } 初次渲染传入的是元素，setState 可能传入的就是对象或者方法
    //  callback: null, //对应的回调，比如setState({}, callback )
    //  next: null,// 下一个 update 单向链表
    // };
    const update = createUpdate(expirationTime, suspenseConfig);
    update.payload = payload;
    // 将callback绑定到update的callback上
    if (callback !== undefined && callback !== null) {
      update.callback = callback;
    }
    // 将新建的update放到fiber.UpdateQueue.shared.pending上，
    enqueueUpdate(fiber, update);
    scheduleUpdateOnFiber(fiber, expirationTime);
  },
  enqueueReplaceState(inst, payload, callback) {
    ...
    update.tag = ReplaceState;
    ...
  },
  enqueueForceUpdate(inst, callback) {
    ...
    update.tag = ForceUpdate;
    ...
  },
};
```
* `scheduleUpdateOnFiber`解析
```javascript

```
