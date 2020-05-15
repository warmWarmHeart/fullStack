# `MountHostRootComponent`阶段相关代码解析

## updateHostRoot

* `render`第一次执行`beginWork`的时候，`workInProgress.tag` 等于 `HostRoot`, 所以我们先看 `updateHostRoot`源码

```javascript
function updateHostRoot(current, workInProgress, renderExpirationTime) {
  pushHostRootContext(workInProgress); // 设置root相关context的变量指针
  const updateQueue = workInProgress.updateQueue;
  const nextProps = workInProgress.pendingProps;
  const prevState = workInProgress.memoizedState; // 第一次render的时候是null
  const prevChildren = prevState !== null ? prevState.element : null; // null
  // 将两个updateQueue分别指向不同的地方
  cloneUpdateQueue(current, workInProgress);
  // 得到新的state
  // 整体而言，这个方法要做的事情，就是遍历这个 UpdateQueue ，然后计算出最后的新 State，然后存到workInProgress.memoizedState中。
  // workInProgress.memoizedState={element: React$Element}
  processUpdateQueue(workInProgress, nextProps, null, renderExpirationTime);
  // 第一次render的时候获取到的workInProgress.memoizedState={element: React$Element <App>}
  const nextState = workInProgress.memoizedState;
  // Caution: React DevTools currently depends on this property
  // being called "element".
  const nextChildren = nextState.element;
  // 因为prevChildren是null 所以不会走下面if逻辑
  if (nextChildren === prevChildren) {
    //如果state和以前一样，那就是bailout，因为我们此时没有过期的工作
    // If the state is the same as before, that's a bailout because we had
    // no work that expires at this time.
    resetHydrationState();
    return bailoutOnAlreadyFinishedWork(
      current,
      workInProgress,
      renderExpirationTime,
    );
  }
  const root: FiberRoot = workInProgress.stateNode;
  
  // 这里是同构相关代码 可以先略过
  if (root.hydrate && enterHydrationState(workInProgress)) {
      //如果我们现在没有孩子，这可能是第一次。
      //我们总是试图补充水分。如果这不是一个补水通道，将不会有任何儿童补水，这是有效的相同的事情没有补水。
    // If we don't have any current children this might be the first pass.
    // We always try to hydrate. If this isn't a hydration pass there won't
    // be any children to hydrate which is effectively the same thing as
    // not hydrating.

    let child = mountChildFibers(
      workInProgress,
      null,
      nextChildren,
      renderExpirationTime,
    );
    workInProgress.child = child;

    let node = child;
    while (node) {
      // Mark each child as hydrating. This is a fast path to know whether this
      // tree is part of a hydrating tree. This is used to determine if a child
      // node has fully mounted yet, and for scheduling event replaying.
      // Conceptually this is similar to Placement in that a new subtree is
      // inserted into the React tree here. It just happens to not need DOM
      // mutations because it already exists.
      node.effectTag = (node.effectTag & ~Placement) | Hydrating;
      node = node.sibling;
    }
  } else {
    //否则重置水合状态，以防我们中止并恢复另一根。
    // 创建
    // Otherwise reset hydration state in case we aborted and resumed another
    // root.
    // 为nextChild绑定一个fiber，且将该fiber的return指向workInProgress
    reconcileChildren(
      current,
      workInProgress,
      nextChildren,
      renderExpirationTime,
    );
    resetHydrationState();
  }
  return workInProgress.child;
}
```

### `pushHostRootContext`
* 将`contextStackCursor.current` 设置成 `FiberRoot.context`
* 将`didPerformWorkStackCursor.current` 设置成 `false`
* 将`rootInstanceStackCursor.current` 设置成 `root.containerInfo`
* 将`contextFiberStackCursor.current` 设置成 `HostRootFiber`
* 下面是相关设置以上指标所涉及的源码：

