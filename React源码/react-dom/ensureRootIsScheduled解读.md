# ensureRootIsScheduled解读.md
> `ensureRootIsScheduled`函数 这里是真正的[调度](../调度scheduler/readme.md)入口，内部包含了对`App`React组件下所有`chillren`相关Fiber的创建绑定，及各种Hooks相关`effect`的创建绑定以及`update`的创建绑定，也有对子组件下面render函数真实dom的创建绑定，还有各种生命周期的执行，最后渲染整个真实dom的过程

## `ensureRootIsScheduled`源码
* 判断`root.lastExpiredTime`是否有值，第一次进入`ensureRootIsScheduled`是没有值得，下次进入就有值啦。
    - 如果有无值 调用`scheduleCallback(NormalPriority, performConcurrentWorkOnRoot)`
    - 如果有值 scheduleSyncCallback( performSyncWorkOnRoot.bind(null, root));
        >最终执行`Scheduler_scheduleCallback( Scheduler_ImmediatePriority, flushSyncCallbackQueueImpl)`

```javascript
function ensureRootIsScheduled(root: FiberRoot) {
  // 最后过期时间 第一次HostRootFiber执行到此处root.lastExpiredTime = null
  // 第二次执行 performConcurrentWorkOnRoot 的过程中会又一次调用ensureRootIsScheduled，这时候root.lastExpiredTime是有值的
  const lastExpiredTime = root.lastExpiredTime;
  // root.lastExpiredTime 会在走过一次ensureRootIsScheduled后设置
  if (lastExpiredTime !== NoWork) {
    // 第二次执行 performConcurrentWorkOnRoot 的过程中会又一次调用ensureRootIsScheduled，这时候root.lastExpiredTime是有值的
    // 特殊情况：过期工作应同步刷新。
    // Special case: Expired work should flush synchronously.
    root.callbackExpirationTime = Sync;
    root.callbackPriority = ImmediatePriority;
    // root.callbackNode === 一个fakeCallbackNode假回调节点
    // 调用scheduleSyncCallback的时候并不会立刻执行performSyncWorkOnRoot，而是将其放在syncQueue的一个变量中保留 等待flushSyncCallbackQueue执行的时候执行
    root.callbackNode = scheduleSyncCallback(
      performSyncWorkOnRoot.bind(null, root),
    );
    return;
  }
  // 获取要处理的下一个root的expirationTime （// root.firstPendingTime | root.lastPendingTime | root.nextKnownPendingLevel）
  const expirationTime = getNextRootExpirationTimeToWorkOn(root); // 初始化获取到的是 firstPendingTime
  //现有回调节点
  const existingCallbackNode = root.callbackNode;
  // 说明接下来没有可调度的任务
  if (expirationTime === NoWork) {
    // There's nothing to work on.
    // 如果存在一个渲染任务，必须有相同的到期时间，确认优先级如果当前任务的优先级高就取消之前的任务安排一个新的任务
    if (existingCallbackNode !== null) {
      root.callbackNode = null;
      root.callbackExpirationTime = NoWork;
      root.callbackPriority = NoPriority;
    }
    return;
  }
 // 因为在updateContainer函数调用刚开头已经调用过了该函数，且设置了currentEventTime，所以此处返回的就是currentEventTime
  const currentTime = requestCurrentTimeForUpdate();
  // 根据过去时间和当前时间计算出任务优先级 返回`NormalPriority` (97)
  const priorityLevel = inferPriorityFromExpirationTime(
    currentTime,
    expirationTime,
  );

  //如果存在现有的呈现任务，请确认它具有正确的优先级和过期时间。否则，我们会取消它并安排一个新的。
  // If there's an existing render task, confirm it has the correct priority and
  // expiration time. Otherwise, we'll cancel it and schedule a new one.
  if (existingCallbackNode !== null) {
    const existingCallbackPriority = root.callbackPriority;
    const existingCallbackExpirationTime = root.callbackExpirationTime;
    if (
      //回调必须具有完全相同的过期时间。
    // Callback must have the exact same expiration time.
    existingCallbackExpirationTime === expirationTime &&
      //回调的优先级必须大于或等于priorityLevel。
      // Callback must have greater or equal priority.
      existingCallbackPriority >= priorityLevel
    ) {
      //现有回调已足够。
      // Existing callback is sufficient.
      return;
    }
    // 需要安排新任务。
    // Need to schedule a new task.
    // TODO: Instead of scheduling a new task, we should be able to change the
    // priority of the existing one.
    //待办事项：我们应该能够更改现有任务的优先级，而不是安排新任务
    cancelCallback(existingCallbackNode);
  }
  
  // 取消了之前的任务需要重置为当前最新的
  root.callbackExpirationTime = expirationTime;
  root.callbackPriority = priorityLevel;

  let callbackNode;
  if (expirationTime === Sync) {
    // 同步任务调度
    // Sync React callbacks are scheduled on a special internal queue
    // Sync-React回调安排在一个特殊的内部队列上
    // scheduleSyncCallback 返回一个fakeCallbackNode空对象
    callbackNode = scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
  } else if (disableSchedulerTimeoutBasedOnReactExpirationTime) {
    // 目前这个版本不会走到这里
    callbackNode = scheduleCallback(
      priorityLevel,
      performConcurrentWorkOnRoot.bind(null, root),
    );
  } else {
    // 异步调用 root 渲染会走到这里
    callbackNode = scheduleCallback(
      priorityLevel,
      performConcurrentWorkOnRoot.bind(null, root), // 会多接受一个参数(hasTimeRemaining,currentTime),
      //根据到期时间计算任务超时。这也会影响排序，因为任务是按超时顺序处理的。
      // Compute a task timeout based on the expiration time. This also affects
      // ordering because tasks are processed in timeout order.
      //根据到期时间计算任务超时。这也会影响排序，因为任务是按超时顺序处理的。
      // now() 获取到的是 应用刚加载 到执行到此处的一个时间差，可能有几十毫秒 几百毫秒
       // 此处expirationTimeToMs(expirationTime) = lastNow() + 500: lastNow是指设置HostRootFiber的expirationTime时候调用的now()
       // 此处的now() 会大于lastNow() 一点，但expirationTimeToMs(expirationTime) - now()总体接近于500
      {timeout: expirationTimeToMs(expirationTime) - now()},
    );
  }

  root.callbackNode = callbackNode;
}
```

