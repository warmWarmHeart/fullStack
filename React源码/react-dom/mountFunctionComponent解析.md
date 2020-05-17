# 函数组件的创建和绑定

## `updateFunctionComponent`函数
* `prepareToReadContext`可以[参考文档](mountClassComponent阶段解析.md)中相关介绍
    - 将`currentlyRenderingFiber`设为当前执行的`Fiber`对象
    - `Fiber.dependencies`放着当前fiber的事件和context对象
    - 将`didReceiveUpdate`变量设置为true（`markWorkInProgressReceivedUpdate`函数执行后）
* 调用`renderWithHooks`创建带有hooks的函数组件。这时候因为是函数组件，所以组件是利用`Component(props, context)`创建出来的
* 根据`didReceiveUpdate`判断是否要忽略当前组件，然后通过`childExpirationTime`查看当前组件的子组件是否更新
    - `bailoutOnAlreadyFinishedWork`可以[参考文档](mountClassComponent阶段解析.md)中相关介绍
* 调用`reconcileChildren`为`workInProgress`创建一个子`Fiber`，指向其`child`属性
   > `reconcileChildren`源码是在执行`renderRootSync`的时候调用`updateHostRoot`函数时候调用的，`renderRootSync`源码和`updateHostRoot`源码[参考文档](./renderRootSync解析.md)
    - [参考文档](./reconcileChildren解析.md)
* 源码
```javascript
function updateFunctionComponent(
  current,
  workInProgress,
  Component,
  nextProps: any,
  renderExpirationTime,
) {
  let context;
  if (!disableLegacyContext) {
    const unmaskedContext = getUnmaskedContext(workInProgress, Component, true);
    context = getMaskedContext(workInProgress, unmaskedContext);
  }

  let nextChildren;
  prepareToReadContext(workInProgress, renderExpirationTime);
  nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    context,
    renderExpirationTime,
  );

  if (current !== null && !didReceiveUpdate) {
    bailoutHooks(current, workInProgress, renderExpirationTime);
    return bailoutOnAlreadyFinishedWork(
      current,
      workInProgress,
      renderExpirationTime,
    );
  }

  // React DevTools reads this flag.
  workInProgress.effectTag |= PerformedWork;
  reconcileChildren(
    current,
    workInProgress,
    nextChildren,
    renderExpirationTime,
  );
  return workInProgress.child;
}
```

## `renderWithHooks`函数
* 初始化Fiber对象`workInProgress`的相关属性：
    - memoizedState：null
    - updateQueue：null
    - expirationTime：NoWork
