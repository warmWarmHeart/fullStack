# `renderRootSync`函数
* `renderRootSync`函数 执行`workLoopSync`一次后就打断循环，而`workLoopSync`本身内部存在一个`while`循环。
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
    - workInProgressRootLatestProcessedExpirationTime = Sync;
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
  workInProgressRootLatestProcessedExpirationTime = Sync;
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
```javascript
function completeUnitOfWork(unitOfWork: Fiber): Fiber | null {
  //尝试完成当前工作单元，然后移到下一个同级。如果没有更多的兄弟姐妹，请返回到父光纤。
  // Attempt to complete the current unit of work, then move to the next
  // sibling. If there are no more siblings, return to the parent fiber.
  workInProgress = unitOfWork;
  do {
    //此光纤的当前刷新状态是备用状态。理想情况下，不应该依赖于此，但依赖于此意味着我们不需要在进行中的工作上附加字段。
    // The current, flushed, state of this fiber is the alternate. Ideally
    // nothing should rely on this, but relying on it here means that we don't
    // need an additional field on the work in progress.
    const current = workInProgress.alternate;
    const returnFiber = workInProgress.return;

    //检查工作是否完成或是否有东西抛掷。
    // Check if the work completed or if something threw.
    if ((workInProgress.effectTag & Incomplete) === NoEffect) {
      setCurrentDebugFiberInDEV(workInProgress);
      let next;
      if (
        !enableProfilerTimer ||
        (workInProgress.mode & ProfileMode) === NoMode
      ) {
        next = completeWork(current, workInProgress, renderExpirationTime);
      } else {
        startProfilerTimer(workInProgress);

        // completeWork方法中，会根据workInProgress.tag来区分出不同的动作
        next = completeWork(current, workInProgress, renderExpirationTime);
        //假设我们没有出错，更新渲染持续时间。
        // Update render duration assuming we didn't error.
        stopProfilerTimerIfRunningAndRecordDelta(workInProgress, false);
      }
      stopWorkTimer(workInProgress);
      resetCurrentDebugFiberInDEV();
      resetChildExpirationTime(workInProgress);

      if (next !== null) {
        //完成这种纤维产生了新的工作。下一步做这个。
        // Completing this fiber spawned new work. Work on that next.
        return next;
      }

      if (
        returnFiber !== null &&
        //如果兄弟姐妹未能完成，则不要向父项附加效果
        // Do not append effects to parents if a sibling failed to complete
        (returnFiber.effectTag & Incomplete) === NoEffect
      ) {
        //将子树和此光纤的所有效果附加到父级的效果列表中。children的完成顺序影响副作用顺序。
        // Append all the effects of the subtree and this fiber onto the effect
        // list of the parent. The completion order of the children affects the
        // side-effect order.
        if (returnFiber.firstEffect === null) {
          returnFiber.firstEffect = workInProgress.firstEffect;
        }
        if (workInProgress.lastEffect !== null) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = workInProgress.firstEffect;
          }
          returnFiber.lastEffect = workInProgress.lastEffect;
        }

        //如果这种纤维有副作用，我们在children的副作用之后再加上它。
        // 如果需要的话，我们可以通过在效果列表上进行多次传递来提前执行某些副作用。
        // 我们不想将自己的副作用安排在自己的列表中，因为如果最终重用了孩子，我们将把这个效果安排在自己身上，因为我们已经到了最后。
        // If this fiber had side-effects, we append it AFTER the children's
        // side-effects. We can perform certain side-effects earlier if needed,
        // by doing multiple passes over the effect list. We don't want to
        // schedule our own side-effect on our own list because if end up
        // reusing children we'll schedule this effect onto itself since we're
        // at the end.
        const effectTag = workInProgress.effectTag;

        //创建效果列表时跳过NoWork和PerformedWork标记。React DevTools读取PerformedWork效果，但不应提交。
        // Skip both NoWork and PerformedWork tags when creating the effect
        // list. PerformedWork effect is read by React DevTools but shouldn't be
        // committed.
        if (effectTag > PerformedWork) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = workInProgress;
          } else {
            returnFiber.firstEffect = workInProgress;
          }
          returnFiber.lastEffect = workInProgress;
        }
      }
    } else {
      //这根纤维没有完成，因为有东西抛出。在不进入完整阶段的情况下从堆栈中弹出值。如果这是一个边界，则在可能的情况下捕获值。
      // This fiber did not complete because something threw. Pop values off
      // the stack without entering the complete phase. If this is a boundary,
      // capture values if possible.
      const next = unwindWork(workInProgress, renderExpirationTime);

      //由于此光纤未完成，请不要重置其过期时间。
      // Because this fiber did not complete, don't reset its expiration time.

      if (
        enableProfilerTimer &&
        (workInProgress.mode & ProfileMode) !== NoMode
      ) {
        //记录出错光纤的渲染持续时间。
        // Record the render duration for the fiber that errored.
        stopProfilerTimerIfRunningAndRecordDelta(workInProgress, false);
        //包括在继续之前花在处理失败children上的时间。
        // Include the time spent working on failed children before continuing.
        let actualDuration = workInProgress.actualDuration;
        let child = workInProgress.child;
        while (child !== null) {
          actualDuration += child.actualDuration;
          child = child.sibling;
        }
        workInProgress.actualDuration = actualDuration;
      }

      if (next !== null) {
        //如果完成这项工作产生了新的工作，那就做下一步。我们会再回来的。
        //由于要重新启动，请从“效果”标记中删除任何不是主机效果的内容。
        //待办事项：stopFailedWorkTimer这个名字有误导性，因为Suspense也会捕获并重新启动
        // If completing this work spawned new work, do that next. We'll come
        // back here again.
        // Since we're restarting, remove anything that is not a host effect
        // from the effect tag.
        // TODO: The name stopFailedWorkTimer is misleading because Suspense
        // also captures and restarts.
        stopFailedWorkTimer(workInProgress);
        next.effectTag &= HostEffectMask;
        return next;
      }
      stopWorkTimer(workInProgress);

      if (returnFiber !== null) {
        //将父光纤标记为不完整并清除其效果列表。
        // Mark the parent fiber as incomplete and clear its effect list.
        returnFiber.firstEffect = returnFiber.lastEffect = null;
        returnFiber.effectTag |= Incomplete;
      }
    }

    const siblingFiber = workInProgress.sibling;
    if (siblingFiber !== null) {
      //如果在这个回程光纤中还有更多的工作要做，请接着做。
      // If there is more work to do in this returnFiber, do that next.
      return siblingFiber;
    }
    //否则，返回父级
    // Otherwise, return to the parent
    workInProgress = returnFiber;
  } while (workInProgress !== null);

  //我们已经找到了根源。
  // We've reached the root.
  if (workInProgressRootExitStatus === RootIncomplete) {
    workInProgressRootExitStatus = RootCompleted;
  }
  return null;
}
```

### mountClassComponent 绑定类组件
[参考文档](mountClassComponent阶段解析.md)