* `inferPriorityFromExpirationTime`函数 执行的时候返回 `NormalPriority` (97)
```javascript
export function inferPriorityFromExpirationTime(
  currentTime: ExpirationTime,
  expirationTime: ExpirationTime,
): ReactPriorityLevel {
  if (expirationTime === Sync) {
    return ImmediatePriority;
  }
  if (expirationTime === Never || expirationTime === Idle) {
    return IdlePriority;
  }
  // 1 expirationTime = MAGIC_NUMBER_OFFSET - now() - 500
  // 2 expirationTimeToMs(expirationTime) = (MAGIC_NUMBER_OFFSET - expirationTime) * UNIT_SIZE = now() + 500
  // 3 expirationTimeToMs(currentTime) = now()
  // 4 msUntil 约等于 500 所以第一次render app的时候 msUntil <= 600,所以返回NormalPriority
  const msUntil =
    expirationTimeToMs(expirationTime) - expirationTimeToMs(currentTime);
  // msUntil <= 0 也就是 expirationTime 小于 currentTime，证明当前时间大于过期时间，需要立刻执行expirationTime任务，所以返回ImmediatePriority
  if (msUntil <= 0) {
    return ImmediatePriority;
  }
  // const HIGH_PRIORITY_EXPIRATION = __DEV__ ? 500 : 150; // 高优先级过期
  // const HIGH_PRIORITY_BATCH_SIZE = 100; // 高优先级批量大小
if (msUntil <= HIGH_PRIORITY_EXPIRATION + HIGH_PRIORITY_BATCH_SIZE) {
    return UserBlockingPriority;
  }
  // 也就是msUntil小于550毫秒 返回NormalPriority
  if (msUntil <= LOW_PRIORITY_EXPIRATION + LOW_PRIORITY_BATCH_SIZE) {
    return NormalPriority;
  }

  // TODO: Handle LowPriority
  //假设任何更低的都有空闲优先级
  // Assume anything lower has idle priority
  return IdlePriority;
}

```

