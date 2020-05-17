# mountClassComponent解析

## `updateClassComponent`
* 1 准备类组件上下文`context`相关内容
* 2 根据类组件的`Fiber.stateNode`和`workInProgress.type`,调用`constructClassInstance`构造一个实例 
* 3 为上面创建的组件实例初始化其各种属性：`props`、`state`、`context`、`refs`等，且执行生命钩子：willMount、didMount等
* 4 执行`finishClassComponent`函数，利用组件实例的`render`方法创建出该组件的`children`组件对象，然后再次调用[`reconcileChildren`函数](reconcileChildren解析.md)
* 5 将第 4 部得到的`fiber`对象赋值给`workInProgress`，然后继续执行[`workLoopSync`函数](renderRootSync解析.md)里的循环部分：对[`performUnitOfWork`函数](performUnitOfWork函数.md)的执行,
```javascript
function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps, // {children: null}
  renderExpirationTime: ExpirationTime,
) {
  //提前推送上下文提供程序以防止上下文堆栈不匹配。
  //在挂载期间，我们还不知道子上下文，因为实例不存在。
  //我们将在呈现之后立即使finishClassComponent（）中的子上下文无效。
  // Push context providers early to prevent context stack mismatches.
  // During mounting we don't know the child context yet as the instance doesn't exist.
  // We will invalidate the child context in finishClassComponent() right after rendering.
  let hasContext;
  if (isLegacyContextProvider(Component)) {
    hasContext = true;
    pushLegacyContextProvider(workInProgress);
  } else {
    hasContext = false;
  }
  prepareToReadContext(workInProgress, renderExpirationTime);

  // 通过此语句创建的组件实例const instance = new ctor(props, context);
  const instance = workInProgress.stateNode; // 初始化为null， 会在constructClassInstance中调用adoptClassInstance设置
  let shouldUpdate; // 是否应该更新状态
  // 实例如果是null 证明stateNode并无绑定任何reactElement或者domElement或者Fiber
  if (instance === null) {
    if (current !== null) {
      //没有实例的类组件只有在不一致的状态下挂起在非并发树中时才会挂载。我们想把它当作一个新的挂载，即使它的一个空版本已经提交。断开备用指针。
      // A class component without an instance only mounts if it suspended
      // inside a non-concurrent tree, in an inconsistent state. We want to
      // treat it like a new mount, even though an empty version of it already
      // committed. Disconnect the alternate pointers.
      current.alternate = null;
      workInProgress.alternate = null;
      //由于这是概念上的新光纤，请安排放置效果
      // Since this is conceptually a new fiber, schedule a Placement effect
      workInProgress.effectTag |= Placement;
    }
    //在初始过程中，我们可能需要构造实例。
    // In the initial pass we might need to construct the instance.
    // 生成一个react实例 指向workProgress.stateNode
    constructClassInstance(workInProgress, Component, nextProps);
    mountClassInstance(
      workInProgress,
      Component,
      nextProps,
      renderExpirationTime,
    );
    shouldUpdate = true;
  } else if (current === null) {
    //我们已经有了一个可以重用的实例。所以直接从workInProgress.stateNode中获取实例
    // In a resume, we'll already have an instance we can reuse.
    // 这里会执行willMount和didMount生命函数
    shouldUpdate = resumeMountClassInstance(
      workInProgress,
      Component,
      nextProps,
      renderExpirationTime,
    );
  } else {
    shouldUpdate = updateClassInstance(
      current,
      workInProgress,
      Component,
      nextProps,
      renderExpirationTime,
    );
  }
  const nextUnitOfWork = finishClassComponent(
    current,
    workInProgress,
    Component,
    shouldUpdate,
    hasContext,
    renderExpirationTime,
  );
  return nextUnitOfWork;
}
```

## `isContextProvider`函数
* 根据 通过 `function App() {}`创建出来的`reactElement`对象的`childContextTypes`属性来判断当前组件是否是`ContextProvider`

