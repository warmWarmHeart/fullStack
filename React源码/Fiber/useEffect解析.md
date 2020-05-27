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
* 给新建的`hook`对象绑定一个`effect`对象，`pushEffect` [参考文档](pushEffect解析.md)
    > hook.memoizedState指向的是通过pushEffect新创建出来的effect对象，而该effect的next属性又指向该 函数组件前一个hook对应的.memoizedState

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
