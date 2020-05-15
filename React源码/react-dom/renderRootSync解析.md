# `renderRootSync`函数
> 
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
> 循环终止条件 `workInProgress` 等于 `null`
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

```javascript
// 执行工作单元
function performUnitOfWork(unitOfWork: Fiber): Fiber | null {
  //此光纤的当前刷新状态是备用状态。理想情况下，不应该依赖于此，但依赖于此意味着我们不需要在进行中的工作上附加字段。
  // The current, flushed, state of this fiber is the alternate. Ideally
  // nothing should rely on this, but relying on it here means that we don't
  // need an additional field on the work in progress.
  // 这个做法的核心思想是双缓池技术(double buffering pooling technique)，因为需要做 diff 的话，起码是要有两棵树进行对比。通过这种方式，可以把树的总体数量限制在2，节点、节点属性都是延迟创建的，最大限度地避免内存使用量因算法过程而不断增长
  const current = unitOfWork.alternate;

  let next;
  // 使用current和unitOfWork进行对比，更新某些操作属性等
  next = beginWork(current, unitOfWork, renderExpirationTime);

  // 设置每一个fiber的props
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    // 当next = null 的时候证明 当前元素已经没有child了，所以需要回溯找他returnFiber的兄弟节点，然后继续进行beginWork。。。。知道找到rootFiber
    //如果这没有产生新的工作，请完成当前的工作。
    // 进入这个流程，表明 workInProgress 节点是一个叶子节点，或者它的子节点都已经处理完成了。现在开始要完成这个节点处理的剩余工作。
    // If this doesn't spawn new work, complete the current work.
    next = completeUnitOfWork(unitOfWork);
  }

  ReactCurrentOwner.current = null;
  // return之后会一直递归执行workLoopSync函数也是执行performUnitOfWork函数，直到next = null
  return next;
}
```
* 执行`beginWork`函数
    > 
* 将 workInProgress 也就是参数 `unitOfWork`的 `memoizedProps` 设置为它`pendingProps`属性的值（该值会在`beginWork`执行中设置）
* 当 由 `beginWork`函数返回的 `next`为空的时候，开始执行`completeUnitOfWork`函数

#### `beginWork`函数
* `beginWork`函数的三个参数
    - current：正主地位的`Fiber`
    - workInProgress: 正主Fiber的克隆对象`workInProgress`Fiber
    - renderExpirationTime: 在`prepareFreshStack`函数中设置的渲染过期时间
* `beginWork` 执行步骤：
    - 判断 `current`是否为`null`，为null证明已经没有更新，将变量`didReceiveUpdate`设置为false。不为null 证明还存在相关组件未完成绑定
        > 变量`didReceiveUpdate`会在之后的`mountComponent`阶段进行一些逻辑的判断
        > `current`什么时候为 `null`呢？ 就是当前执行绑定的组件不存在子元素的时候为 `null`
    - 根据`workInProgress`的`tag`属性进行绑定其所代表的组件，后面详细讲解该步骤：**mountComponent**
        > `tag`相关解释可以[查看文档](../Fiber/Fiber的tag属性.md)
