# scheduleUpdateOnFiber
* 通过调度`Scheduler`更新fiber，此处是更新创建好的`HostRootFiber`。
* 调度相关文档可以[参考这里](../调度scheduler/readme.md)

## 源码
```javascript
export function scheduleUpdateOnFiber(
  fiber: Fiber,
  expirationTime: ExpirationTime,
) {
  // 检查嵌套更新
  //使用这些来防止嵌套更新的无限循环
  // nested Update Count嵌套更新计数最大为50
  // 如果超过50具有嵌套更新的根目录rootWithNestedUpdates置为null，nested Update Count置为0
  // 对比nestedUpdateCount、NESTED_UPDATE_LIMIT这两个参数，nestedUpdateCount会在performSyncWorkOnRoot执行flushPassiveEffects的时候加一或置零（rootWithPendingPassiveEffects === null ）
  checkForNestedUpdates();
  // 获取到 FiberRoot
  // 找到当前Fiber的 root
  // 给更新节点的父节点链上的每个节点的expirationTime设置为这个update的expirationTime，除非他本身时间要小于expirationTime
  // 给更新节点的父节点链上的每个节点的childExpirationTime设置为这个update的expirationTime，除非他本身时间要小于expirationTime
  // 最终返回 root 节点的Fiber对象
  // 因为 React 的更新需要从FiberRoot开始，所以会执行一次向上遍历找到FiberRoot，
  // 而向上遍历则正好是一步步找到创建更新的节点的父节点的过程，这时候 React 就会对每一个该节点的父节点链上的节点设置childExpirationTime，
  // 因为这个更新是他们的子孙节点造成的
  // 在我们向下更新整棵Fiber树的时候，每个节点都会执行对应的update方法，
  // 在这个方法里面就会使用节点本身的expirationTime和childExpirationTime来判断他是否可以直接跳过，不更新子树。expirationTime代表他本身是否有更新，
  // 如果他本身有更新，那么他的更新可能会影响子树；childExpirationTime表示他的子树是否产生了更新；如果两个都没有，那么子树是不需要更新的。
  // 1 同一个节点产生的连续两次更新，最红在父节点上只会体现一次childExpirationTime
  // 2 不同子树产生的更新，最终体现在跟节点上的是优先级最高的那个更新:
  // 设置root.firstPendingTime = expirationTime
  const root = markUpdateTimeFromFiberToRoot(fiber, expirationTime);
  if (root === null) {
    // 如果找不到root报警告 警告在DEV中更新未安装的fiber
    // 无法对未装载的组件执行反应状态更新。这是一个no操作，但它表示应用程序内存泄漏。若要修复，请取消useffect清理函数中的所有订阅和异步任务
    warnAboutUpdateOnUnmountedFiberInDEV(fiber);
    return;
  }
  //优先权作为那个函数和这个函数的参数。
  // 会返回 NormalPriority; // 97
  const priorityLevel = getCurrentPriorityLevel();
  // 如果当前是同步更新的
  if (expirationTime === Sync) {
    // 如果不是批量更新或者  不是render或commit阶段，则直接同步调用任务
    if (
      // unbatchedUpdates 函数执行的时候 executionContext 会设置为 LegacyUnbatchedContext
      // 如果正在执行的上下文是unbatchUpdate不是批量更新
      // Check if we're inside unbatchedUpdates
      (executionContext & LegacyUnbatchedContext) !== NoContext &&
      // Check if we're not already rendering
      // 检查不是render或者commit阶段
      (executionContext & (RenderContext | CommitContext)) === NoContext
    ) {
      //这是一个遗留的边缘案例。ReactDOM.render-ed的初始装载
      //batchedUpdates的根目录应该是同步的，但是布局更新应推迟到批处理结束。
      // 在根目录上执行同步工作 这是不通过调度程序的同步任务的入口点
      // 内部会执行 1 flushPassiveEffects 2 renderRootSync 3 commitRoot 4 ensureRootIsScheduled
      performSyncWorkOnRoot(root);
    } else {
      ensureRootIsScheduled(root);
      if (executionContext === NoContext) {
        //现在刷新同步工作，除非我们已经在工作或在批处理中。
        // 这是在scheduleUpdateOnFiber而不是scheduleCallbackForFiber内部故意设置的，以保留在不立即刷新回调的情况下调度回调的功能。
        // 我们只对用户发起的更新执行此操作，以保留传统模式的历史行为。
        // Flush the synchronous work now, unless we're already working or inside
        // a batch. This is intentionally inside scheduleUpdateOnFiber instead of
        // scheduleCallbackForFiber to preserve the ability to schedule a callback
        // without immediately flushing it. We only do this for user-initiated
        // updates, to preserve historical behavior of legacy mode.
        flushSyncCallbackQueue();
      }
    }
  } else {
    // 这个是真正任务调度的入口
    // 每一个root都有一个唯一的调度任务，如果已经存在，我们要确保到期时间与下一级别任务的相同，每一次更新都会调用这个方法
    //使用此函数可为根目录安排任务。每个根目录下只有一个任务；如果已经计划了任务，我们将检查以确保现有任务的过期时间与根目录下一个工作级别的过期时间相同。
    // 此函数在每次更新时调用，并在退出任务之前调用。
    ensureRootIsScheduled(root);
  }

  if (
    (executionContext & DiscreteEventContext) !== NoContext &&
    (priorityLevel === UserBlockingPriority ||
      priorityLevel === ImmediatePriority)
  ) {
      // 忽略暂时不看
    ...
  }
}
```
### `markUpdateTimeFromFiberToRoot`函数
```javascript
function markUpdateTimeFromFiberToRoot(fiber, expirationTime) {
  // 跟新fiber的过期时间 render App 的时候会将expirationTime设置为HostRootFiber.expirationTime
  if (fiber.expirationTime < expirationTime) {
    fiber.expirationTime = expirationTime;
  }
  // fiber拥有一个辅助属性alternate，
  // fiber对象是新时代的虚拟DOM，它是用来承载着组件实例与真实DOM等重要数据。这些重要数据在更新过程是不需要重新生成的。但React希望能像git那样按分支开发，遇错回滚。
  // alternate就是这个备胎
  // 下面是将备胎的过期时间更新
  let alternate = fiber.alternate;
  if (alternate !== null && alternate.expirationTime < expirationTime) {
    alternate.expirationTime = expirationTime;
  }
  //将父路径移动到根目录并更新子到期时间。
  // 父级 Fiber， HostRootFiber的return属性是null
  let node = fiber.return;
  let root = null;
  if (node === null && fiber.tag === HostRoot) {
    // stateNode组件实例
    root = fiber.stateNode;
  } else {
    while (node !== null) {
      // 更新当前Fiber所有父节点祖父节点和他们的备胎alternate上的childExpirationTime，
      // 因为当当前fiber的过期时间更新的时候证明当前fiber绑定的React组件需要更新，name它的父级组件也需要知道它下面有子组件要更新的消息
      alternate = node.alternate;
      // 设置父级Fiber的过期时间，以及挂载在父Fiber上的它下面的children的过期时间childExpirationTime，当一个Fiber的childExpirationTime有值的时候证明它的子元素可能需要更新
      if (node.childExpirationTime < expirationTime) {
        node.childExpirationTime = expirationTime;
        if (
          alternate !== null &&
          alternate.childExpirationTime < expirationTime
        ) {
          alternate.childExpirationTime = expirationTime;
        }
      } else if (
        alternate !== null &&
        alternate.childExpirationTime < expirationTime
      ) {
        alternate.childExpirationTime = expirationTime;
      }
      if (node.return === null && node.tag === HostRoot) {
        root = node.stateNode;
        break;
      }
      node = node.return;
    }
  }

  if (root !== null) {
    // 将workInProgressRoot设置为新创建的HostRootFiber所挂载的ReactElement 也就是 <App />
    if (workInProgressRoot === root) {
      //接收到正在呈现的树的更新。作记号这root是未经加工的
      markUnprocessedUpdateTime(expirationTime);// 设置 workInProgressRootNextUnprocessedUpdateTime = expirationTime

      if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
        //根已被延迟挂起，这意味着此render肯定不会完成。既然我们有了一个新的更新，就在标记传入的更新之前，现在将其标记为挂起。
        // 这会中断当前呈现并切换到更新 暂不解读
        markRootSuspendedAtTime(root, renderExpirationTime);
      }
    }
    // 标记根目录有挂起的更新。
    // Mark that the root has a pending update.
    markRootUpdatedAtTime(root, expirationTime);
  }

  return root;
}
```