* `scheduleCallback`函数 [查看此文档说明](../调度scheduler/readme.md)
    > 这里调用`scheduleCallback`函数 的时候 `priorityLevel`获取到为`NormalPriority`，`timeout`接近 500
```javascript
callbackNode = scheduleCallback(
  priorityLevel, // 这里调用的时候是`NormalPriority` (97)
  performConcurrentWorkOnRoot.bind(null, root), // 会多接受一个参数(hasTimeRemaining,currentTime),
  {timeout: expirationTimeToMs(expirationTime) - now()}, // timeout接近 500ms， 误差25ms左右
);
```

* `performConcurrentWorkOnRoot`会在调度相关函数`performWorkUntilDeadline`内执行，（`performWorkUntilDeadline`[文档说明](../调度scheduler/readme.md)）
    > `performConcurrentWorkOnRoot`的参数 `root`是`FiberRoot`，`didTimeout`是`true`

```javascript
function performConcurrentWorkOnRoot(root, didTimeout) {
  //既然我们知道我们在一个react 事件中，我们就可以清除event时间。下一次更新将计算新的event时间。
  // Since we know we're in a React event, we can clear the current
  // event time. The next update will compute a new event time.
  currentEventTime = NoWork;
  //检查渲染是否过期。
  // Check if the render expired.
  // 第一次render的时候 这里是true  执行的地方是performWorkUntilDeadline函数
  if (didTimeout) {
    //渲染任务花费了太长时间才完成。将当前时间标记为expired在一个批处理中同步呈现所有过期的工作。
    // The render task took too long to complete. Mark the current time as
    // expired to synchronously render all expired work in a single batch.
    const currentTime = requestCurrentTimeForUpdate(); // 这里返回的是 currentEventTime,是在ensureRootIsScheduled刚开始执行时候调用设置的
    // 标记root的渲染或者更新时间已经到期了，等待下次执行
    // 设置root.lastExpiredTime = expirationTime;
    markRootExpiredAtTime(root, currentTime);
    //这将安排同步回调。
    // This will schedule a synchronous callback.
    ensureRootIsScheduled(root);
    return null;
  }

  // 第一次render的时候后面可以忽略
  
  //使用根目录中存储的字段确定下一个要处理的到期时间。
  // Determine the next expiration time to work on, using the fields stored
  // on the root.
  let expirationTime = getNextRootExpirationTimeToWorkOn(root);
  if (expirationTime === NoWork) {
    return null;
  }
  const originalCallbackNode = root.callbackNode;
  flushPassiveEffects();

  let exitStatus = renderRootConcurrent(root, expirationTime);
  // RootIncomplete会在prepareFreshStack函数调用的时候设置workInProgressRootExitStatus = RootIncomplete
  if (exitStatus !== RootIncomplete) {
    if (exitStatus === RootErrored) {
      //如果出现错误，请再次尝试渲染。我们将同步呈现以阻止并发数据突变，并在空闲（或更低）时呈现，以便包含所有挂起的更新。
      //如果在第二次尝试之后仍然失败，我们将放弃并提交结果树。
      // If something threw an error, try rendering one more time. We'll
      // render synchronously to block concurrent data mutations, and we'll
      // render at Idle (or lower) so that all pending updates are included.
      // If it still fails after the second attempt, we'll give up and commit
      // the resulting tree.
      expirationTime = expirationTime > Idle ? Idle : expirationTime;
      exitStatus = renderRootSync(root, expirationTime);
    }

    if (exitStatus === RootFatalErrored) {
      const fatalError = workInProgressRootFatalError;
      prepareFreshStack(root, expirationTime);
      markRootSuspendedAtTime(root, expirationTime);
      ensureRootIsScheduled(root);
      throw fatalError;
    }
    //我们现在有一个连续的树。下一步要么提交它，要么，如果某个东西挂起了，等待超时后提交它。
    // We now have a consistent tree. The next step is either to commit it,
    // or, if something suspended, wait to commit it after a timeout.
    const finishedWork: Fiber = ((root.finishedWork =
      root.current.alternate): any);
    root.finishedExpirationTime = expirationTime;
    finishConcurrentRender(root, finishedWork, exitStatus, expirationTime);
  }

  ensureRootIsScheduled(root);
  if (root.callbackNode === originalCallbackNode) {
    // The task node scheduled for this root is the same one that's
    // currently executed. Need to return a continuation.
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  return null;
}
```

