# useCallback 解读
* 新建一个hook，且将hook绑定为函数组件Fiber的`memoizedState`和`workInProgressHook`或者`workInProgressHook.next`
* 将`workInProgressHook`重新设置为上面新建的`hook`，方便下次有hook钩子调用的时候接着为它的`next`属性赋值
* 给上面新建的`hook`的`memoizedState`属性赋值：`[callback, nextDeps]`
    > 以后当函数组件再次执行的时候，会对比`nextDeps`中每个变量的新旧值，如果新旧值相同，就去保存过得`hook`的`memoizedState`中的`callback`，否则将新传递进来的`callback`返回给组件实例用
    > 所以当函数组件用 `useCallback`的时候，你所传进去的`callback`并不是你会用到的回调函数，可能是之前的旧callback

## 步骤分析
* 利用[`mountWorkInProgressHook`](mountWorkInProgressHook解析.md)创建一个属于调用此次`useCallback`所独有的hook对象
* 给`hook`绑定`memoizedState`属性，值为 **回调函数** 和 **依赖项**
## mount源码
```javascript
function mountCallback<T>(callback: T, deps: Array<mixed> | void | null): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  hook.memoizedState = [callback, nextDeps];
  return callback;
}
```
