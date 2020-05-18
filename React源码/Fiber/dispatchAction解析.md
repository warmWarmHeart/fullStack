# dispatchAction 解析
* `dispatchAction`会在函数组件使用`useState`、`useReducer`这两个`hook`钩子的时候先利用bind方法先绑定该函数执行的执行Fiber及`queue`
* `dispatchAction`的作用就是用来改变函数组件中利用`useState`创建的`state`或者改变利用`useReducer`创建的`reducer`
    - useState 和 useReducer源码中使用 dispatchAction的部分代码：
        ```javascript
          const queue = (hook.queue = {
              pending: null,
              dispatch: null,
              lastRenderedReducer: reducer || basicStateReducer, // 此处是useReducer与useState不同的地方，用来在执行dispatchAction的时候进行区别对待
              lastRenderedState: (initialState: any),
            })
          const dispatch: Dispatch<A> = (queue.dispatch = (dispatchAction.bind(
                null,
                currentlyRenderingComponent,
                queue,
              ): any));
        ```
    - 参数：
        + Fiber： currentlyRenderingFiber === workInProgress
        + queue是如下对象：
            ```javascript
              {
                pending: null,
                dispatch: null, // 由`dispatchAction`创建出来的派发器就存放在此处
                lastRenderedReducer: reducer || basicStateReducer, // 此处是useReducer与useState不同的地方，用来在执行dispatchAction的时候进行区别对待
                lastRenderedState: (initialState: any),
              }
            ```
        + action：是用来改变`state`的新动作或者新值
        
### basicStateReducer
* 调用`useState`hook钩子的时候赋值给`dispatchAction`参数之一`queue`对象的`lastRenderedReducer`属性
```javascript
// 基态Reducer
function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  //$FlowFixMe:流不喜欢混合类型
  // $FlowFixMe: Flow doesn't like mixed types
  return typeof action === 'function' ? action(state) : action;
}
```
## 执行步骤
* 获取当前时间距离程序开始运行的时间差current
* 根据current和当前调度优先级priorityLevel:NormalPriority计算一个大概比current大500的过期时间expirationTime
* 判断当前执行阶段是初次渲染阶段还是updateState阶段
    - 如果是初次渲染阶段：
        + didScheduleRenderPhaseUpdate = true;
        + update.expirationTime = renderExpirationTime;
        + currentlyRenderingFiber.expirationTime = renderExpirationTime;
    - 如果是需要更新state或者reducer状态，则：
        + 如果当前hook是useReducer，根据`lastRenderedReducer`和`action`计算出新的`state`对象，然后判断新旧`state`是否相等，如果相等直接退出函数
        + 调用[`scheduleUpdateOnFiber`函数](../react-dom/scheduleUpdateOnFiber解析.md)开始调度更新Fiber
## 源码
```javascript
function dispatchAction<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>, // 此处的UpdateQueue和 workInProgress.UpdateQueue是两回事
  action: A,
) {
    // 生成当前执行时间与react应用开始执行的时间差
  const currentTime = requestCurrentTimeForUpdate();
  const suspenseConfig = requestCurrentSuspenseConfig();
  // 后面调用dispatchAction的时候该值越来越大
  // 利用上面获取的currentTime和suspenseConfig得到一个过期时间 过期时间是通过 computeAsyncExpiration计算得出的的，大概比currentTime大 500左右
  const expirationTime = computeExpirationForFiber(
    currentTime,
    fiber,
    suspenseConfig,
  );

  // 此处的Update和workInProgress对象上的类型Update也是两个不同的类型
  const update: Update<S, A> = {
    expirationTime,
    suspenseConfig,
    action, // 此处如果是useState钩子的话  就是 set[NAME]的参数
    eagerReducer: null,
    eagerState: null,
    next: (null: any),
  };

  //将更新追加到列表的末尾。
  // Append the update to the end of the list.
  const pending = queue.pending;
  if (pending === null) {
    // 第一次创建一个闭合环
    // This is the first update. Create a circular list.
    update.next = update;
  } else {
    // 将update加入到queue.pending中
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;

  const alternate = fiber.alternate;
  if (
    fiber === currentlyRenderingFiber || // renderWithHooks执行的时候将currentlyRenderingFiber设置为workInProgress
    (alternate !== null && alternate === currentlyRenderingFiber)
  ) {
    //这是渲染阶段更新。将它保存在一个惰性创建的队列映射->更新的链接列表中。在此渲染过程之后，我们将重新启动并在work-in-progress hook的顶部应用隐藏的更新
    // This is a render phase update. Stash it in a lazily-created map of
    // queue -> linked list of updates. After this render pass, we'll restart
    // and apply the stashed updates on top of the work-in-progress hook.
    // 比如： const [name, setName] = useState('liu'); setName未在某个事件中触发 而是直接在渲染的时候触发 这时候会走到这里
    didScheduleRenderPhaseUpdate = true;
    update.expirationTime = renderExpirationTime;
    currentlyRenderingFiber.expirationTime = renderExpirationTime;
  } else {
      // 这里的逻辑会在渲染结束后调用 dispatch改变state或者reducer的时候触发
    if (
      fiber.expirationTime === NoWork &&
      (alternate === null || alternate.expirationTime === NoWork)
    ) {
      //队列当前为空，这意味着我们可以在进入呈现阶段之前急切地计算下一个状态。如果新的state和现在的state一样，我们也许能够完全摆脱困境。
      // The queue is currently empty, which means we can eagerly compute the
      // next state before entering the render phase. If the new state is the
      // same as the current state, we may be able to bail out entirely.
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        let prevDispatcher;
        try {
          const currentState: S = (queue.lastRenderedState: any);
          const eagerState = lastRenderedReducer(currentState, action);
          //将急切计算出的状态和用于计算它的reducer保存在update对象上。如果在我们进入渲染阶段时还原器还没有改变，那么可以在不再次调用还原器的情况下使用急切状态。
          // Stash the eagerly computed state, and the reducer used to compute
          // it, on the update object. If the reducer hasn't changed by the
          // time we enter the render phase, then the eager state can be used
          // without calling the reducer again.
          update.eagerReducer = lastRenderedReducer;
          update.eagerState = eagerState;
          if (is(eagerState, currentState)) {
            //快车道。我们可以在不安排重新渲染的情况下进行救援。如果组件由于不同的原因重新呈现，并且此时还原器已更改，则我们以后仍有可能需要重新调整此更新。
            // Fast path. We can bail out without scheduling React to re-render.
            // It's still possible that we'll need to rebase this update later,
            // if the component re-renders for a different reason and by that
            // time the reducer has changed.
            return;
          }
        } catch (error) {
          // Suppress the error. It will throw again in the render phase.
        } finally {
         
        }
      }
    }
   
    scheduleUpdateOnFiber(fiber, expirationTime);
  }
}
```