```javascript
function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderExpirationTime: ExpirationTime,
): Fiber | null {
  // const current = workInProgress.alternate; 是workInProgress的备份
  const updateExpirationTime = workInProgress.expirationTime;
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    // 初始化render的时候 这里是相等的 所以不会走
    if (
      oldProps !== newProps || // 如果旧props和新props不相同 将didReceiveUpdate设置为true
      hasLegacyContextChanged() ||
      // Force a re-render if the implementation changed due to hot reload:
      (__DEV__ ? workInProgress.type !== current.type : false)
    ) {
      //如果props或上下文发生更改，请将光纤标记为已执行工作。
      //如果稍后确定props相等，则可能会取消设置（备注）。
      // If props or context changed, mark the fiber as having performed work.
      // This may be unset if the props are determined to be equal later (memo).
      didReceiveUpdate = true;
    } else if (updateExpirationTime < renderExpirationTime) {
      // 初始化render的时候prepareFreshStack会将两个值设置成一样的 所以不会走这里的逻辑
      didReceiveUpdate = false;
      // 此光纤没有任何挂起的工作。不进入开始阶段的救助。还有一些簿记我们需要在这个优化的路径，主要是推到堆栈上的东西。
      // This fiber does not have any pending work. Bailout without entering
      // the begin phase. There's still some bookkeeping we that needs to be done
      // in this optimized path, mostly pushing stuff onto the stack.
      switch (workInProgress.tag) {
        case HostRoot:
          pushHostRootContext(workInProgress);
          // 重置水合状态
          resetHydrationState();
          break;
        case HostComponent:
          pushHostContext(workInProgress);
          if (
            workInProgress.mode & ConcurrentMode &&
            renderExpirationTime !== Never &&
            shouldDeprioritizeSubtree(workInProgress.type, newProps) // 应该删除子树 // 暂时返回false
          ) {
            if (enableSchedulerTracing) {
              markSpawnedWork(Never);
            }
            //安排此光纤以屏幕外优先级重新渲染。然后bailout。
            // Schedule this fiber to re-render at offscreen priority. Then bailout.
            workInProgress.expirationTime = workInProgress.childExpirationTime = Never;
            return null;
          }
          break;
        case ClassComponent: {
          const Component = workInProgress.type;
          if (isLegacyContextProvider(Component)) {
            pushLegacyContextProvider(workInProgress);
          }
          break;
        }
        case HostPortal:
          pushHostContainer(
            workInProgress,
            workInProgress.stateNode.containerInfo,
          );
          break;
        case ContextProvider: {
          // 通过createContext创建出来的Provider  value属性是context的值
          const newValue = workInProgress.memoizedProps.value;
          pushProvider(workInProgress, newValue);
          break;
        }
        //Profiler 测量渲染一个 React 应用多久渲染一次以及渲染一次的“代价”。 它的目的是识别出应用中渲染较慢的部分，或是可以使用类似 memoization 优化的部分，并从相关优化中获益。
        case Profiler:
          if (enableProfilerTimer) {
            //探查器应仅在其子体之一实际呈现时调用onRender。
            // Profiler should only call onRender when one of its descendants actually rendered.
            const hasChildWork =
              workInProgress.childExpirationTime >= renderExpirationTime;
            if (hasChildWork) {
              workInProgress.effectTag |= Update;
            }

            // Reset effect durations for the next eventual effect phase.
            // These are reset during render to allow the DevTools commit hook a chance to read them,
            const stateNode = workInProgress.stateNode;
            stateNode.effectDuration = 0;
            stateNode.passiveEffectDuration = 0;
          }
          break;
        case SuspenseComponent: {
          const state: SuspenseState | null = workInProgress.memoizedState;
          if (state !== null) {
            if (enableSuspenseServerRenderer) {
              if (state.dehydrated !== null) {
                pushSuspenseContext(
                  workInProgress,
                  setDefaultShallowSuspenseContext(suspenseStackCursor.current),
                );
                // We know that this component will suspend again because if it has
                // been unsuspended it has committed as a resolved Suspense component.
                // If it needs to be retried, it should have work scheduled on it.
                workInProgress.effectTag |= DidCapture;
                break;
              }
            }

            //如果此边界当前已超时，则需要决定是重试主要子级，还是跳过它直接转到回退。检查主子片段的优先级。
            // If this boundary is currently timed out, we need to decide
            // whether to retry the primary children, or to skip over it and
            // go straight to the fallback. Check the priority of the primary
            // child fragment.
            const primaryChildFragment: Fiber = (workInProgress.child: any);
            const primaryChildExpirationTime =
              primaryChildFragment.childExpirationTime;
            if (
              primaryChildExpirationTime !== NoWork &&
              primaryChildExpirationTime >= renderExpirationTime
            ) {
              //primary children有待业。使用普通路径再次尝试呈现primary children。
              // The primary children have pending work. Use the normal path
              // to attempt to render the primary children again.
              return updateSuspenseComponent(
                current,
                workInProgress,
                renderExpirationTime,
              );
            } else {
              pushSuspenseContext(
                workInProgress,
                setDefaultShallowSuspenseContext(suspenseStackCursor.current),
              );
              //主要子女没有具有足够优先权的待处理工作。救市。
              // The primary children do not have pending work with sufficient
              // priority. Bailout.
              const child = bailoutOnAlreadyFinishedWork(
                current,
                workInProgress,
                renderExpirationTime,
              );
              if (child !== null) {
                // The fallback children have pending work. Skip over the
                // primary children and work on the fallback.
                return child.sibling;
              } else {
                return null;
              }
            }
          } else {
            pushSuspenseContext(
              workInProgress,
              setDefaultShallowSuspenseContext(suspenseStackCursor.current),
            );
          }
          break;
        }
        case SuspenseListComponent: {
          const didSuspendBefore =
            (current.effectTag & DidCapture) !== NoEffect;

          const hasChildWork =
            workInProgress.childExpirationTime >= renderExpirationTime;

          if (didSuspendBefore) {
            if (hasChildWork) {
              // If something was in fallback state last time, and we have all the
              // same children then we're still in progressive loading state.
              // Something might get unblocked by state updates or retries in the
              // tree which will affect the tail. So we need to use the normal
              // path to compute the correct tail.
              return updateSuspenseListComponent(
                current,
                workInProgress,
                renderExpirationTime,
              );
            }
            // If none of the children had any work, that means that none of
            // them got retried so they'll still be blocked in the same way
            // as before. We can fast bail out.
            workInProgress.effectTag |= DidCapture;
          }

          // If nothing suspended before and we're rendering the same children,
          // then the tail doesn't matter. Anything new that suspends will work
          // in the "together" mode, so we can continue from the state we had.
          let renderState = workInProgress.memoizedState;
          if (renderState !== null) {
            // Reset to the "together" mode in case we've started a different
            // update in the past but didn't complete it.
            renderState.rendering = null;
            renderState.tail = null;
          }
          pushSuspenseContext(workInProgress, suspenseStackCursor.current);

          if (hasChildWork) {
            break;
          } else {
            // If none of the children had any work, that means that none of
            // them got retried so they'll still be blocked in the same way
            // as before. We can fast bail out.
            return null;
          }
        }
      }
      // 进入bailoutOnAlreadyFinishedWork，那么有极高的可能这个节点以及他的子树都不需要更新，React会直接跳过，我们使用新的context API的时候就是这种情况，但是使用老的context API是永远不可能跳过这个判断的
      // 老的context API使用过程中，一旦有一个节点提供了context，那么他的所有子节点都会被视为有side effect的，因为React本身并不判断子节点是否有使用context，以及提供的context是否有变化，所以一旦检测到有节点提供了context，那么他的子节点在执行hasLegacyContextChanged的时候，永远都是true的，而没有进入bailoutOnAlreadyFinishedWork，就会变成重新reconcile子节点，虽然最终可能不需要更新DOM节点，但是重新计算生成Fiber对象的开销还是又得，一两个还好，数量多了时间也是会被拉长的。
      return bailoutOnAlreadyFinishedWork(
        current,
        workInProgress,
        renderExpirationTime,
      );
    } else {
      //已计划对此光纤进行更新，但没有新的道具或旧上下文。将此设置为false。
      // 如果更新队列或上下文使用者生成一个已更改的值，则将其设置为true。否则，该组件将假定孩子们没有改变并脱离困境。
      // An update was scheduled on this fiber, but there are no new props
      // nor legacy context. Set this to false. If an update queue or context
      // consumer produces a changed value, it will set this to true. Otherwise,
      // the component will assume the children have not changed and bail out.
      didReceiveUpdate = false;
    }
  } else {
    didReceiveUpdate = false;
  }
  // 初始化render的时候上面逻辑走完后didReceiveUpdate = false;
  //在进入“begin”阶段之前，请清除“挂起的更新优先级”。
  //TODO:这假设我们将评估组件并处理更新队列。但是，有一个例外：SimpleMemoComponent有时会在开始阶段的稍后阶段退出。这表示我们应该将这个赋值从公共路径移到每个分支中。

  // Before entering the begin phase, clear pending update priority.
  // TODO: This assumes that we're about to evaluate the component and process
  // the update queue. However, there's an exception: SimpleMemoComponent
  // sometimes bails out later in the begin phase. This indicates that we should
  // move this assignment out of the common path and into each branch.
  workInProgress.expirationTime = NoWork;

  // mount阶段
  switch (workInProgress.tag) {
    // 在我们知道他是函数组件还是类组件之前
    case IndeterminateComponent: {
      // 调用当前fiber中的hooks钩子（mount的钩子和update的钩子处理方式不相同）
      return mountIndeterminateComponent(
        current,
        workInProgress,
        workInProgress.type,
        renderExpirationTime,
      );
    }
    case LazyComponent: {
      const elementType = workInProgress.elementType;
      return mountLazyComponent(
        current,
        workInProgress,
        elementType,
        updateExpirationTime,
        renderExpirationTime,
      );
    }
    case FunctionComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderExpirationTime,
      );
    }
    case ClassComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateClassComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderExpirationTime,
      );
    }
    case HostRoot:
      // 第一次render 第一次走这里的逻辑
      return updateHostRoot(current, workInProgress, renderExpirationTime);
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderExpirationTime);
    case HostText:
      return updateHostText(current, workInProgress);
    case SuspenseComponent:
      return updateSuspenseComponent(
        current,
        workInProgress,
        renderExpirationTime,
      );
    case HostPortal:
      return updatePortalComponent(
        current,
        workInProgress,
        renderExpirationTime,
      );
    case ForwardRef: {
      const type = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === type
          ? unresolvedProps
          : resolveDefaultProps(type, unresolvedProps);
      return updateForwardRef(
        current,
        workInProgress,
        type,
        resolvedProps,
        renderExpirationTime,
      );
    }
    case Fragment:
      return updateFragment(current, workInProgress, renderExpirationTime);
    case Mode:
      return updateMode(current, workInProgress, renderExpirationTime);
    case Profiler:
      return updateProfiler(current, workInProgress, renderExpirationTime);
    case ContextProvider:
      return updateContextProvider(
        current,
        workInProgress,
        renderExpirationTime,
      );
    case ContextConsumer:
      return updateContextConsumer(
        current,
        workInProgress,
        renderExpirationTime,
      );
    case MemoComponent: {
      const type = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      // Resolve outer props first, then resolve inner props.
      let resolvedProps = resolveDefaultProps(type, unresolvedProps);
      resolvedProps = resolveDefaultProps(type.type, resolvedProps);
      return updateMemoComponent(
        current,
        workInProgress,
        type,
        resolvedProps,
        updateExpirationTime,
        renderExpirationTime,
      );
    }
    case SimpleMemoComponent: {
      return updateSimpleMemoComponent(
        current,
        workInProgress,
        workInProgress.type,
        workInProgress.pendingProps,
        updateExpirationTime,
        renderExpirationTime,
      );
    }
    case IncompleteClassComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return mountIncompleteClassComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderExpirationTime,
      );
    }
    case SuspenseListComponent: {
      return updateSuspenseListComponent(
        current,
        workInProgress,
        renderExpirationTime,
      );
    }
    case FundamentalComponent: {
      if (enableFundamentalAPI) {
        return updateFundamentalComponent(
          current,
          workInProgress,
          renderExpirationTime,
        );
      }
      break;
    }
    case ScopeComponent: {
      if (enableScopeAPI) {
        return updateScopeComponent(
          current,
          workInProgress,
          renderExpirationTime,
        );
      }
      break;
    }
    case Block: {
      if (enableBlocksAPI) {
        const block = workInProgress.type;
        const props = workInProgress.pendingProps;
        return updateBlock(
          current,
          workInProgress,
          block,
          props,
          renderExpirationTime,
        );
      }
      break;
    }
  }
}

```
##### mountComponent 绑定组件

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

