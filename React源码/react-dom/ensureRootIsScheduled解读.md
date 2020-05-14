# ensureRootIsScheduled解读.md
> `ensureRootIsScheduled`函数 这里是真正的[调度](../调度scheduler/readme.md)入口，内部包含了对`App`React组件下所有`chillren`相关Fiber的创建绑定，及各种Hooks相关`effect`的创建绑定以及`update`的创建绑定，也有对子组件下面render函数真实dom的创建绑定，还有各种生命周期的执行，最后渲染整个真实dom的过程

## `ensureRootIsScheduled`源码
```javascript
function ensureRootIsScheduled(root: FiberRoot) {
  // 最后过期时间 第一次HostRootFiber执行到此处root.lastExpiredTime = null
  const lastExpiredTime = root.lastExpiredTime;
  // root.lastExpiredTime 会在走过一次ensureRootIsScheduled后设置
  if (lastExpiredTime !== NoWork) {
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
  const expirationTime = getNextRootExpirationTimeToWorkOn(root); // 初始化获取到的是firstPendingTime
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

  // TODO: If this is an update, we already read the current time. Pass the
  // time as an argument.
  const currentTime = requestCurrentTimeForUpdate(); // 在重新读取一个时间戳
  // 根据过去时间和当前时间计算出任务优先级
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
      {timeout: expirationTimeToMs(expirationTime) - now()},
    );
  }

  root.callbackNode = callbackNode;
}
```