```javascript
function pushHostRootContext(workInProgress) {
  const root = (workInProgress.stateNode: FiberRoot);
  if (root.pendingContext) {
    pushTopLevelContextObject(
      workInProgress,
      root.pendingContext,
      root.pendingContext !== root.context,
    );
  } else if (root.context) {
    // Should always be set
    pushTopLevelContextObject(workInProgress, root.context, false);
  }
  pushHostContainer(workInProgress, root.containerInfo);
}
```
```javascript
function pushTopLevelContextObject(
  fiber: Fiber,// 镜像FiberNode
  context: Object, // react.context
  didChange: boolean,// false
): void {
  // 当前context和FiberNode入栈valueStack和fiberStack
  push(contextStackCursor, context, fiber); // 将contextStackCursor.current 设置成context
  push(didPerformWorkStackCursor, didChange, fiber);// 将didPerformWorkStackCursor.current 设置成didChange
}
```
```javascript
function push<T>(cursor: StackCursor<T>, value: T, fiber: Fiber): void {
  index++;
  valueStack[index] = cursor.current;
  // 此处重点, cursor.current执行的地址发生了变化, 原来指向的地址被压到valueStack栈中了
  cursor.current = value;
}
```
```javascript
function pushHostContainer(fiber: Fiber, nextRootInstance: Container) {
  //将当前根实例推送到堆栈上；
  //这允许我们在门户被弹出时重置根目录。
  // Push current root instance onto the stack;
  // This allows us to reset root when portals are popped.
  push(rootInstanceStackCursor, nextRootInstance, fiber); // rootInstanceStackCursor.current 设置为nextRootInstance
  //跟踪上下文和提供它的光纤。
  //这使我们能够只弹出提供独特上下文的光纤。
  // Track the context and the Fiber that provided it.
  // This enables us to pop only Fibers that provide unique contexts.
  push(contextFiberStackCursor, fiber, fiber); // contextFiberStackCursor.current 设置为fiber
  //最后，我们需要将主机上下文推送到堆栈中。
  //但是，我们不能只调用getRootHostContext（）并推送它，因为根据getRootHostContext（）是否在呈现程序代码中抛出，堆栈上的条目数量会有所不同。
  //所以我们先推一个空值。这样我们就可以安全地消除错误。
  // Finally, we need to push the host context to the stack.
  // However, we can't just call getRootHostContext() and push it because
  // we'd have a different number of entries on the stack depending on
  // whether getRootHostContext() throws somewhere in renderer code or not.
  // So we push an empty value first. This lets us safely unwind on errors.
  push(contextStackCursor, NO_CONTEXT, fiber);
  const nextRootContext = getRootHostContext(nextRootInstance);
  //既然我们知道这个函数不会抛出，就替换它。
  // Now that we know this function doesn't throw, replace it.
  pop(contextStackCursor, fiber);
  push(contextStackCursor, nextRootContext, fiber);
}
```

### `cloneUpdateQueue`函数
* 将两个`正宫current`和克隆人`workInProgress`的updateQueue分别指向不同的地方（之前是指向同一块内存）,但两者的shared依然指向同一块内存区域
```javascript
function cloneUpdateQueue<State>(
  current: Fiber,
  workInProgress: Fiber,
): void {
  //从当前克隆更新队列。除非它已经是克隆了。
  // Clone the update queue from current. Unless it's already a clone.
  // root的workInProgress.updateQueue是在createWorkInProgress函数的末尾指向了currentQueue的UpdateQueue，所以root的两个Fiber两者的UpdateQueue现在的指向是一样的
  const queue: UpdateQueue<State> = (workInProgress.updateQueue: any);
  // HostRootFiber的currentQueue是在刚开始createFiberRoot函数执行的时候设置的
  // UpdateQueue第一个update是在updateContainer函数执行的时候通过enqueueUpdate函数指向了UpdateQueue.shared.pending
  const currentQueue: UpdateQueue<State> = (current.updateQueue: any);
  if (queue === currentQueue) { // 如果指向相同  则将两个updateQueue分别指向不同的地方
    const clone: UpdateQueue<State> = {
      baseState: currentQueue.baseState,
      firstBaseUpdate: currentQueue.firstBaseUpdate,
      lastBaseUpdate: currentQueue.lastBaseUpdate,
      shared: currentQueue.shared,
      effects: currentQueue.effects,
    };
    workInProgress.updateQueue = clone;
  }
}
```

### processUpdateQueue

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

### `reconcileChildren` 
* [参考文档](./reconcileChildren解析.md)
