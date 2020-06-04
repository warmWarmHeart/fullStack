# `renderRootSync`函数
* `renderRootSync`函数 执行`workLoopSync`一次后就打断循环，而`workLoopSync`本身内部存在一个`while`循环。

## 源码
```javascript
function renderRootSync(root, expirationTime) {
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext; // 设置executionContext为RenderContext标记

  //如果根目录或过期时间已更改，请丢弃现有堆栈并准备新堆栈。否则我们将继续我们离开的地方。
  // If the root or expiration time have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  if (root !== workInProgressRoot || expirationTime !== renderExpirationTime) {
    // 准备新堆栈 第一次render会进入这里进行设置workInProgressRoot、renderExpirationTime、为root生成workInProgress和rootFiber的alternate属性
    prepareFreshStack(root, expirationTime);
  }

  do {
    try {
      //  Fiber 树的更新流程分为 render 阶段与 commit 阶段，
      //  render 阶段的纯粹意味着可以被拆分，在 Sync 模式下，render 阶段一次性执行完成，
      //  而在 Concurrent 模式下，render 阶段可以被拆解，每个时间片内分别运行一部分，直至完成，
      //  commit 模式由于带有 DOM 更新，不可能 DOM 变更到一半中断，因此必须一次性执行完成。

      // 将所有的child全部挂载上fiber对象
      // 会创建每个元素的fiber，并且执行每个fiber上实例上的各个生命周期钩子：
      // getDerivedStateFromProps&&getSnapshotBeforeUpdate UNSAFE_componentWillMount componentWillMount 
      workLoopSync(); // 内部执行performUnitOfWork函数，performUnitOfWork函数内部执行beginWork函数
      break;
    } catch (thrownValue) {
      handleError(root, thrownValue);
    }
  } while (true);
  resetContextDependencies();

  executionContext = prevExecutionContext;

  //将此设置为空表示没有正在进行的呈现。
  // Set this to null to indicate there's no in-progress render.
  workInProgressRoot = null;

  return workInProgressRootExitStatus;
}
```

## `prepareFreshStack` 准备新的堆栈
* 初始化 `root.finishedWork`、`root.finishedExpirationTime`
* 设置 变量 `workInProgressRoot` 为传入的参数 `root`
* 通过 `createWorkInProgress`创建一个`workInProgress`，该`workInProgress`代表正在执行状态的`Fiber`对象，
* 设置`renderExpirationTime`为传入的参数`expirationTime`
    >  这里参数`expirationTime`也就是`root.lastExpiredTime`，是在`performSyncWorkOnRoot`执行的上一个函数`performConcurrentWorkOnRoot`执行的时候设置的，所以这里是有值的
* 初始化其`workInProgress`的其他状态
    - workInProgressRootExitStatus = RootIncomplete;
    - workInProgressRootFatalError = null;
    - workInProgressRootLatestProcessedExpirationTime = Sync; // 正在处理根最新处理的过期时间
    - workInProgressRootLatestSuspenseTimeout = Sync;
    - workInProgressRootCanSuspendUsingConfig = null;
    - workInProgressRootNextUnprocessedUpdateTime = NoWork;
    - workInProgressRootHasPendingPing = false;
```javascript
function prepareFreshStack(root, expirationTime) {
  root.finishedWork = null;
  root.finishedExpirationTime = NoWork;

  const timeoutHandle = root.timeoutHandle; // 会在finishConcurrentRender函数调用中设置
  if (timeoutHandle !== noTimeout) {
    // root以前挂起并计划了提交回退状态的超时。现在我们有了额外的工作，取消超时。
    // The root previous suspended and scheduled a timeout to commit a fallback
    // state. Now that we have additional work, cancel the timeout.
    root.timeoutHandle = noTimeout;
    //$FlowFixMe抱怨noTimeout不是超时id，尽管上面有检查
    // $FlowFixMe Complains noTimeout is not a TimeoutID, despite the check above
    cancelTimeout(timeoutHandle);
  }

  if (workInProgress !== null) {
    // 中断的work及所有work的父Fiber 第一次执行prepareFreshStack 这里不会执行
    let interruptedWork = workInProgress.return;
    while (interruptedWork !== null) {
      // 解除中断的work，根据workFiber的tag类型重置workFiber的上下文
      unwindInterruptedWork(interruptedWork);
      interruptedWork = interruptedWork.return;
    }
  }
  workInProgressRoot = root;
  // 创建一个workInProgress（相当于current.alternate复制出来的，如果没有则从current复制一个出来）
  workInProgress = createWorkInProgress(root.current, null);
  // 将渲染过期时间设置为当前任务的过期时间
  renderExpirationTime = expirationTime;
  // 将root状态设置为不完整状态
  workInProgressRootExitStatus = RootIncomplete;
  // 初始化root的一系列状态
  workInProgressRootFatalError = null;
  workInProgressRootLatestProcessedExpirationTime = Sync; // 正在处理根最新处理的过期时间
  workInProgressRootLatestSuspenseTimeout = Sync;
  workInProgressRootCanSuspendUsingConfig = null;
  workInProgressRootNextUnprocessedUpdateTime = NoWork;
  workInProgressRootHasPendingPing = false;
}
```

