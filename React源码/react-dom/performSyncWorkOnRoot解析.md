# performSyncWorkOnRoot 解析
* 同步执行根组件的渲染工作

## 步骤分析
* 刷新被动效果（无效果可供刷新）
* 获取过期时间`expirationTime`：最后得到的是`Sync`（1073741823）
* 同步渲染根组件：`renderRootSync` [参考文档](renderRootSync解析.md)

## 源码
```javascript
function performSyncWorkOnRoot(root) {
  // 刷新被动效果 flushPassiveEffects调用runWithPriority(priorityLevel, flushPassiveEffectsImpl);flushPassiveEffectsImpl又调用flushSyncCallbackQueue
  //如果根目录或过期时间已更改，请丢弃现有堆栈并准备新堆栈。否则我们将继续我们离开的地方。
  // pendingPassiveEffectsRenderPriority === NoPriority 90;的情况下不执行后续代码
  flushPassiveEffects();

  // 上次root的过期时间 这里为 0
  const lastExpiredTime = root.lastExpiredTime;

  let expirationTime;
  if (lastExpiredTime !== NoWork) {
    // 这个根上有过期的工作。检查是否有可重用的部分树 workInProgressRoot 指接下来要更新的节点
    // There's expired work on this root. Check if we have a partial tree
    // that we can reuse.
    
    // workInProgressRoot 这里是null
    if (
      root === workInProgressRoot &&
      renderExpirationTime >= lastExpiredTime
    ) {
      // 有一个部分树的优先级等于或大于过期级别。在渲染剩余的过期作品之前完成渲染
      // There's a partial tree with equal or greater than priority than the
      // expired level. Finish rendering it before rendering the rest of the
      // expired work.
      expirationTime = renderExpirationTime;
    } else {
      // 开始一个新树
      // Start a fresh tree.
      expirationTime = lastExpiredTime;
    }
  } else {
    //这里没有过期的work。这必须是一个新的同步render。
    // There's no expired work. This must be a new, synchronous render.
    expirationTime = Sync;
  }

  // Fiber 树的更新流程分为 render 阶段与 commit 阶段，render 阶段的纯粹意味着可以被拆分，在 Sync 模式下，render 阶段一次性执行完成，而在 Concurrent 模式下，render 阶段可以被拆解，每个时间片内分别运行一部分，直至完成，commit 模式由于带有 DOM 更新，不可能 DOM 变更到一半中断，因此必须一次性执行完成。
  // exitStatus 退出状态， 值为RootIncomplete
  let exitStatus = renderRootSync(root, expirationTime);

  if (root.tag !== LegacyRoot && exitStatus === RootErrored) {
    //如果出现错误，请再次尝试渲染。我们将同步呈现以阻止并发数据突变，并在空闲（或更低）时呈现，以便包含所有挂起的更新。
    // 如果在第二次尝试之后仍然失败，我们将放弃并提交结果树。
    // If something threw an error, try rendering one more time. We'll
    // render synchronously to block concurrent data mutations, and we'll
    // render at Idle (or lower) so that all pending updates are included.
    // If it still fails after the second attempt, we'll give up and commit
    // the resulting tree.
    expirationTime = expirationTime > Idle ? Idle : expirationTime;
    // 第二次尝试renderRoot
    exitStatus = renderRootSync(root, expirationTime);
  }

  // root遇到致命错误
  if (exitStatus === RootFatalErrored) {
    const fatalError = workInProgressRootFatalError;
    // 准备新堆栈，初始化上下文、workInProgress
    prepareFreshStack(root, expirationTime);
    // 标记根悬停在执行该任务的时候。交给Suspend捕捉错误
    markRootSuspendedAtTime(root, expirationTime);
    // 确保根节点被调度执行
    ensureRootIsScheduled(root); // 内部重新执行scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
    throw fatalError;
  }
  //我们现在有一个连续的树。因为这是同步呈现，所以即使有挂起的东西，我们也会提交它。
  // We now have a consistent tree. Because this is a sync render, we
  // will commit it even if something suspended.
  root.finishedWork = (root.current.alternate: any);
  root.finishedExpirationTime = expirationTime;
  // 所谓提交阶段，就是实际执行一些周期函数、Dom 操作的阶段。
  // 提交根节点
  commitRoot(root);
  //在退出之前，请确保为下一个pending的级别安排了回调。
  // Before exiting, make sure there's a callback scheduled for the next
  // pending level.
  ensureRootIsScheduled(root);

  return null;
}
```
