# `performUnitOfWork`函数
* 第一阶段：执行`beginWork`，然后在`beginWork`内部根据当前`workInProgress`的`Fiber`的type以及`workInProgress`对应的ReactElement对象的`type`（就是React组件的构造函数）来创建一个新的`fiber`，指向`workInProgress`的`child`属性
    > 当`performUnitOfWork`函数在父函数`workLoopSync`循环执行多次，生成的子`Fiber`的`tag`为`HostText`的时候，`next`这时候变成了`null`：意思是当前`fiber`对应着一段文字，以及到达Fiber树的底部，再也无法向下执行了
* 第二个阶段：执行`completeUnitOfWork`函数

## 源码
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

## `beginWork`函数

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
      // 函数组件
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderExpirationTime,
      );
    }
    // 类组件
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
