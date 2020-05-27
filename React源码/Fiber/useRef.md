# useRef 
简单创建一个hook，然后为` hook.memoizedState `赋值`{current: initialValue}`

```
function mountRef<T>(initialValue: T): {|current: T|} {
  const hook = mountWorkInProgressHook();
  const ref = {current: initialValue};
  if (__DEV__) {
    Object.seal(ref);
  }
  hook.memoizedState = ref;
  return ref;
}
```