### `createWorkInProgress`函数
这是用来创造一个替代`fiber`的备用处于工作状态的`Fiber`,起别名为`workInProgress`,`workInProgress`本质就是一个`Fiber`对象
```javascript
// This is used to create an alternate fiber to do work on.
export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  let workInProgress = current.alternate;
  if (workInProgress === null) {
    //我们使用双缓冲池技术，因为我们知道一棵树最多只需要两个版本。
    // 我们将可以自由重用的“其他”未使用节点放在一起。创建它是为了避免为从未更新的对象分配额外的对象。它还允许我们在需要时回收额外的内存。
    // We use a double buffering pooling technique because we know that we'll
    // only ever need at most two versions of a tree. We pool the "other" unused
    // node that we're free to reuse. This is lazily created to avoid allocating
    // extra objects for things that are never updated. It also allow us to
    // reclaim the extra memory if needed.
    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode,
    );
    workInProgress.elementType = current.elementType; // 一般是一个Symbol类型的唯一值 或者是一个二进制数,或者字符串（普通标签）
    workInProgress.type = current.type; // function或者class类，createElement调用的时候第一个参数
    workInProgress.stateNode = current.stateNode;
    workInProgress.alternate = current; // 备份互指
    current.alternate = workInProgress; // 备份互指
  } else {
    workInProgress.pendingProps = pendingProps;
    //我们已经有一个候补者了。
    //重置效果标签。
    // We already have an alternate.
    // Reset the effect tag.
    workInProgress.effectTag = NoEffect;
    //效果列表不再有效。
    // The effect list is no longer valid.
    workInProgress.nextEffect = null;
    workInProgress.firstEffect = null;
    workInProgress.lastEffect = null;
  }

  workInProgress.childExpirationTime = current.childExpirationTime;
  workInProgress.expirationTime = current.expirationTime;

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  // Clone the dependencies object. This is mutated during the render phase, so
  // it cannot be shared with the current fiber.
  //克隆依赖项对象。这在渲染阶段发生了变化，因此无法与当前fiber共享。
  const currentDependencies = current.dependencies;
  workInProgress.dependencies =
    currentDependencies === null
      ? null
      : {
          expirationTime: currentDependencies.expirationTime,
          firstContext: currentDependencies.firstContext,
          responders: currentDependencies.responders,
        };
  //这些将在父级reconciliation（协调、调节）期间被覆盖
  // These will be overridden during the parent's reconciliation
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;
  
  return workInProgress;
}
```

## 循环执行`workLoopSync`函数
> 循环终止条件 `workInProgress` 等于 `null`：`workInProgress.tag === HostText`

* `performUnitOfWork`会先从当前`workInProgress`对应的`ReactElement`
```javascript
function workLoopSync() {
  //已经超时，所以执行工作时不检查是否需要让步。
  // Already timed out, so perform work without checking if we need to yield.
  while (workInProgress !== null) {
    workInProgress = performUnitOfWork(workInProgress); // 执行工作单元
  }
}
```
### `performUnitOfWork`函数
* [参考文档](performUnitOfWork函数.md)
* 第一阶段：执行`beginWork`，然后在`beginWork`内部根据当前`workInProgress`的`Fiber`的type以及`workInProgress`对应的ReactElement对象的`type`（就是React组件的构造函数）来创建一个新的`fiber`，指向`workInProgress`的`child`属性
    > 当`performUnitOfWork`函数在父函数`workLoopSync`循环执行多次，生成的子`Fiber`的`tag`为`HostText`的时候，`next`这时候变成了`null`：意思是当前`fiber`对应着一段文字，以及到达Fiber树的底部，再也无法向下执行了
* 第二个阶段：执行`completeUnitOfWork`函数



### mountHostRootComponent 绑定根组件

[参考文档](mountHostRootComponent阶段解析.md)

#### `completeUnitOfWork`函数
[参考文档](completeUnitOfWork解析.md)

### mountClassComponent 绑定类组件
[参考文档](mountClassComponent阶段解析.md)

