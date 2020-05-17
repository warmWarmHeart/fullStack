# ReactCurrentDispatcher详解
* 函数组件在实例化的时候可能会调用各种React`Hook`钩子（[参考文档](https://react.docschina.org/docs/hooks-intro.html)）
    - 除了函数组件执行的其他场景，`ReactCurrentDispatcher.current`都会设置成`ContextOnlyDispatcher`
    - 函数组件第一次实例化的时候`ReactCurrentDispatcher.current`都会设置成`HooksDispatcherOnMount`
    - 函数组件第一次以后其他实例化的时候`ReactCurrentDispatcher.current`都会设置成`HooksDispatcherOnUpdate`
    - 如果函数组件实例过程中存在调用`setState`类似的操作，`ReactCurrentDispatcher.current`都会设置成`HooksDispatcherOnRerender`

## ContextOnlyDispatcher
* 除了`readContext`，其他Hook在被调用的时候都会抛出错误
* ContextOnlyDispatcher 对象
```javascript
const ContextOnlyDispatcher: Dispatcher = {
  readContext,

  useCallback: throwInvalidHookError,
  useContext: throwInvalidHookError,
  useEffect: throwInvalidHookError,
  useImperativeHandle: throwInvalidHookError,
  useLayoutEffect: throwInvalidHookError,
  useMemo: throwInvalidHookError,
  useReducer: throwInvalidHookError,
  useRef: throwInvalidHookError,
  useState: throwInvalidHookError,
  useDebugValue: throwInvalidHookError,
  useResponder: throwInvalidHookError,
  useDeferredValue: throwInvalidHookError,
  useTransition: throwInvalidHookError,
  useMutableSource: throwInvalidHookError,
  useEvent: throwInvalidHookError,
};
```
### throwInvalidHookError
* 在被调用的时候会抛出： `hook` 只能在函数组件内被调用的错误信息
```javascript
function throwInvalidHookError() {
  invariant(
    false,
    'Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for' +
      ' one of the following reasons:\n' +
      '1. You might have mismatching versions of React and the renderer (such as React DOM)\n' +
      '2. You might be breaking the Rules of Hooks\n' +
      '3. You might have more than one copy of React in the same app\n' +
      'See https://fb.me/react-invalid-hook-call for tips about how to debug and fix this problem.',
  );
}
```

## HooksDispatcherOnMount
* HooksDispatcherOnMount 对象
```javascript
const HooksDispatcherOnMount: Dispatcher = {
  readContext,
  useCallback: mountCallback,
  useContext: readContext,
  useEffect: mountEffect, // useEffect和useState等的区别 useEffect将effect额外的添加到了fiber的UpdateQueue上 这么做的情况是希望effect会在组件更新的时候触发执行
  useImperativeHandle: mountImperativeHandle,
  useLayoutEffect: mountLayoutEffect,
  useMemo: mountMemo,
  useReducer: mountReducer,
  useRef: mountRef,
  useState: mountState,
  useDebugValue: mountDebugValue,
  useResponder: createDeprecatedResponderListener,
  useDeferredValue: mountDeferredValue,
  useTransition: mountTransition,
  useMutableSource: mountMutableSource,
  useEvent: mountEventListener,
};
```
### mountCallback
* 新建一个hook，且将hook绑定为函数组件Fiber的`memoizedState`和`workInProgressHook`或者`workInProgressHook.next`
* 将`workInProgressHook`重新设置为上面新建的`hook`，方便下次有hook钩子调用的时候接着为它的`next`属性赋值
* 给上面新建的`hook`的`memoizedState`属性赋值：`[callback, nextDeps]`
    > 以后当函数组件再次执行的时候，会对比`nextDeps`中每个变量的新旧值，如果新旧值相同，就去保存过得`hook`的`memoizedState`中的`callback`，否则将新传递进来的`callback`返回给组件实例用
    > 所以当函数组件用 `useCallback`的时候，你所传进去的`callback`并不是你会用到的回调函数，可能是之前的旧callback

```javascript
function mountCallback<T>(callback: T, deps: Array<mixed> | void | null): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  hook.memoizedState = [callback, nextDeps];
  return callback;
}
```

## HooksDispatcherOnUpdate
```javascript
const HooksDispatcherOnUpdate: Dispatcher = {
  readContext,

  useCallback: updateCallback,
  useContext: readContext,
  useEffect: updateEffect,
  useImperativeHandle: updateImperativeHandle,
  useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  useReducer: updateReducer,
  useRef: updateRef,
  useState: updateState,
  useDebugValue: updateDebugValue,
  useResponder: createDeprecatedResponderListener,
  useDeferredValue: updateDeferredValue,
  useTransition: updateTransition,
  useMutableSource: updateMutableSource,
  useEvent: updateEventListener,
};
```

## HooksDispatcherOnRerender
```javascript
const HooksDispatcherOnRerender: Dispatcher = {
  readContext,

  useCallback: updateCallback,
  useContext: readContext,
  useEffect: updateEffect,
  useImperativeHandle: updateImperativeHandle,
  useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  useReducer: rerenderReducer,
  useRef: updateRef,
  useState: rerenderState,
  useDebugValue: updateDebugValue,
  useResponder: createDeprecatedResponderListener,
  useDeferredValue: rerenderDeferredValue,
  useTransition: rerenderTransition,
  useMutableSource: updateMutableSource,
  useEvent: updateEventListener,
};
```

## mountWorkInProgressHook
* HooksDispatcherOnMount的每个`hook`钩子函数都会调用它来生成一个描述自己的`Hook`对象
* 1 初始化一个描述当前`Hook`
* 2 
    - 如果`workInProgressHook`为`null`，证明当前hook是`workInProgress`第一个`hook`对象，将 `workInProgress.memoizedState`和`workInProgressHook`都设置为第一步新创建的`hook`对象
    - 如果`workInProgressHook`不为`null`，将当前新建的`hook`绑定到`workInProgress`的`next`属性（一个函数组件的hooks是一个链条，挨着的两个hook之间用next作为连接）
```javascript
function mountWorkInProgressHook(): Hook {
  // 1 初始化一个描述当前`Hook`
  const hook: Hook = {
    memoizedState: null,

    baseState: null,
    baseQueue: null,
    queue: null,

    next: null,
  };
  // 每个hook新创建的时候workInProgressHook都等于null
  if (workInProgressHook === null) {
    // currentlyRenderingFiber 会在 renderWithHooks的时候赋值为当时的workInProgress
    //这是列表中的第一个钩子
    // This is the first hook in the list
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    //追加到列表末尾
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}
```
