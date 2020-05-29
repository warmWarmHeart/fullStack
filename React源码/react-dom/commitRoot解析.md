# `commitRoot`函数

## 源码
```javascript
function commitRoot(root) {
  // 通过调度中的当前优先级获取到渲染fiber定义的当前优先级
  const renderPriorityLevel = getCurrentPriorityLevel();
  // 然后以优先级ImmediatePriority立马执行commitRootImpl函数
  runWithPriority(
    ImmediatePriority, //99
    commitRootImpl.bind(null, root, renderPriorityLevel),
  );
  return null;
}
```
### runWithPriority
[参考文档](../调度scheduler/runWithPriority解读.md)

### commitRootImpl
```javascript
function commitRootImpl(root, renderPriorityLevel) {
  do {
    //“flushPassiveEffects”在最后会调用“flushSyncUpdateQueue”，
    // 这意味着“flushPassiveEffects”有时会导致额外的被动效果。所以我们需要保持循环刷新，直到没有更多的未决影响。
    // `flushPassiveEffects` will call `flushSyncUpdateQueue` at the end, which
    // means `flushPassiveEffects` will sometimes result in additional
    // passive effects. So we need to keep flushing in a loop until there are
    // no more pending effects.
    //待办事项：如果“flushPassiveEffects”不是自动最后冲洗同步工作，避免这样的危险因素。
    // TODO: Might be better if `flushPassiveEffects` did not automatically
    // flush synchronous work at the end, to avoid factoring hazards like this.
    flushPassiveEffects();
  } while (rootWithPendingPassiveEffects !== null); // 初始化render第一次执行 不会进入循环 因为在该函数末尾才会置为root

  const finishedWork = root.finishedWork;
  const expirationTime = root.finishedExpirationTime;
  if (finishedWork === null) {
    return null;
  }
  root.finishedWork = null;
  root.finishedExpirationTime = NoWork;

  //commitRoot从不返回continuation；它总是同步完成。
  //所以我们现在可以清除这些，以便安排新的回调。
  // commitRoot never returns a continuation; it always finishes synchronously.
  // So we can clear these now to allow a new callback to be scheduled.
  root.callbackNode = null;
  root.callbackExpirationTime = NoWork;
  root.callbackPriority = NoPriority;
  root.nextKnownPendingLevel = NoWork;

  //更新此root上的第一个和最后一个挂起时间。新的第一个等待时间是rootFiber上剩下的时间。
  // Update the first and last pending times on this root. The new first
  // pending time is whatever is left on the root fiber.
  // const updateExpirationTime = fiber.expirationTime;
  //   // const childExpirationTime = fiber.childExpirationTime;
  //   // return updateExpirationTime > childExpirationTime
  //   //   ? updateExpirationTime
  //   //   : childExpirationTime;

  const remainingExpirationTimeBeforeCommit = getRemainingExpirationTime(
    finishedWork,
  );
  // 标记root在expirationTime时间结束
  markRootFinishedAtTime(
    root,
    expirationTime,
    remainingExpirationTimeBeforeCommit, // 剩余到期时间
  );

  // prepareFreshStack的时候设置workInProgressRoot = root
  if (root === workInProgressRoot) {
    //我们现在可以重新设置它们了。
    // We can reset these now that they are finished.
    workInProgressRoot = null;
    workInProgress = null;
    renderExpirationTime = NoWork;
  } else {
    // This indicates that the last root we worked on is not the same one that
    // we're committing now. This most commonly happens when a suspended root
    // times out.
  }
  //获取效果列表。
  // Get the list of effects.
  let firstEffect;
  // container组件APP所对应的finishedWork.effectTag 为nowWork
  if (finishedWork.effectTag > PerformedWork) {
    //fiber的效果列表只包含其子项，而不包含其自身。
    // 因此，如果root有效果，我们需要将它添加到列表的末尾。
    // 结果列表是属于root的父级的集合，如果它有一个；也就是说，树中的所有效果包括根。
    // A fiber's effect list consists only of its children, not itself. So if
    // the root has an effect, we need to add it to the end of the list. The
    // resulting list is the set that would belong to the root's parent, if it
    // had one; that is, all the effects in the tree including the root.
    if (finishedWork.lastEffect !== null) {
      finishedWork.lastEffect.nextEffect = finishedWork;
      firstEffect = finishedWork.firstEffect;
    } else {
      firstEffect = finishedWork;
    }
  } else {
    // 在循环执行completeUnitOfWork时候将子组件所代表的fiber上的firstEffect逐渐递传给rootFiber的firstEffect 
    firstEffect = finishedWork.firstEffect; 
  }

  if (firstEffect !== null) {
    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;
    // 可以忽略  开发环境使用 暂不解读
    // 将root.memoizedInteractions保存到__interactionsRef.current上，且返回未保存前的__interactionsRef.current
    const prevInteractions = pushInteractions(root);
    // 可以忽略  开发环境使用 暂不解读
    //在调用生命周期之前将其重置为空
    // Reset this to null before calling lifecycles
    ReactCurrentOwner.current = null;

    //提交阶段分为几个子阶段。我们对每个阶段的效果列表进行单独的传递：所有的变异效果都先于所有的布局效果，以此类推。
    //第一阶段a“突变前”阶段。我们使用这个阶段来读取宿主树的状态，然后再对其进行变异。这是调用getSnapshotBeforeUpdate的地方。
    // The commit phase is broken into several sub-phases. We do a separate pass
    // of the effect list for each phase: all mutation effects come before all
    // layout effects, and so on.

    // The first phase a "before mutation" phase. We use this phase to read the
    // state of the host tree right before we mutate it. This is where
    // getSnapshotBeforeUpdate is called.
    // 当前提交的效果数量记为0

    prepareForCommit(root.containerInfo);
    nextEffect = firstEffect;
    do {
      try {
        // 在突变效果之前提交
        // getSnapshotBeforeUpdate 声明钩子
        // 它的含义是在React更新Dom元素之前，获取一个快照，它返回的结果将作为componentDidUpdate的第三个参数。一般的用法就是获取更新前的DOM。
        commitBeforeMutationEffects();
      } catch (error) {
        invariant(nextEffect !== null, 'Should be working on an effect.');
        captureCommitPhaseError(nextEffect, error);
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);
    nextEffect = firstEffect;
    do {
      try {
        //提交HostComponent的 side effect，也就是 DOM 节点的操作(增删改)
        commitMutationEffects(root, renderPriorityLevel);
      } catch (error) {
        invariant(nextEffect !== null, 'Should be working on an effect.');
        captureCommitPhaseError(nextEffect, error);
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);
    resetAfterCommit(root.containerInfo);

    // 这意味着，在 DomElement 副作用处理完毕之后，意味着之前讲的缓冲树已经完成任务，翻身当主人，成为下次修改过程的current。
    // The work-in-progress tree is now the current tree. This must come after
    // the mutation phase, so that the previous tree is still current during
    // componentWillUnmount, but before the layout phase, so that the finished
    // work is current during componentDidMount/Update.
    root.current = finishedWork;

    // 可以忽略  开发环境使用 暂不解读
    // The next phase is the layout phase, where we call effects that read
    // the host tree after it's been mutated. The idiomatic use case for this is
    // layout, but class component lifecycles also fire here for legacy reasons.
    startCommitLifeCyclesTimer();
    nextEffect = firstEffect;
    do {
      try {
        commitLayoutEffects(root, expirationTime);
      } catch (error) {
        invariant(nextEffect !== null, 'Should be working on an effect.');
        captureCommitPhaseError(nextEffect, error);
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    nextEffect = null;

    // 请求绘制
    //告诉调度器在帧的末尾屈服，这样浏览器就有机会绘制。
    // Tell Scheduler to yield at the end of the frame, so the browser has an
    // opportunity to paint.
    requestPaint();

    executionContext = prevExecutionContext;
  } else {
    //　这意味着，在 DomElement 副作用处理完毕之后，意味着之前讲的缓冲树已经完成任务，翻身当主人，成为下次修改过程的current。
    // No effects.
    root.current = finishedWork;
  }
  const rootDidHavePassiveEffects = rootDoesHavePassiveEffects;

  if (rootDoesHavePassiveEffects) {
    //此提交具有被动效果。把他们的资料藏起来。但在刷新布局工作之后才安排回调
    // This commit has passive effects. Stash a reference to them. But don't
    // schedule a callback until after flushing layout work.
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
    pendingPassiveEffectsExpirationTime = expirationTime;
    pendingPassiveEffectsRenderPriority = renderPriorityLevel;
  } else {
    //现在我们已经完成了效果链，所以让我们清除nextefect指针来帮助GC。如果我们有消极影响，我们会在flushPassiveEffects中清除此项。
    // We are done with the effect chain at this point so let's clear the
    // nextEffect pointers to assist with GC. If we have passive effects, we'll
    // clear this in flushPassiveEffects.
    nextEffect = firstEffect;
    while (nextEffect !== null) {
      const nextNextEffect = nextEffect.nextEffect;
      nextEffect.nextEffect = null;
      nextEffect = nextNextEffect;
    }
  }
  //检查这个根上是否还有剩余的工作
  // Check if there's remaining work on this root
  const remainingExpirationTime = root.firstPendingTime;
  if (remainingExpirationTime !== NoWork) {
  } else {
    // If there's no remaining work, we can clear the set of already failed
    // error boundaries.
    legacyErrorBoundariesThatAlreadyFailed = null;
  }

  if (remainingExpirationTime === Sync) {
    //计算根在未完成的情况下同步重新呈现的次数。如果太多，则表示无限更新循环。
    // Count the number of times the root synchronously re-renders without
    // finishing. If there are too many, it indicates an infinite update loop.
    // nested 叠加嵌套的意思
    if (root === rootWithNestedUpdates) {
      nestedUpdateCount++;
    } else {
      nestedUpdateCount = 0;
      rootWithNestedUpdates = root;
    }
  } else {
    nestedUpdateCount = 0;
  }

  // injectInternals会将onCommitRoot设置为一个函数 可以忽略此函数
  onCommitRoot(finishedWork.stateNode, expirationTime);

  //在退出“commitRoot”之前，请始终调用此命令，以确保已计划对此根目录执行任何其他工作。
  // Always call this before exiting `commitRoot`, to ensure that any
  // additional work on this root is scheduled.
  ensureRootIsScheduled(root);

  if (hasUncaughtError) {
    hasUncaughtError = false;
    const error = firstUncaughtError;
    firstUncaughtError = null;
    throw error;
  }

  if ((executionContext & LegacyUnbatchedContext) !== NoContext) {
    //这是一个遗留的边缘案例。我们刚刚承诺batchedUpdates内部的ReactDOM.render-ed根。已触发的提交同步，但布局更新应推迟到批处理结束。
    // This is a legacy edge case. We just committed the initial mount of
    // a ReactDOM.render-ed root inside of batchedUpdates. The commit fired
    // synchronously, but layout updates should be deferred until the end
    // of the batch.
    return null;
  }

  //如果已安排布局工作，请立即刷新。
  // If layout work was scheduled, flush it now.
  flushSyncCallbackQueue();
  return null;
}
```