#### `markRootUpdatedAtTime`函数标记根目录有挂起的更新，render函数第一次走到这里会将`HostRootFiber`下绑定的reactElement`<App />`的`firstPendingTime`设置为`expirationTime`
```javascript
// //标记根目录有正在等待状态的更新。
export function markRootUpdatedAtTime(
  root: FiberRoot,
  expirationTime: ExpirationTime,
): void {
  // 更新pending时间范围， HostRootFiber初始化firstPendingTime=null ，所以会在这里设置firstPendingTime
  const firstPendingTime = root.firstPendingTime;
  if (expirationTime > firstPendingTime) {
    root.firstPendingTime = expirationTime;
  }
  //更新悬停的时间的范围。将优先级较低或等于此更新的所有内容都视为未悬停
  // 首先我们定义一下什么情况下任务是被悬停的：
  // 出现可捕获的错误并且还有优先级更低的任务的情况下
  // 当捕获到thenable，并且需要设置onTimeout的时候
  // 我们称这个任务被suspended(悬停)了。记录这个时间主要是在resolve了promise之后，
  const firstSuspendedTime = root.firstSuspendedTime;
  if (firstSuspendedTime !== NoWork) {
    if (expirationTime >= firstSuspendedTime) {
      //整个暂停范围现在没有暂停。
      // The entire suspended range is now unsuspended.
      root.firstSuspendedTime = root.lastSuspendedTime = root.nextKnownPendingLevel = NoWork;
    } else if (expirationTime >= root.lastSuspendedTime) {
      root.lastSuspendedTime = expirationTime + 1;
    }
    //这是pending的级别。检查该级别是否高于下一个已知pending级别。
    if (expirationTime > root.nextKnownPendingLevel) {
      root.nextKnownPendingLevel = expirationTime;
    }
  }
}
```
