# mountState

## 步骤：
- 1新建一个hook，且将hook绑定为函数组件Fiber的`memoizedState`和`workInProgressHook`或者`workInProgressHook.next`，详细介绍请看下面关于`mountWorkInProgressHook`的介绍
- 2生成一个默认state：如果`initialState`参数是一个函数，就执行后再次赋值给自己
- 3将`initialState`赋值给上面第一步新建的`hook`的`memoizedState`属性和`baseState`属性
- 4 生成一个用于修改`initialState`的派发器：`dispatch`，且将其赋值给`hook.queue`

## 源码
```javascript
function mountState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  const hook = mountWorkInProgressHook();
  if (typeof initialState === 'function') {
    // $FlowFixMe: Flow doesn't like mixed types
    initialState = initialState();
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue = (hook.queue = {
    pending: null,
    dispatch: null, // 更改initialState需要的派发dispatch函数， 也就是我们通过useState创建出来的数组的第二个值
    lastRenderedReducer: basicStateReducer, // 最近一次渲染过得reducer函数，
    lastRenderedState: (initialState: any), // 通过useState创建出来的数组的第一个值
  });
  const dispatch: Dispatch<
    BasicStateAction<S>,
  > = (queue.dispatch = (dispatchAction.bind(
    null,
    currentlyRenderingFiber, // workInProgress，当前工作的Fiber
    queue, // 上面创建的对象
  ): any));
  return [hook.memoizedState, dispatch];
}
```

## dispatchAction
[参考文档](dispatchAction解析.md)