#### prepareForCommit
```javascript
function prepareForCommit(containerInfo: Container): void {
  eventsEnabled = ReactBrowserEventEmitterIsEnabled(); // true
  selectionInformation = getSelectionInformation();
  ReactBrowserEventEmitterSetEnabled(false); // 将变量_enabled 设置为false
}
```

#### getSelectionInformation
* 最终得到一个如下对象：
    ```javascript
      {
          activeElementDetached: null,
          focusedElem: body, // html body元素
          selectionRange: null,
      }   
    ```
* 源码
```javascript
function getSelectionInformation() {
  const focusedElem = getActiveElementDeep();
  return {
    // Used by Flare
    activeElementDetached: null,
    focusedElem: focusedElem,
    selectionRange: hasSelectionCapabilities(focusedElem)
      ? getSelection(focusedElem)
      : null,
  };
}
```

#### commitBeforeMutationEffects
```javascript
// 在突变效果之前提交
function commitBeforeMutationEffects() {
  while (nextEffect !== null) {
    const effectTag = nextEffect.effectTag;
    // 当nextEffect上有Snapshot这个effectTag时，执行commitBeforeMutationEffectOnFiber()，让不同类型的组件执行不同的操作，来提交（commit）相关effect
    if ((effectTag & Snapshot) !== NoEffect) {
      setCurrentDebugFiberInDEV(nextEffect);
      // 记录effect     effectCountInCurrentCommit++;
      recordEffect();

      const current = nextEffect.alternate;
      // getSnapshotBeforeUpdate声明周期函数在此函数中执行
      commitBeforeMutationEffectOnFiber(current, nextEffect);

      resetCurrentDebugFiberInDEV();
    }
    if ((effectTag & Passive) !== NoEffect) {
      //如果存在被动效果，请安排回调以尽早刷新。
      // If there are passive effects, schedule a callback to flush at
      // the earliest opportunity.
      // 执行到这里的时候 rootDoesHavePassiveEffects 为false 所以可以进入if语句
      if (!rootDoesHavePassiveEffects) {
        rootDoesHavePassiveEffects = true;
        scheduleCallback(NormalPriority, () => {
          flushPassiveEffects();
          return null;
        });
      }
    }
    nextEffect = nextEffect.nextEffect;
  }
}
```


#### flushPassiveEffects 
[参考文档](flushPassiveEffects解读.md)

