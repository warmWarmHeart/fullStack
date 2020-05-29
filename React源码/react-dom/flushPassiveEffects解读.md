# flushPassiveEffects 解读

## 源码
```javascript
// 每次 React 在检测到数据变化时，flushPassiveEffects就会执行。
export function flushPassiveEffects() {
  // 如果正在执行的被动Effect渲染优先级不等于90（ 没有优先级）
  if (pendingPassiveEffectsRenderPriority !== NoPriority) {
    // 设置优先级，取pendingPassiveEffectsRenderPriority和默认优先级小的那个
    const priorityLevel =
      pendingPassiveEffectsRenderPriority > NormalPriority
        ? NormalPriority
        : pendingPassiveEffectsRenderPriority;
    // 将正在执行的被动Effect渲染优先级设置为90防止下次重复执行
    pendingPassiveEffectsRenderPriority = NoPriority;
    // flushPassiveEffectsImpl 是刷新被动Effects接口实现
    return runWithPriority(priorityLevel, flushPassiveEffectsImpl);
  }
}
```
### flushPassiveEffectsImpl
```javascript
function flushPassiveEffectsImpl() {
  // render的时候不会走到下面
  // 该函数执行开始会判断rootWithPendingPassiveEffects是不是null如果是就不执行下面逻辑
  if (rootWithPendingPassiveEffects === null) {
    return false;
  }

  const root = rootWithPendingPassiveEffects;
  const expirationTime = pendingPassiveEffectsExpirationTime;
  // 该函数执行开始会判断rootWithPendingPassiveEffects是不是null如果是就不执行下面逻辑
  rootWithPendingPassiveEffects = null;
  pendingPassiveEffectsExpirationTime = NoWork;

  // 更新执行上下文executionContext，将原始值保存到prevExecutionContext，新值为executionContext按位或提交上下文CommitContext后取得值
  const prevExecutionContext = executionContext;
  executionContext |= CommitContext;

  // runAllPassiveEffectDestroysBeforeCreates：运行所有被动效果在创建前销毁
  // runAllPassiveEffectDestroysBeforeCreates 是false 所以不会走下面第一个if逻辑
  if (runAllPassiveEffectDestroysBeforeCreates) {
    //在调用任何被动效果创建函数之前，调用所有挂起的被动效果销毁函数是很重要的。
    //否则，同级组件中的效果可能会相互干扰。e、 g.一个组件中的销毁功能可能无意中覆盖另一个组件中的创建功能设置的ref值。
    //第一关：摧毁陈旧的被动效果。
    // Layout effects具有相同的约束。
    // It's important that ALL pending passive effect destroy functions are called
    // before ANY passive effect create functions are called.
    // Otherwise effects in sibling components might interfere with each other.
    // e.g. a destroy function in one component may unintentionally override a ref
    // value set by a create function in another component.
    // Layout effects have the same constraint.
    // First pass: Destroy stale passive effects.
    let unmountEffects = pendingPassiveHookEffectsUnmount;
    pendingPassiveHookEffectsUnmount = [];
    for (let i = 0; i < unmountEffects.length; i += 2) {
      // pendingPassiveHookEffectsUnmount每两个为一组， 分别为effects和对应的Fiber
      // type HookEffect = {|
      //   tag: HookEffectTag,
      //   create: () => (() => void) | void,
      //   destroy: (() => void) | void,
      //   deps: Array<mixed> | null,
      //   next: Effect,
      // |};
      const effect = ((unmountEffects[i]: any): HookEffect);
      const fiber = ((unmountEffects[i + 1]: any): Fiber);
      const destroy = effect.destroy;
      effect.destroy = undefined; // 保留destroy函数后将effect上的destroy销毁
      if (typeof destroy === 'function') {
        try {
            //第一关：摧毁陈旧的被动效果。
            destroy();
          } catch (error) {
            invariant(fiber !== null, 'Should be working on an effect.');
            captureCommitPhaseError(fiber, error); /// ???
          }
      }
    }
    // //第二步：创造新的被动效果。
    // Second pass: Create new passive effects.
    let mountEffects = pendingPassiveHookEffectsMount;
    pendingPassiveHookEffectsMount = [];
    for (let i = 0; i < mountEffects.length; i += 2) {
      const effect = ((mountEffects[i]: any): HookEffect);
      const fiber = ((mountEffects[i + 1]: any): Fiber);
      try {
        const create = effect.create;
        if (
          enableProfilerTimer &&
          enableProfilerCommitHooks &&
          fiber.mode & ProfileMode
        ) {
          try {
            startPassiveEffectTimer();
            effect.destroy = create();
          } finally {
            recordPassiveEffectDuration(fiber);
          }
        } else {
          // 初始化effect的销毁函数
          effect.destroy = create();
        }
      } catch (error) {
        invariant(fiber !== null, 'Should be working on an effect.');
        captureCommitPhaseError(fiber, error);
      }
    }
  } else {
    // 逻辑会走入这里
    // Note: This currently assumes there are no passive effects on the root fiber
    // because the root is not part of its own effect list.
    // This could change in the future.
    //注意：这当前假定rootFiber上没有被动影响，因为root不属于其自身的effect列表。
    //这在未来可能会改变。
    let effect = root.current.firstEffect; // 是一个fiber
    // 执行当前effectFiber子树中所有effectFiber的destroy和create函数
    while (effect !== null) {
      try {
        // 提交被动钩子效果
        commitPassiveHookEffects(effect);// ？？？？
      } catch (error) {
        invariant(effect !== null, 'Should be working on an effect.');
        captureCommitPhaseError(effect, error);
      }

      const nextNextEffect = effect.nextEffect;
      //删除next effect指针以帮助GC垃圾回收
      // Remove nextEffect pointer to assist GC
      effect.nextEffect = null;
      effect = nextNextEffect;
    }
  }

  executionContext = prevExecutionContext;

  // !!! 刷新此批处理期间计划的立即回调
  flushSyncCallbackQueue();
  // 如果计划了其他被动效果，则增加一个计数器。如果超过限制，我们会发出警告。
  // If additional passive effects were scheduled, increment a counter. If this
  // exceeds the limit, we'll fire a warning.
  nestedPassiveUpdateCount =
    rootWithPendingPassiveEffects === null ? 0 : nestedPassiveUpdateCount + 1;

  return true;
}
```
