# processUpdateQueue个人解析
* 先将`UpdateQueue.shared.pending`上的`update`链全部转移到`UpdateQueue.firstBaseUpdate`上
* 循环遍历`UpdateQueue`的`firstBaseUpdate`属性，生成一个新的state，然后赋值给当前Fiber对象`workInProgress`的`memoizedState`属性
* 设置`workInProgress`的`expirationTime`属性
## 源码
```javascript
//   processUpdateQueue(workInProgress, nextProps, null, renderExpirationTime);
export function processUpdateQueue<State>(
  workInProgress: Fiber,
  props: any,
  instance: any,
  renderExpirationTime: ExpirationTime,
): void {
  //在类组件或HostRoot上始终为非空
  // This is always non-null on a ClassComponent or HostRoot
  const queue: UpdateQueue<State> = (workInProgress.updateQueue: any);

  // 强制刷新设置false
  hasForceUpdate = false;

  let firstBaseUpdate = queue.firstBaseUpdate;
  let lastBaseUpdate = queue.lastBaseUpdate;

  //检查是否有挂起的更新。如果是，则将它们转移到基本队列。
  // Check if there are pending updates. If so, transfer them to the base queue.
  let pendingQueue = queue.shared.pending;
  if (pendingQueue !== null) {
    // 此处会将enqueueUpdate(current, update);中的update附加到queue.firstBaseUpdate上 然后将queue.shared.pending 置空
    queue.shared.pending = null;
    //挂起队列是循环队列。断开first和last之间的指针，使其非循环。断开后要将其绑定到queue.firstBaseUpdate上，且将其生成一个新环
    // The pending queue is circular. Disconnect the pointer between first
    // and last so that it's non-circular.
    const lastPendingUpdate = pendingQueue;
    const firstPendingUpdate = lastPendingUpdate.next;
    lastPendingUpdate.next = null;
    //将挂起的更新附加到基本队列
    // Append pending updates to base queue
    // 将pendingQueue的排除最新的一个update后的放在lastBaseUpdate
    if (lastBaseUpdate === null) {
      // 如果lastBaseUpdate未空，证明firstBaseUpdate也为空 所以直接将取出最新的pendingUpdate的
      firstBaseUpdate = firstPendingUpdate;
    } else {
      lastBaseUpdate.next = firstPendingUpdate;
    }
    // render函数第一次执行processUpdateQueue的时候 lastBaseUpdate === firstBaseUpdate === updateContainer函数执行的时候通过enqueueUpdate函数创建的第一个update
    lastBaseUpdate = lastPendingUpdate;

    // 下面这段逻辑同上面一样，只不过是将正宫current的firstBaseUpdate和lastBaseUpdate再设置一遍
    const current = workInProgress.alternate;
    if (current !== null) {
      //在类组件或HostRoot上始终为非空
      // This is always non-null on a ClassComponent or HostRoot
      const currentQueue: UpdateQueue<State> = (current.updateQueue: any);
      const currentLastBaseUpdate = currentQueue.lastBaseUpdate;
      if (currentLastBaseUpdate !== lastBaseUpdate) {
        if (currentLastBaseUpdate === null) {
          currentQueue.firstBaseUpdate = firstPendingUpdate;
        } else {
          currentLastBaseUpdate.next = firstPendingUpdate;
        }
        currentQueue.lastBaseUpdate = lastPendingUpdate;
      }
    }
  }

  //当我们处理队列时，这些值可能会改变。
  // These values may change as we process the queue.
  if (firstBaseUpdate !== null) {
    //遍历更新列表以计算结果。
    // Iterate through the list of updates to compute the result.
    let newState = queue.baseState; // 此处的baseState 等于 null
    let newExpirationTime = NoWork;

    let newBaseState = null;
    let newFirstBaseUpdate = null;
    let newLastBaseUpdate = null;

    let update = firstBaseUpdate;
    // 通过循环语句 遍历queue.firstBaseUpdate;，初始render的时候 只有一个Tag伪UpdateState状态的update，是通过enqueueUpdate(current, update);放进去的
    do {
      const updateExpirationTime = update.expirationTime;
      // Fiber 节点在变更后会形成 update 对象，带有 expirationTime，
      // 插入 updateQueue 中，updateQueue 中所有 update 对象均按照变更（插入）顺序排列，
      // 若高优先级 update 与低优先级 update 同处一个队列，
      // 对于低优先级的 update 会采用跳过方式处理，来保证 Sync 模式与 Concurrent 模式下，最终变更结果是一致的，类似于 git rebase
      // prepareFreshStack函数执行的时候将renderExpirationTime 设置为HostRootFiber的`updateExpirationTime`,所以此处两者相同，进入else语句
      if (updateExpirationTime < renderExpirationTime) {
        //优先级不足。跳过此更新。如果这是第一个跳过的更新，则上一个更新/状态是新的基本更新/状态。
        // Priority is insufficient. Skip this update. If this is the first
        // skipped update, the previous update/state is the new base
        // update/state.
        const clone: Update<State> = {
          expirationTime: update.expirationTime,
          suspenseConfig: update.suspenseConfig,

          tag: update.tag,
          payload: update.payload,
          callback: update.callback,

          next: null,
        };
        if (newLastBaseUpdate === null) {
          newFirstBaseUpdate = newLastBaseUpdate = clone;
          newBaseState = newState;
        } else {
          newLastBaseUpdate = newLastBaseUpdate.next = clone; // 构成环：newLastBaseUpdate.next指向FirstBaseUpdate，相当于FirstBaseUpdate，指向clone 然后LastBaseUpdate也指向clone（FirstBaseUpdate）
        }
        //更新队列中剩余的优先级。
        // Update the remaining priority in the queue.
        if (updateExpirationTime > newExpirationTime) {
          newExpirationTime = updateExpirationTime;
        }
      } else {
        //此更新具有足够的优先级。
        // This update does have sufficient priority.
        if (newLastBaseUpdate !== null) {
            // 第一次走do/while循环会走这里的逻辑
          const clone: Update<State> = {
            expirationTime: Sync, // This update is going to be committed so we never want uncommit it.
            suspenseConfig: update.suspenseConfig,

            tag: update.tag, // UpdateState
            payload: update.payload, // {element: ReactElement也就是<App />}
            callback: update.callback, // null

            next: null,
          };
          newLastBaseUpdate = newLastBaseUpdate.next = clone;
        }
        //处理此更新。
        // Process this update.
        //  第一次render的时候 payload = {element} payload.element 等于Root的React$Element,如<App/>
        // 所以newState = {element}, element指向Root的React$Element
        newState = getStateFromUpdate(
          workInProgress,
          queue,
          update,
          newState,
          props,
          instance,
        );
        const callback = update.callback;
        // 将update的callback统一放在updateQueue的effects上
        if (callback !== null) {
          workInProgress.effectTag |= Callback; // 设置workInProgress的effectTag是callback
          let effects = queue.effects;
          if (effects === null) {
            queue.effects = [update];
          } else {
            effects.push(update);
          }
        }
      }
      update = update.next;
      // 当我们优先完成高优先级任务后，还能继续低优先级任务么？不行，高优先级任务的变更可能对低优先级任务产生影响，低优先级任务必须重新来过，之前收集的 effectList 会被重置为 null，
      // updateQueue 会从 current tree 中恢复回来
      // 未来 React 中 componentWillMount 可能被调用多次，原因就在这里，低优先级任务的 render 阶段可能被重复执行，而 componentWillMount 包含在 render 阶段中。
      if (update === null) {
        pendingQueue = queue.shared.pending;
        if (pendingQueue === null) {
          // 第一次render的时候只执行过一次getStateFromUpdate就跳出此循环，获取到了newState
          break; // 通过break跳出循环
        } else {
          //从减速器内部计划了更新。将新的挂起更新添加到列表末尾并继续处理。
          // An update was scheduled from inside a reducer. Add the new
          // pending updates to the end of the list and keep processing.
          const lastPendingUpdate = pendingQueue;
          //故意不健康。挂起的更新形成一个循环列表，但当将它们传输到基队列时，我们会将其解开
          // Intentionally unsound. Pending updates form a circular list, but we
          // unravel them when transferring them to the base queue.
          const firstPendingUpdate = ((lastPendingUpdate.next: any): Update<State>);
          lastPendingUpdate.next = null;
          update = firstPendingUpdate;
          // 将updatequeue队列的尾指向queue.shared.pending 然后将queue.shared.pending清空
          queue.lastBaseUpdate = lastPendingUpdate;
          queue.shared.pending = null;
        }
      }
    } while (true);

    if (newLastBaseUpdate === null) {
      newBaseState = newState;
    }

    queue.baseState = ((newBaseState: any): State);
    queue.firstBaseUpdate = newFirstBaseUpdate; // 替换成优先级低的队列：if (updateExpirationTime < renderExpirationTime)这里进行保留的队列
    queue.lastBaseUpdate = newLastBaseUpdate;

    //将剩余过期时间设置为队列中剩余的时间。
    //这应该是好的，因为只有两个东西，有助于到期时间是props和上下文。
    // 在开始处理队列时，我们已经处于开始阶段的中间，所以我们已经处理了props。指定shouldComponentUpdate的组件中的上下文是很棘手的；但是无论如何，我们都必须考虑到这一点。
    // Set the remaining expiration time to be whatever is remaining in the queue.
    // This should be fine because the only two other things that contribute to
    // expiration time are props and context. We're already in the middle of the
    // begin phase by the time we start processing the queue, so we've already
    // dealt with the props. Context in components that specify
    // shouldComponentUpdate is tricky; but we'll have to account for
    // that regardless.
    markUnprocessedUpdateTime(newExpirationTime);
    workInProgress.expirationTime = newExpirationTime;
    workInProgress.memoizedState = newState; // 此处的newState 在初始化的时候是{element: Root的React$Element}
  }
}
```


