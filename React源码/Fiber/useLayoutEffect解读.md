# useLayoutEffect 解读

## 分析
* `mountLayoutEffect` 与 `mountEffect`的方式一样，都调用了`mountEffectImpl` 只是`mountEffectImpl`的参数传值发生了变化：
    - fiberEffectTag：UpdateEffect  = 0b0000000000100  = 4
    - hookEffectTag：HookLayout = 0b010 = 2
## 源码
```javascript
// 其函数签名与 useEffect 相同，但它会在所有的 DOM 变更之后同步调用 effect。
// 可以使用它来读取 DOM 布局并同步触发重渲染。在浏览器执行绘制之前，useLayoutEffect 内部的更新计划将被同步刷新。
// 如果你正在将代码从 class 组件迁移到使用 Hook 的函数组件，则需要注意 useLayoutEffect 与 componentDidMount、componentDidUpdate 的调用阶段是一样的。但是，我们推荐你一开始先用 useEffect，只有当它出问题的时候再尝试使用 useLayoutEffect
function mountLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  return mountEffectImpl(UpdateEffect, HookLayout, create, deps);
}
```
### mountEffectImpl

* `useLayoutEffect` 钩子调用 `mountEffectImpl`函数的时候与 `useEffect`一样，只不过传的第二个参数变为了  HookLayout
