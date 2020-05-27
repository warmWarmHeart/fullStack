# useEffect解析

## 初始mountEffect
### `mountEffect`源码
* 就是调用了 `mountEffectImpl`函数
```javascript
function mountEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  return mountEffectImpl(
    UpdateEffect | PassiveEffect,
    HookPassive,
    create,
    deps,
  );
}
```
### `mountEffectImpl`
* 利用 [`mountWorkInProgressHook`](mountWorkInProgressHook解析.md)创建一个`hook`对象

```javascript
function mountEffectImpl(fiberEffectTag, hookEffectTag, create, deps): void {
    // 创建一个hook对象，且将其追加到currentlyRenderingFiber.memoizedState中
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber.effectTag |= fiberEffectTag;
  hook.memoizedState = pushEffect(
    HookHasEffect | hookEffectTag,
    create,
    undefined,
    nextDeps,
  );
}
```
