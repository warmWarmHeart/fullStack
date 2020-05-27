# mountImperativeHandle 解析
* `mountImperativeHandle` 与 `mountEffect`的方式一样，都调用了`mountEffectImpl` 只是`mountEffectImpl`的参数传值发生了变化：
    - fiberEffectTag：UpdateEffect  = 0b0000000000100  = 4
    - hookEffectTag：HookLayout = 0b010 = 2
    - create: 返回`imperativeHandleEffect`函数，该函数内执行了`mountImperativeHandle`第二个参数，且将执行后结果赋值给`ref.current`,且return出一个将`ref`设置为`null`的回调函数
    - effectDeps: `[ref, ...deps]`，将`ref`加入到依赖中
    
* 源码
```javascript
function mountImperativeHandle<T>(
  ref: {|current: T | null|} | ((inst: T | null) => mixed) | null | void,
  create: () => T,
  deps: Array<mixed> | void | null,
): void {
  // 将ref添加到该被动效果的依赖列表中
  const effectDeps =
    deps !== null && deps !== undefined ? deps.concat([ref]) : null;

  return mountEffectImpl(
    UpdateEffect,
    HookLayout,
    imperativeHandleEffect.bind(null, create, ref),
    effectDeps,
  );
}
```

### imperativeHandleEffect
* 通过 `imperativeHandleEffect` 的第二个参数创建出需要为父组件提供的对象，然后赋值给`ref.current`，这样父组件就可以通过`.current`，调用子组件想要让父组件调用的函数或者参数
* 最后返回`imperativeHandleEffect`的销毁函数
* 源码
```javascript
function imperativeHandleEffect<T>(
  create: () => T,
  ref: {|current: T | null|} | ((inst: T | null) => mixed) | null | void,
) {
  if (typeof ref === 'function') {
    const refCallback = ref;
    const inst = create();
    refCallback(inst);
    return () => {
      refCallback(null);
    };
  } else if (ref !== null && ref !== undefined) {
    const refObject = ref;
    const inst = create();
    refObject.current = inst;
    // 这是销毁函数
    return () => {
      refObject.current = null;
    };
  }
}
```
