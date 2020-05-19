# `MountHostRootComponent`阶段相关代码解析

## updateHostRoot

* `render`第一次执行`beginWork`的时候，`workInProgress.tag` 等于 `HostRoot`, 所以我们先看 `updateHostRoot`源码

```javascript
function updateHostRoot(current, workInProgress, renderExpirationTime) {
  pushHostRootContext(workInProgress); // 设置root相关context的变量指针
  const updateQueue = workInProgress.updateQueue;
  const nextProps = workInProgress.pendingProps; // null
  const prevState = workInProgress.memoizedState;  // null
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
[参考文档](processUpdateQueue详解.md)
* 先将`UpdateQueue.shared.pending`上的`update`链全部转移到`UpdateQueue.firstBaseUpdate`上
* 循环遍历`UpdateQueue`的`firstBaseUpdate`属性，生成一个新的state，然后赋值给当前Fiber对象`workInProgress`的`memoizedState`属性
* 设置`workInProgress`的`expirationTime`属性

### `reconcileChildren` 
* [参考文档](./reconcileChildren解析.md)