### `getStateFromUpdate`函数
* 含义是从`UpdateQueue`的每一个`update`对象中获取`state`(存储于`payload`属性), 此处返回的是{element: <App />}
```javascript
function getStateFromUpdate<State>(
  workInProgress: Fiber,
  queue: UpdateQueue<State>,
  update: Update<State>,
  prevState: State,
  nextProps: any,
  instance: any,
): any {
  switch (update.tag) {
    case ReplaceState: {
      // 更新内容，比如`setState`接收的第一个参数
      // payload: any, // 初始化的时候 {element: ReactElement}
      const payload = update.payload;
      if (typeof payload === 'function') {
        // Updater function
        const nextState = payload.call(instance, prevState, nextProps);
        return nextState;
      }
      // State object
      return payload;
    }
    // 捕获更新
    case CaptureUpdate: {
      workInProgress.effectTag =
        (workInProgress.effectTag & ~ShouldCapture) | DidCapture;
    }
    // 故意失误
    // Intentional fallthrough
    // 第一次render的时候tag是UpdateState
    case UpdateState: {
      const payload = update.payload; // 第一次render的时候 payload = {element} payload.element 等于Root的React$Element,如<App/>
      let partialState;
      // 第一次render的时候 typeof payload === FiberNode对象
      if (typeof payload === 'function') {
        // Updater function
        partialState = payload.call(instance, prevState, nextProps);
      } else {
        // Partial state object
        partialState = payload;
      }
      if (partialState === null || partialState === undefined) {
        // Null and undefined are treated as no-ops.
        return prevState;
      }
      // Merge the partial state and the previous state.
      // 第一次 prevState和partialState都是 <App /> 所以最终结果还是{element: <App>}
      return Object.assign({}, prevState, partialState);
    }
    case ForceUpdate: {
      hasForceUpdate = true;
      return prevState;
    }
  }
  return prevState;
}
```

### `markUnprocessedUpdateTime`函数
* 是根据`expirationTime`大小来设置变量`workInProgressRootNextUnprocessedUpdateTime`
```javascript
export function markUnprocessedUpdateTime(
  expirationTime: ExpirationTime,
): void {
  if (expirationTime > workInProgressRootNextUnprocessedUpdateTime) {
    workInProgressRootNextUnprocessedUpdateTime = expirationTime;
  }
}
```