* `pushHostRootContext`
    - 将`contextStackCursor.current` 设置成 `FiberRoot.context`
    - 将`didPerformWorkStackCursor.current` 设置成 `false`
    - 将`rootInstanceStackCursor.current` 设置成 `root.containerInfo`
    - 将`contextFiberStackCursor.current` 设置成 `HostRootFiber`
    - 下面是相关设置以上指标所涉及的源码：
    
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
    
* `cloneUpdateQueue`函数 将两个`正宫current`和克隆人`workInProgress`的updateQueue分别指向不同的地方（之前是指向同一块内存）
    > 但两者的shared依然指向同一块内存区域
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
* `processUpdateQueue`函数

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

* `getStateFromUpdate`函数 含义是从`UpdateQueue`的每一个`update`对象中获取`state`(存储于`payload`属性), 此处返回的是{element: <App />}
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

* `markUnprocessedUpdateTime`函数是根据`expirationTime`大小来设置变量`workInProgressRootNextUnprocessedUpdateTime`
```javascript
export function markUnprocessedUpdateTime(
  expirationTime: ExpirationTime,
): void {
  if (expirationTime > workInProgressRootNextUnprocessedUpdateTime) {
    workInProgressRootNextUnprocessedUpdateTime = expirationTime;
  }
}
```

* `reconcileChildren`函数 [参见文档](./reconcileChildren解析.md)