* 将`ReactCurrentDispatcher.current`设置为如下两种：
    - **HooksDispatcherOnMount**：函数组件第一次刚创建的时候会调用`HooksDispatcherOnMount`相关`hook`，如：`useState`、`useEffect` 等。这些hooks可以查看[官方文档](https://react.docschina.org/docs/hooks-intro.html)
    - **HooksDispatcherOnUpdate**: 函数组件会在更新操作的时候将大部分`hooks`钩子方法重置成`HooksDispatcherOnUpdate`相对应的方法
* 调用函数组件对应的函数创建对应的React组件实例，如下函数组件的构造函数`SelfComp`,会如此调用：`SelfComp(props, )`,最后返回`<div>hello， 你好</div>`就是对应的函数组件实例，它是`jsx`的一种写法，实际上相当于用`react`的`createElement`生成了一个虚拟`dom`对象（一个用来描述 想要渲染的真实 Dom的一个对象）
    ```javascript
    function SelfComp(){
      return <div>hello， 你好</div>
      }
    ```
* 检查是否有渲染阶段更新，渲染阶段的更新就是在调用`Component(props, secondArg)`实例化组件的时候又一次或者多次调用`setState`之类的操作，直到`workInProgress`的`expirationTime`不等于`renderExpirationTime`，也就是直到所有的`setState`之类的操作调用完毕
* 将`ReactCurrentDispatcher.current`设置为`ContextOnlyDispatcher`，作用是：阻止除了函数组件构造函数之外的其他场景调用`Hooks`相关钩子
* 初始化一些全局变量：
    - renderExpirationTime： NoWork;
    - currentlyRenderingFiber： (null: any);
    - currentHook： null;
    - workInProgressHook： null;
    - didScheduleRenderPhaseUpdate： false;
* 将上面得到的`fiber`对象赋值给`workInProgress`，然后继续执行[`workLoopSync`函数](renderRootSync解析.md)里的循环部分：对[`performUnitOfWork`函数](performUnitOfWork函数.md)的执行,


* 源码    
```javascript
function renderWithHooks<Props, SecondArg>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props, arg: SecondArg) => any,
  props: Props,
  secondArg: SecondArg,
  nextRenderExpirationTime: ExpirationTime,
): any {
  renderExpirationTime = nextRenderExpirationTime;
  currentlyRenderingFiber = workInProgress;

  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.expirationTime = NoWork;

  //如果在装载过程中根本没有使用钩子，则在更新过程中使用一些钩子。
  //当前，我们将把更新呈现标识为装载，因为memoizedState===null。
  //这很棘手，因为它对某些类型的组件有效（例如React.lazy）
  // TODO Warn if no hooks are used at all during mount, then some are used during update.
  // Currently we will identify the update render as a mount because memoizedState === null.
  // This is tricky because it's valid for certain types of components (e.g. React.lazy)

  //使用memoizedState区分mount/update只有在至少使用一个有状态钩子时才有效。
  //非状态挂钩（例如上下文）不会添加到memoizedState，因此memoizedState在更新和装载期间将为空。
  // Using memoizedState to differentiate between mount/update only works if at least one stateful hook is used.
  // Non-stateful hooks (e.g. context) don't get added to memoizedState,
  // so memoizedState would be null during updates and mounts.
  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null // 初始化渲染这里是null 所以ReactCurrentDispatcher.current = HooksDispatcherOnMount
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;

  let children = Component(props, secondArg);

  //检查是否有渲染阶段更新
  // Check if there was a render phase update
  if (workInProgress.expirationTime === renderExpirationTime) { 
    // 初始化渲染这里expirationTime是初始化的NoWork 所以不等于renderExpirationTime
    //只要继续计划渲染阶段更新，就保持循环渲染。使用计数器防止无限循环。
    // Keep rendering in a loop for as long as render phase updates continue to
    // be scheduled. Use a counter to prevent infinite loops.
    let numberOfReRenders: number = 0;
    do {
      workInProgress.expirationTime = NoWork;

      invariant(
        numberOfReRenders < RE_RENDER_LIMIT, // 最大25
        'Too many re-renders. React limits the number of renders to prevent ' +
          'an infinite loop.',
      );

      numberOfReRenders += 1;
      
      //从列表的开头重新开始
      // Start over from the beginning of the list
      currentHook = null;
      workInProgressHook = null;

      workInProgress.updateQueue = null;

      ReactCurrentDispatcher.current = __DEV__
        ? HooksDispatcherOnRerenderInDEV
        : HooksDispatcherOnRerender;

      children = Component(props, secondArg);
    } while (workInProgress.expirationTime === renderExpirationTime);
  }
  //我们可以假设上一个分派器始终是这个分派器，因为我们在呈现阶段的开始设置它，并且没有重新进入。pushDispatcher(root)
  // We can assume the previous dispatcher is always this one, since we set it
  // at the beginning of the render phase and there's no re-entrancy.
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;

  //此检查使用currentHook，因此它在DEV和prod包中的工作方式相同。hookTypesDev可以捕获更多的案例（例如上下文），但只能在DEV包中捕获。
  // This check uses currentHook so that it works the same in DEV and prod bundles.
  // hookTypesDev could catch more cases (e.g. context) but only in DEV bundles.
  // 提供的钩子太少
  const didRenderTooFewHooks =
    currentHook !== null && currentHook.next !== null;

  renderExpirationTime = NoWork;
  currentlyRenderingFiber = (null: any);

  currentHook = null;
  workInProgressHook = null;

  didScheduleRenderPhaseUpdate = false;

  invariant(
    !didRenderTooFewHooks, // 提供的钩子太少
    // 呈现的钩子比预期的少。这可能是由意外的提前返回语句引起的。
    'Rendered fewer hooks than expected. This may be caused by an accidental ' +
      'early return statement.',
  );

  return children;
}
```