* `markRootExpiredAtTime` 用来设置 `FiberRoot` 的 `lastExpiredTime`属性的。`lastExpiredTime`在`FiberRoot`初始化的时候为`NoWork`
```javascript
// 标记root的渲染或者更新时间已经到期了
export function markRootExpiredAtTime(
  root: FiberRoot,
  expirationTime: ExpirationTime,
): void {
  const lastExpiredTime = root.lastExpiredTime;
  // 当root.lastExpiredTime为nowork或者比当前时间大的时候 标记root的过期时间已经到期了  设置为传进来的expirationTime
  if (lastExpiredTime === NoWork || lastExpiredTime > expirationTime) {
    root.lastExpiredTime = expirationTime;
  }
}
```

## `performSyncWorkOnRoot`函数
```javascript
function performSyncWorkOnRoot(root) {
  // 刷新被动效果 flushPassiveEffects调用runWithPriority(priorityLevel, flushPassiveEffectsImpl);flushPassiveEffectsImpl又调用flushSyncCallbackQueue
  //如果根目录或过期时间已更改，请丢弃现有堆栈并准备新堆栈。否则我们将继续我们离开的地方。
  // pendingPassiveEffectsRenderPriority === NoPriority 90;的情况下不执行
  // 第一次render的时候不会执行
  flushPassiveEffects();

  // 上次root的过期时间
  // root.lastExpiredTime是在performSyncWorkOnRoot执行的上一个函数performConcurrentWorkOnRoot执行的时候设置的，所以这里是有值得
  const lastExpiredTime = root.lastExpiredTime;

  let expirationTime;
  // 第一次render的时候 会通过ensureRootIsScheduled调用scheduleSyncCallback的过程中生成root.lastExpiredTime
  if (lastExpiredTime !== NoWork) {
    // 这个根上有过期的工作。检查是否有可重用的部分树 workInProgressRoot 指接下来要更新的节点
    // There's expired work on this root. Check if we have a partial tree
    // that we can reuse.
    
    // workInProgressRoot是在prepareFreshStack准备新栈函数中设置的所以这里的if逻辑也不会走
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

  // 前面设置了 expirationTime = lastExpiredTime;
  // Fiber 树的更新流程分为 render 阶段与 commit 阶段，render 阶段的纯粹意味着可以被拆分，在 Sync 模式下，render 阶段一次性执行完成，而在 Concurrent 模式下，render 阶段可以被拆解，每个时间片内分别运行一部分，直至完成，commit 模式由于带有 DOM 更新，不可能 DOM 变更到一半中断，因此必须一次性执行完成。
  // exitStatus 退出状态， 值为RootIncomplete
  let exitStatus = renderRootSync(root, expirationTime);

  // 这部分可以暂时忽略
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
  // 这部分可以暂时忽略
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

* `renderRootSync`函数[参考文档](./renderRootSync解析.md)
* `commitRoot`函数[参考文档](./commitRoot解析.md)

* `performSyncWorkOnRoot`函数是在 `scheduleSyncCallback`中调用的

### `scheduleSyncCallback`函数
* `scheduleSyncCallback`函数会将`performSyncWorkOnRoot`函数放入`syncQueue`队列末尾，
* 然后再次执行调度`Scheduler_scheduleCallback`（[调度scheduleCallback](../调度scheduler/readme.md)）Scheduler_scheduleCallback参数如下：
        - `priorityLevel` 是`ImmediatePriority`
        - `callback` 是`flushSyncCallbackQueueImpl`
        - `options` 是 `undefined`
* 为`immediateQueueCallbackNode`变量赋值
* 为root.callbackNode变量赋值空对象`{}`
```javascript
export function scheduleSyncCallback(callback: SchedulerCallback) {
    // 执行到这里的时候 callback = performSyncWorkOnRoot
    
  //将此回调推入内部队列。如果有东西调用“flushSyncCallbackQueue”，我们将在下一个时间点或更早的时间刷新它们
  // Push this callback into an internal queue. We'll flush these either in
  // the next tick, or earlier if something calls `flushSyncCallbackQueue`.
  if (syncQueue === null) {
    syncQueue = [callback];
    // Flush the queue in the next tick, at the earliest.
    // 将当前任务的优先级和任务回调函数放入调度Scheduler中进行调度工作
    // var newTask = {
    //     id: taskIdCounter++, // 自增的任务id
    //     callback, // 调度任务回调函数
    //     priorityLevel, // 优先等级 priorityLevel是ImmediatePriority
    //     startTime, // 开始时间
    //     expirationTime, // 过期时间 这时候 expirationTime 比 startTime 小 1
    //     sortIndex: -1, //排序索引
    //   };
    immediateQueueCallbackNode = Scheduler_scheduleCallback(
      Scheduler_ImmediatePriority,
      flushSyncCallbackQueueImpl,
    );
  } else {
    //推到现有队列上。不需要安排回调，因为我们在创建队列时已经安排了回调。
    // Push onto existing queue. Don't need to schedule a callback because
    // we already scheduled one when we created the queue.
    syncQueue.push(callback);
  }
  return fakeCallbackNode;
}
```

* `Scheduler_scheduleCallback`函数在上面调用的时候 会调用 `flushSyncCallbackQueueImpl`函数

### `flushSyncCallbackQueueImpl`函数 会执行 放置于 `syncQueue`队列内的所有任务 也就是`[performSyncWorkOnRoot]`

```javascript
function flushSyncCallbackQueueImpl() {
  if (!isFlushingSyncQueue && syncQueue !== null) {
    // Prevent re-entrancy.
    // 阻止再次执行
    isFlushingSyncQueue = true;
    let i = 0;
    try {
      const isSync = true;
      const queue = syncQueue;
      // 里面会再次执行Scheduler_scheduleCallback，会将syncQueue每一项同步任务依次执行放在任务队列中执行
      runWithPriority(ImmediatePriority, () => {
        for (; i < queue.length; i++) {
          let callback = queue[i];
          do {
            callback = callback(isSync);
          } while (callback !== null);
        }
      });
      syncQueue = null;
    } catch (error) {
      // If something throws, leave the remaining callbacks on the queue.
      //如果有东西抛出，则将剩余的回调留在队列中。
      if (syncQueue !== null) {
        syncQueue = syncQueue.slice(i + 1);
      }
      // Resume flushing in the next tick
      // 执行调度事件
      Scheduler_scheduleCallback(
        Scheduler_ImmediatePriority,
        flushSyncCallbackQueue,
      );
      throw error;
    } finally {
      isFlushingSyncQueue = false;
    }
  }
}
```

