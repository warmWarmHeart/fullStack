# useReducer 解读
## 步骤分解
* 通过[mountWorkInProgressHook](mountWorkInProgressHook解析.md)创建一个属于它自己的hook对象，用来存放它所属的reducer函数及改变`reducer`的`dispatch`事件
* 设置初始 `initialState`，也就是 我们 调用`useReducer`所传入的第二个参数
* 创建一个 `queue`对象
* 利用 [dispatchAction](dispatchAction解析.md)创建一个dispatch 函数，然后绑定到`queue.dispatch`上

## `mountReducer` 源码
```javascript
function mountReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
  const hook = mountWorkInProgressHook();
  let initialState;
  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = ((initialArg: any): S);
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer, // 此处是useReducer与useState不同的地方，用来在执行dispatchAction的时候进行区别对待
    lastRenderedState: (initialState: any),
  });
  const dispatch: Dispatch<A> = (queue.dispatch = (dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue,
  ): any));
  return [hook.memoizedState, dispatch];
}
```
