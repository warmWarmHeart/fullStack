# `updateHostComponent`相关代码解析

## updateHostComponent

* `render`第一次执行`beginWork`的时候，`workInProgress.tag` 等于 `HostRoot`, 所以我们先看 `updateHostRoot`源码

## 源码
```javascript
function updateHostComponent(current, workInProgress, renderExpirationTime) {
  pushHostContext(workInProgress);

  if (current === null) {
      // 因为isHydrating === false，所以忽略
    tryToClaimNextHydratableInstance(workInProgress);
  }

  const type = workInProgress.type;
  const nextProps = workInProgress.pendingProps;
  const prevProps = current !== null ? current.memoizedProps : null;

  let nextChildren = nextProps.children;
   // 判断nextProps.children的类型是不是数字number或者字符串string
  const isDirectTextChild = shouldSetTextContent(type, nextProps);

   // 如果children类型是最终的字符串或者数字isDirectTextChild 为true
  if (isDirectTextChild) {
      //我们特例主机节点的直接文本子节点。这是很常见的 案例。我们不会把它当作一个具体化的孩子来处理。我们会处理的这在主机环境中也可以访问此道具。这样可以避免分配另一个HostText光纤并遍历它。
    // We special case a direct text child of a host node. This is a common
    // case. We won't handle it as a reified child. We will instead handle
    // this in the host environment that also has access to this prop. That
    // avoids allocating another HostText fiber and traversing it.
    nextChildren = null;
  } else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
    // If we're switching from a direct text child to a normal child, or to
    // empty, we need to schedule the text content to be reset.
    workInProgress.effectTag |= ContentReset;
  }

  markRef(current, workInProgress);

  //检查主机配置以查看子项是否处于屏幕外/隐藏状态。
  // Check the host config to see if the children are offscreen/hidden.
  if (
    workInProgress.mode & ConcurrentMode &&
    renderExpirationTime !== Never &&
    shouldDeprioritizeSubtree(type, nextProps)
  ) {
      //安排此光纤以屏幕外优先级重新渲染。然后bailout。
     
    // Schedule this fiber to re-render at offscreen priority. Then bailout.
    workInProgress.expirationTime = workInProgress.childExpirationTime = Never;
    return null;
  }

    // workInProgress.expirationTime === workInProgress.childExpirationTime === 0
  reconcileChildren(
    current,
    workInProgress,
    nextChildren,
    renderExpirationTime,
  );
  return workInProgress.child;
}
```

### `pushHostContext`
* 在当前`fiber`对象的新旧context不等的情况下降`fiber`和`fiber.context`保存到游标上
    - 将`contextFiberStackCursor.current` 设置成 `fiber`
    - 将`contextStackCursor.current` 设置成 `fiber.context`

* 下面是相关设置以上指标所涉及的源码：

```javascript
function pushHostContext(fiber: Fiber): void {
    // 判定 c !== NO_CONTEXT是否是true
  const rootInstance: Container = requiredContext(
    rootInstanceStackCursor.current,
  );
  const context: HostContext = requiredContext(contextStackCursor.current);
  const nextContext = getChildHostContext(context, fiber.type, rootInstance);
    //除非它是独一无二的，否则不要推这个光纤的上下文。
  // Don't push this Fiber's context unless it's unique.
  if (context === nextContext) {
    return;
  }
    //跟踪上下文和提供它的光纤。
    //这使我们能够只弹出提供独特上下文的光纤。
  // Track the context and the Fiber that provided it.
  // This enables us to pop only Fibers that provide unique contexts.
  push(contextFiberStackCursor, fiber, fiber);
  push(contextStackCursor, nextContext, fiber);
}
```
#### push
* 将`cursor.current`的旧值保存到`valueStack`栈中
* 给`cursor.current`赋新值`value`
```javascript
function push<T>(cursor: StackCursor<T>, value: T, fiber: Fiber): void {
  index++;
  valueStack[index] = cursor.current;
  // 此处重点, cursor.current执行的地址发生了变化, 原来指向的地址被压到valueStack栈中了
  cursor.current = value;
}
```

### `reconcileChildren` 
* [参考文档](./reconcileChildren解析.md)