* `ContextProvider`类型组件使用[参考官方文档](https://react.docschina.org/docs/context.html#contextprovider)
```javascript
function isContextProvider(type: Function): boolean {
  if (disableLegacyContext) {
    return false;
  } else {
    // 父组件，也就是Context生产者，需要通过一个静态属性childContextTypes声明提供给子组件的Context对象的属性，
    // 并实现一个实例getChildContext方法，返回一个代表Context的纯对象 (plain object) 。
    const childContextTypes = type.childContextTypes;
    return childContextTypes !== null && childContextTypes !== undefined;
  }
}
```
## `pushLegacyContextProvider`函数
* `__reactInternalMemoizedMergedChildContext`属性会在`finishClassComponent`函数执行的时候设置，此处 `memoizedMergedChildContext` 等于一个空对象
* 记住父上下文 `previousContext`，以便我们以后可以与它合并。
* `contextStackCursor.current`指向一个空对象
* `didPerformWorkStackCursor.current`保持不变

```javascript
function pushContextProvider(workInProgress: Fiber): boolean {
  if (disableLegacyContext) {
    return false;
  } else {
    const instance = workInProgress.stateNode;
    //我们尽早推送上下文以确保堆栈完整性。
    //如果实例还不存在，我们将首先推送null，然后在使上下文无效时在堆栈上替换它。
    // We push the context as early as possible to ensure stack integrity.
    // If the instance does not exist yet, we will push null at first,
    // and replace it on the stack later when invalidating the context.
    const memoizedMergedChildContext =
      (instance && instance.__reactInternalMemoizedMergedChildContext) ||
      emptyContextObject;

    //记住父上下文，以便我们以后可以与它合并。
    //继承父级的did perform work值以避免意外阻塞更新。
    // Remember the parent context so we can merge with it later.
    // Inherit the parent's did-perform-work value to avoid inadvertently blocking updates.
    previousContext = contextStackCursor.current;
    push(contextStackCursor, memoizedMergedChildContext, workInProgress);
    push(
      didPerformWorkStackCursor,
      didPerformWorkStackCursor.current,
      workInProgress,
    );

    return true;
  }
}
```
## `prepareToReadContext`函数
* 将`currentlyRenderingFiber`设为当前执行的`Fiber`对象

* `Fiber.dependencies`放着当前fiber的事件和context对象

* 将`didReceiveUpdate`变量设置为true（`markWorkInProgressReceivedUpdate`函数执行后）

```javascript
// prepareToReadContext 主要是为了能够继续向下传播 context 变更。
export function prepareToReadContext(
  workInProgress: Fiber,
  renderExpirationTime: ExpirationTime,
): void {
  currentlyRenderingFiber = workInProgress;
  lastContextDependency = null;
  lastContextWithAllBitsObserved = null;

  const dependencies = workInProgress.dependencies;
  if (dependencies !== null) {
    const firstContext = dependencies.firstContext;
    if (firstContext !== null) {
      if (dependencies.expirationTime >= renderExpirationTime) {
        //上下文列表有一个挂起的更新。标记这种纤维起作用。
        // Context list has a pending update. Mark that this fiber performed work.
        markWorkInProgressReceivedUpdate();
      }
      // Reset the work-in-progress list
      dependencies.firstContext = null;
    }
  }
}
```

## `constructClassInstance`函数
* 参数
    - workInProgress：Fiber
    - ctor：类组件构造函数
    - props：{ children: null }
* 读取 `context._currentValue` 的同时 为`workInProgress.dependencies`赋初始值
    ```javascript
          {
            expirationTime: NoWork,
            firstContext: contextItem,
            responders: null,
          }
    ```
* 通过 `new` 标识符 调用 类函数 `function App(){}`实例化一个对象，就是包含我们平常有`render`方法、各种生命钩子的**组件**实例
* 源码
```javascript
function constructClassInstance(
  workInProgress: Fiber,
  ctor: any, // 类组件的构造函数
  props: any,
): any {
  let isLegacyContextConsumer = false;
  let unmaskedContext = emptyContextObject;
  let context = emptyContextObject;
  // contextType是通过`React.createContext`创造出的一个context对象，包含了Provider及Consumer
  const contextType = ctor.contextType;

  if (typeof contextType === 'object' && contextType !== null) {
    context = readContext((contextType: any));
  } else if (!disableLegacyContext) {
    unmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    const contextTypes = ctor.contextTypes;
    isLegacyContextConsumer =
      contextTypes !== null && contextTypes !== undefined;
    context = isLegacyContextConsumer
      ? getMaskedContext(workInProgress, unmaskedContext)
      : emptyContextObject;
  }

  const instance = new ctor(props, context); // 创建react实例
  const state = (workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined
      ? instance.state
      : null);
  // instance.updater = classComponentUpdater;
  // workInProgress.stateNode = instance;
  adoptClassInstance(workInProgress, instance);
    //缓存未标记过的上下文，以便我们可以避免重新创建标记过的上下文，除非有必要。
    //ReactFiberContext通常更新此缓存，但不能用于新创建的实例。
  // Cache unmasked context so we can avoid recreating masked context unless necessary.
  // ReactFiberContext usually updates this cache but can't for newly-created instances.
  if (isLegacyContextConsumer) {
      // 这里isLegacyContextConsumer为false 所以暂忽略此处
    cacheContext(workInProgress, unmaskedContext, context);
  }

  return instance;
}
```

### `readContext`函数
* 为`workInProgress.dependencies`赋初始值
* 返回 `context._currentValue` 或者 `context._currentValue2`
* 源码：
```javascript
function readContext<T>(
  context: ReactContext<T>,
  observedBits: void | number | boolean, // 观测位 // 这里在上面调用的时候未传，值为undefined
): T {
   // 观察到所有位的最后一个上下文
   // lastContextWithAllBitsObserved 默认为null
  if (lastContextWithAllBitsObserved === context) {
    // Nothing to do. We already observe everything in this context.
  } else if (observedBits === false || observedBits === 0) {
    // 没有观察到任何更新
    // Do not observe any updates.
  } else {
    // 逻辑会进入到这里
    // 避免对可观察的参数或异类类型取消选择。
    let resolvedObservedBits; // Avoid deopting on observable arguments or heterogeneous types.
    if (
      typeof observedBits !== 'number' ||
      observedBits === MAX_SIGNED_31_BIT_INT
    ) {
      // 逻辑会进入到这里
      // context 是通过createContext创建出来的对象

      //注意所有更新。
      // Observe all updates.
      lastContextWithAllBitsObserved = ((context: any): ReactContext<mixed>);
      resolvedObservedBits = MAX_SIGNED_31_BIT_INT;
    } else {
      resolvedObservedBits = observedBits;
    }

    let contextItem = {
      context: ((context: any): ReactContext<mixed>),
      observedBits: resolvedObservedBits,
      next: null,
    };

    if (lastContextDependency === null) {
      // 逻辑会进入到这里

      //这是此组件的第一个依赖项。创建新列表。
      // This is the first dependency for this component. Create a new list.
      lastContextDependency = contextItem;
      // 因为currentlyRenderingFiber在上面prepareToReadContext执行的时候指向当前workInProgress，所以下面这句相当于workInProgress.dependencies = {...}
      currentlyRenderingFiber.dependencies = {
        expirationTime: NoWork,
        firstContext: contextItem,
        responders: null,
      };
    } else {
      //追加新的上下文项。
      // Append a new context item.
      lastContextDependency = lastContextDependency.next = contextItem;
    }
  }
  // 是主渲染器
  return isPrimaryRenderer ? context._currentValue : context._currentValue2;
}

```

### `adoptClassInstance`函数
* 指定 `<App />`组件实例的`updater`属性为 `classComponentUpdater`
* 将`workInProgress`Fiber和`<App />`实例通过`stateNode`连接起来
* 设置`<App>`的`_reactInternalFiber`为`workInProgress`

```javascript
function adoptClassInstance(workInProgress: Fiber, instance: any): void {
  instance.updater = classComponentUpdater;
  workInProgress.stateNode = instance;
  //实例需要访问光纤，以便它可以安排更新
  // The instance needs access to the fiber so that it can schedule updates
  setInstance(instance, workInProgress);
}
```

#### `classComponentUpdater`对象
* `classComponentUpdater`对象就是类组件更新自身需要用到的方法集合，如：
    - setState({...})
    - this.forceUpdate()
* 相关详细讲解[参考文档](../ReactUpdate解析.md)

#### `setInstance`函数
* 设置`<App>`的`_reactInternalFiber`为`workInProgress`
```
function set(key, value) {
  key._reactInternalFiber = value;
}
```
### `mountClassInstance`函数
* `mountClassInstance`函数负责将创建出来的React组件实例转换成真实`dom`，并且执行以下生命钩子：
    - getDerivedStateFromProps
    - getSnapshotBeforeUpdate
    - UNSAFE_componentWillMount
    - componentWillMount
    - componentDidMount
* 刚开始先初始化组件各种属性：
    - props
    - state
    - refs
    - context
* 为组件相对应的Fiber对象`workInProgress`初始化`UpdateQueue`属性（[参考文档](../react/UpdateQueue属性.md)）
* 执行`processUpdateQueue`，循环遍历`workInProgress`的`UpdateQueue`的相关属性得到一个新state赋值给组件的state属性
* 执行 `getDerivedStateFromProps`生命钩子（该钩子在`componentWillMount`钩子之前执行）
* 执行 `componentWillMount`生命钩子，执行完后再次执行`processUpdateQueue`函数初始化一个新的state，因为在`willMount`钩子里对组件`state`做了更新操作
* 执行 `componentDidMount` 生命钩子


```javascript
//在以前从未呈现过的实例上调用装载生命周期。
// Invokes the mount life-cycles on a previously never rendered instance.
function mountClassInstance(
  workInProgress: Fiber,
  ctor: any, // workInProgress.stateNode指向的内容
  newProps: any,
  renderExpirationTime: ExpirationTime,
): void {
  const instance = workInProgress.stateNode;
  instance.props = newProps;
  instance.state = workInProgress.memoizedState;
  instance.refs = emptyRefsObject;
  // 初始化workInProgress的UpdateQueue
  initializeUpdateQueue(workInProgress);

  const contextType = ctor.contextType;
  // 设置实例的context
  if (typeof contextType === 'object' && contextType !== null) {
    //  readContext函数 return isPrimaryRenderer ? context._currentValue : context._currentValue2;
    instance.context = readContext(contextType);
  } else if (disableLegacyContext) {
    instance.context = emptyContextObject;
  } else {
    const unmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    instance.context = getMaskedContext(workInProgress, unmaskedContext);
  }
  // 设置workInProgress.memoizedState = newState;
  processUpdateQueue(workInProgress, newProps, instance, renderExpirationTime);
  instance.state = workInProgress.memoizedState;

  // 执行getDerivedStateFromProps生命周期 文档
  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
  if (typeof getDerivedStateFromProps === 'function') {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps,
    );
    instance.state = workInProgress.memoizedState;
  }

  //为了支持反应生命周期compat polyfilled组件，
  //对于使用新api的组件，不应调用不安全的生命周期。
  // In order to support react-lifecycles-compat polyfilled components,
  // Unsafe lifecycles should not be invoked for components using the new APIs.
  if (
    typeof ctor.getDerivedStateFromProps !== 'function' &&
    typeof instance.getSnapshotBeforeUpdate !== 'function' &&
    (typeof instance.UNSAFE_componentWillMount === 'function' ||
      typeof instance.componentWillMount === 'function')
  ) {
    callComponentWillMount(workInProgress, instance);
    //如果在这个生命周期中有额外的状态更新，现在就处理它们。
    // If we had additional state updates during this life-cycle, let's
    // process them now.
    // 比如在willMount中执行了setState这种操作
    processUpdateQueue(
      workInProgress,
      newProps,
      instance,
      renderExpirationTime,
    );
    instance.state = workInProgress.memoizedState;
  }

  if (typeof instance.componentDidMount === 'function') {
    workInProgress.effectTag |= Update;
  }
}
```
### processUpdateQueue
[参考文档](./processUpdateQueue详解.md)
* 先将`UpdateQueue.shared.pending`上的`update`链全部转移到`UpdateQueue.firstBaseUpdate`上
* 循环遍历`UpdateQueue`的`firstBaseUpdate`属性，生成一个新的state，然后赋值给当前Fiber对象`workInProgress`的`memoizedState`属性
* 设置`workInProgress`的`expirationTime`属性

## `resumeMountClassInstance`函数
* 逻辑和`mountClassInstance`大同小异，区别只是实例`instance`是现成的 没必要再次调用`new ctr()`构造一个新的

## `updateClassInstance`函数
* 逻辑和`mountClassInstance`大同小异
* 和`mountClassInstance`的区别
    - `instance`实例现成 没必要再次调用`new ctr()`构造一个新的
    - 生命周期钩子为：UNSAFE_componentWillReceiveProps、componentWillReceiveProps、componentDidUpdate、applyDerivedStateFromProps
    - `updateClassInstance`函数还会
```javascript
// Invokes the update life-cycles and returns false if it shouldn't rerender.
//调用更新生命周期，如果不应重新提交，则返回false。
function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderExpirationTime: ExpirationTime,
): boolean {
  const instance = workInProgress.stateNode;

  cloneUpdateQueue(current, workInProgress);

  const oldProps = workInProgress.memoizedProps;
  instance.props =
    workInProgress.type === workInProgress.elementType
      ? oldProps
      : resolveDefaultProps(workInProgress.type, oldProps);

  const oldContext = instance.context;
  const contextType = ctor.contextType;
  let nextContext = emptyContextObject;
  if (typeof contextType === 'object' && contextType !== null) {
    nextContext = readContext(contextType);
  } else if (!disableLegacyContext) {
    // Child Component 会先获取全局 context，称之为 unmaskedContext，根据 contextTypes 的定义，从 unmaskedContext 割取为 maskedContext，生命周期函数中获取的 context 均由此而来。
    const nextUnmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    nextContext = getMaskedContext(workInProgress, nextUnmaskedContext);
  }

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
  const hasNewLifecycles =
    typeof getDerivedStateFromProps === 'function' ||
    typeof instance.getSnapshotBeforeUpdate === 'function';

  // Note: During these life-cycles, instance.props/instance.state are what
  // ever the previously attempted to render - not the "current". However,
  // during componentDidUpdate we pass the "current" props.

  // In order to support react-lifecycles-compat polyfilled components,
  // Unsafe lifecycles should not be invoked for components using the new APIs.
  if (
    !hasNewLifecycles &&
    (typeof instance.UNSAFE_componentWillReceiveProps === 'function' ||
      typeof instance.componentWillReceiveProps === 'function')
  ) {
    if (oldProps !== newProps || oldContext !== nextContext) {
      callComponentWillReceiveProps(
        workInProgress,
        instance,
        newProps,
        nextContext,
      );
    }
  }

  resetHasForceUpdateBeforeProcessing();

  const oldState = workInProgress.memoizedState;
  let newState = (instance.state = oldState);
  processUpdateQueue(workInProgress, newProps, instance, renderExpirationTime);
  newState = workInProgress.memoizedState;

  if (
    oldProps === newProps &&
    oldState === newState &&
    !hasContextChanged() &&
    !checkHasForceUpdateAfterProcessing()
  ) {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Update;
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Snapshot;
      }
    }
    return false;
  }

  if (typeof getDerivedStateFromProps === 'function') {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps,
    );
    newState = workInProgress.memoizedState;
  }

  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState,
      nextContext,
    );

  if (shouldUpdate) {
    // In order to support react-lifecycles-compat polyfilled components,
    // Unsafe lifecycles should not be invoked for components using the new APIs.
    if (
      !hasNewLifecycles &&
      (typeof instance.UNSAFE_componentWillUpdate === 'function' ||
        typeof instance.componentWillUpdate === 'function')
    ) {
      startPhaseTimer(workInProgress, 'componentWillUpdate');
      if (typeof instance.componentWillUpdate === 'function') {
        instance.componentWillUpdate(newProps, newState, nextContext);
      }
      if (typeof instance.UNSAFE_componentWillUpdate === 'function') {
        instance.UNSAFE_componentWillUpdate(newProps, newState, nextContext);
      }
      stopPhaseTimer();
    }
    if (typeof instance.componentDidUpdate === 'function') {
      workInProgress.effectTag |= Update;
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      workInProgress.effectTag |= Snapshot;
    }
  } else {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Update;
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Snapshot;
      }
    }

    // If shouldComponentUpdate returned false, we should still update the
    // memoized props/state to indicate that this work can be reused.
    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
  }

  // Update the existing instance's state, props, and context pointers even
  // if shouldComponentUpdate returns false.
  instance.props = newProps;
  instance.state = newState;
  instance.context = nextContext;

  return shouldUpdate;
}
```
### `checkShouldComponentUpdate`函数
* 类组件根据组件的生命钩子`shouldComponentUpdate`判定是否应该更新组件
* 根据类组件是否继承自`PureComponent`然后结合对比新props和旧props、新state和旧state的结果判定是否应该更新组件

```javascript
// 执行shouldComponentUpdate生命周期
function checkShouldComponentUpdate(
  workInProgress,
  ctor,
  oldProps,
  newProps,
  oldState,
  newState,
  nextContext,
) {
  const instance = workInProgress.stateNode;
  if (typeof instance.shouldComponentUpdate === 'function') {
    startPhaseTimer(workInProgress, 'shouldComponentUpdate');
    const shouldUpdate = instance.shouldComponentUpdate(
      newProps,
      newState,
      nextContext,
    );
    stopPhaseTimer();

    return shouldUpdate;
  }

  // 如果是PureReactComponent则浅比较props和state 看是否需要更新
  if (ctor.prototype && ctor.prototype.isPureReactComponent) {
    return (
      !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState)
    );
  }

  return true;
}
```

## `finishClassComponent`函数
* 更新Fiber对象`workInProgress`的`ref`
    > 即使shouldComponentUpdate返回false，Refs也应该更新
* 根据 `checkShouldComponentUpdate`得到是否应该更新的结果： `shouldUpdate`，以及之前过程中有没有捕获到错误的变量`DidCapture`判定是否忽略更新此组件，如果要忽略，执行`bailoutOnAlreadyFinishedWork`函数
* 利用组件实例的`render`方法获取当前组件的`children`，然后调用`reconcileChildren`函数继续按照`children.type`（children的构造函数）创建属于children的`Fiber`对象，又开始了一个轮回。。。

* 源码
```javascript
function finishClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  shouldUpdate: boolean,
  hasContext: boolean,
  renderExpirationTime: ExpirationTime,
) {
  //即使shouldComponentUpdate返回false，Refs也应该更新
  // Refs should update even if shouldComponentUpdate returns false
  markRef(current, workInProgress);

  const didCaptureError = (workInProgress.effectTag & DidCapture) !== NoEffect;

  if (!shouldUpdate && !didCaptureError) {
    //上下文提供程序应遵从sCU进行呈现
    // Context providers should defer to sCU for rendering
    if (hasContext) {
      invalidateContextProvider(workInProgress, Component, false);
    }
    return bailoutOnAlreadyFinishedWork(
      current,
      workInProgress,
      renderExpirationTime,
    );
  }

  const instance = workInProgress.stateNode;

  // Rerender
  ReactCurrentOwner.current = workInProgress;
  let nextChildren;
  if (
    didCaptureError &&
    typeof Component.getDerivedStateFromError !== 'function'
  ) {
    //如果捕捉到错误，但未定义getDerivedStateFromError，请卸载所有子级。componentDidCatch将安排更新以重新呈现回退。在我们将所有人迁移到新API之前，这是暂时的。
    // If we captured an error, but getDerivedStateFromError is not defined,
    // unmount all the children. componentDidCatch will schedule an update to
    // re-render a fallback. This is temporary until we migrate everyone to
    // the new API.
    // TODO: Warn in a future release.
    nextChildren = null;
  } else {
    // 重新执行实例的render函数赋值给nextChildren
    // 在 workInProgress 节点自身处理完成之后，会通过props.children或者instance.render方法获取子 ReactElement。子 ReactElement 可能是对象、数组、字符串、迭代器，针对不同的类型进行处理。
    nextChildren = instance.render();
  }

  // React DevTools reads this flag.
  workInProgress.effectTag |= PerformedWork;
  if (current !== null && didCaptureError) {
    //如果我们正在从错误中恢复，请在不重用任何现有子级的情况下进行协调。从概念上讲，正常子级和错误显示的子级是两个不同的集合，因此即使它们的身份匹配，我们也不应该重用正常子级。
    // If we're recovering from an error, reconcile without reusing any of
    // the existing children. Conceptually, the normal children and the children
    // that are shown on error are two different sets, so we shouldn't reuse
    // normal children even if their identities match.
    forceUnmountCurrentAndReconcile(
      current,
      workInProgress,
      nextChildren,
      renderExpirationTime,
    );
  } else {
    reconcileChildren(
      current,
      workInProgress,
      nextChildren,
      renderExpirationTime,
    );
  }

  //使用我们刚才用来呈现的值记录状态。
  //TODO:重新构造，这样我们就永远不会从实例中读取值。

  // Memoize state using the values we just used to render.
  // TODO: Restructure so we never read values from the instance.
  workInProgress.memoizedState = instance.state;

  //上下文可能已更改，因此我们需要重新计算它。
  // The context might have changed so we need to recalculate it.
  if (hasContext) {
    invalidateContextProvider(workInProgress, Component, true);
  }

  return workInProgress.child;
}
```
### `bailoutOnAlreadyFinishedWork`函数
* 因为当前组件不需要更新，所以略过，但是需要对该组件的子组件进行判定是否需要更新
```javascript
function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderExpirationTime: ExpirationTime,
): Fiber | null {
  cancelWorkTimer(workInProgress); // 可以忽略

  if (current !== null) {
    //重用以前的依赖项 event事件和context等
    // Reuse previous dependencies
    workInProgress.dependencies = current.dependencies;
  }

  const updateExpirationTime = workInProgress.expirationTime;
  if (updateExpirationTime !== NoWork) {
    // if (expirationTime > workInProgressRootNextUnprocessedUpdateTime) {
    //     workInProgressRootNextUnprocessedUpdateTime = expirationTime;
    //   }
 
    // 标记下一个未执行的任务的过期时间为忽略调更新时间，在该过期时间可能会发生更新
    markUnprocessedUpdateTime(updateExpirationTime);
  }

  //检查孩子们是否有任何未完成的工作。
  // Check if the children have any pending work.
  const childExpirationTime = workInProgress.childExpirationTime;
  if (childExpirationTime < renderExpirationTime) {
    //孩子们也没有工作。我们可以跳过它们。
    //待办事项：添加“恢复”后，应检查子项是否为“正在工作”集。如果是的话，我们需要转移他们的影响。
    // The children don't have any work either. We can skip them.
    // TODO: Once we add back resuming, we should check if the children are
    // a work-in-progress set. If so, we need to transfer their effects.
    return null;
  } else {
    //当前Fiber不起作用，但它的子树起作用。克隆子fiber并继续。
    // This fiber doesn't have work, but its subtree does. Clone the child
    // fibers and continue.
    cloneChildFibers(current, workInProgress);
    return workInProgress.child;
  }
}
```

### `cloneChildFibers`函数
* 克隆当前fiber对象的子fiber对象以及子fiber对象的兄弟Fiber对象
```javascript
function cloneChildFibers(
  current: Fiber | null,
  workInProgress: Fiber,
): void {
  invariant(
    current === null || workInProgress.child === current.child,
    'Resuming work not yet implemented.',
  );

  if (workInProgress.child === null) {
    return;
  }

  let currentChild = workInProgress.child;
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  workInProgress.child = newChild;

  newChild.return = workInProgress;
  // 这里是克隆当前fiber的所有兄弟节点
  // 当兄弟节点不为null的时候创建一个备用的兄弟节点的workInProgress
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps,
    );
    newChild.return = workInProgress;
  }
  newChild.sibling = null;
}
```
