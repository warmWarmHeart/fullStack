# mountClassComponent解析

## `updateClassComponent`
* 1 准备类组件上下文`context`相关内容
* 2 根据类组件的`Fiber.stateNode`和`workInProgress.type`构造一个实例

```javascript
function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps,
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

  const instance = workInProgress.stateNode;
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
    //在简历中，我们已经有了一个可以重用的实例。
    // In a resume, we'll already have an instance we can reuse.
    // 这里会执行willMount和didMount生命函数
    shouldUpdate = resumeMountClassInstance(
      workInProgress,
      Component,
      nextProps,
      renderExpirationTime,
    );
  } else {
    // ComponentWillReceiveProps、componentDidUpdate、getSnapshotBeforeUpdate
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
    //缓存未屏蔽的上下文，以便我们可以避免重新创建屏蔽的上下文，除非有必要。
    //ReactFiberContext通常更新此缓存，但不能用于新创建的实例。
  // Cache unmasked context so we can avoid recreating masked context unless necessary.
  // ReactFiberContext usually updates this cache but can't for newly-created instances.
  if (isLegacyContextConsumer) {
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
* 指定 `<App />`组件实例的`updater`属性
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
