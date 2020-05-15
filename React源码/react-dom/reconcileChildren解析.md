# reconcileChildren解析

## `reconcileChildren` 函数`newChildren` 参数
```javascript
{
    $$typeof: Symbol(react.element),
    key: null,
    props: {children: ""},
    ref: null,
    type: function App(),
    _owner: null,
    _store: {validated: false},
}
```
## `reconcileChildren`源码
> `reconcileChildren`源码是在执行`renderRootSync`的时候调用`updateHostRoot`函数时候调用的，`renderRootSync`源码和`updateHostRoot`源码[参考文档](./renderRootSync解析.md)
```javascript
/**
* 这是updateHostRoot调用的时候的参数
* reconcileChildren(
*      current,
*      workInProgress,
*      nextChildren,
*      renderExpirationTime,
*    );
*/
export function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any, //
  renderExpirationTime: ExpirationTime,
) {
  if (current === null) {
    // 第一次调用React-Dom.render的时候不会走这里
    //如果这是一个尚未呈现的新组件，
    // 我们不会通过应用最小的副作用来更新其子集。
    // 相反，我们将在子对象被呈现之前将它们全部添加到子对象中。这意味着我们可以通过不跟踪副作用来优化这个调节过程。
    // If this is a fresh new component that hasn't been rendered yet, we
    // won't update its child set by applying minimal side-effects. Instead,
    // we will add them all to the child before it gets rendered. That means
    // we can optimize this reconciliation pass by not tracking side-effects.
    workInProgress.child = mountChildFibers(
      workInProgress,
      null,
      nextChildren,
      renderExpirationTime,
    );
  } else {
    //如果current child 与workInProgress相同，则意味着我们尚未开始任何有关这些孩子的工作。因此，我们使用克隆算法创建所有当前子级的副本。
    //如果我们已经有了任何进展，那在这一点上是无效的，所以让我们扔掉它。
    // If the current child is the same as the work in progress, it means that
    // we haven't yet started any work on these children. Therefore, we use
    // the clone algorithm to create a copy of all the current children.

    // If we had any progressed work already, that is invalid at this point so
    // let's throw it out.
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child, // 第一次render的时候current是初始值 null
      nextChildren, // Root的React$Element
      renderExpirationTime,
    );
  }
}
```

## `reconcileChildFibers`源码分析
* `reconcileChildFibers`函数就是通过`ChildReconciler(true)`返回的一个函数，所以接下来直接看`ChildReconciler`源码
```javascript
const reconcileChildFibers = ChildReconciler(true);

function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null, // 上面调用的时候是null
    newChild: any,
    expirationTime: ExpirationTime,
  ): Fiber | null {
    //此函数不是递归的。
    //如果顶级项是数组，我们将其视为一组子项，而不是片段。另一方面，嵌套数组将被视为片段节点。递归发生在正常流。
    //像处理数组一样处理顶层的未知碎片。
    //这会导致<>{[…]}</>和<>…</>之间的歧义。
    //我们对上述模棱两可的情况一视同仁。
    // This function is not recursive.
    // If the top level item is an array, we treat it as a set of children,
    // not as a fragment. Nested arrays on the other hand will be treated as
    // fragment nodes. Recursion happens at the normal flow.
    // Handle top level unkeyed fragments as if they were arrays.
    // This leads to an ambiguity between <>{[...]}</> and <>...</>.
    // We treat the ambiguous cases above the same.
    const isUnkeyedTopLevelFragment =
      typeof newChild === 'object' &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null;
    // 如果是Fragment组件 则直接返回该组件的props.children
    // <React.Fragment>
    //       <ChildA />
    //       <ChildB />
    //       <ChildC />
    //     </React.Fragment>
    if (isUnkeyedTopLevelFragment) {
      newChild = newChild.props.children;
    }

    //处理对象类型
    // Handle object types
    const isObject = typeof newChild === 'object' && newChild !== null;

    // newChild类型是object的话证明child只有一个 所以调用reconcileSingleElement
    if (isObject) {
      // 第一次render会走这里 且newChild.$$typeof等于 Symbol(react.element) 也就是 REACT_ELEMENT_TYPE，走下面第一个case
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(
              returnFiber,
              currentFirstChild,
              newChild,
              expirationTime,
            ),
          );
          //createPortal创建的组件 Portal 提供了一种将子节点渲染到存在于父组件以外的 DOM 节点的优秀的方案。
        case REACT_PORTAL_TYPE:
          return placeSingleChild(
            reconcileSinglePortal(
              returnFiber,
              currentFirstChild,
              newChild,
              expirationTime,
            ),
          );
      }
    }

    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(
          returnFiber,
          currentFirstChild,
          '' + newChild,
          expirationTime,
        ),
      );
    }

    if (isArray(newChild)) {
      return reconcileChildrenArray(
        returnFiber,
        currentFirstChild,
        newChild,
        expirationTime,
      );
    }

    if (getIteratorFn(newChild)) {
      return reconcileChildrenIterator(
        returnFiber,
        currentFirstChild,
        newChild,
        expirationTime,
      );
    }

    if (isObject) {
      throwOnInvalidObjectType(returnFiber, newChild);
    }

    //其余例子均视为空。
    // Remaining cases are all treated as empty.
    return deleteRemainingChildren(returnFiber, currentFirstChild);
  }
```

## `reconcileSingleElement`函数

* 源码
```javascript
function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null, // null
    element: ReactElement, // <App>
    expirationTime: ExpirationTime,
  ): Fiber {
    const key = element.key;
    let child = currentFirstChild; // 第一次render的时候是null，所以不会走下面while循环
    while (child !== null) {
      //TODO:如果key==null和child.key==null，则这仅适用于列表中的第一个项。
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        switch (child.tag) {
          case Fragment: {
            if (element.type === REACT_FRAGMENT_TYPE) {
              deleteRemainingChildren(returnFiber, child.sibling);
              const existing = useFiber(child, element.props.children);
              existing.return = returnFiber;
              return existing;
            }
            break;
          }
          case Block:
            if (enableBlocksAPI) {
              if (element.type.$$typeof === REACT_BLOCK_TYPE) {
                // The new Block might not be initialized yet. We need to initialize
                // it in case initializing it turns out it would match.
                initializeBlockComponentType(element.type);
                if (
                  (element.type: BlockComponent<any, any, any>)._fn ===
                  (child.type: BlockComponent<any, any, any>)._fn
                ) {
                  deleteRemainingChildren(returnFiber, child.sibling);
                  const existing = useFiber(child, element.props);
                  existing.type = element.type;
                  existing.return = returnFiber;
                  if (__DEV__) {
                    existing._debugSource = element._source;
                    existing._debugOwner = element._owner;
                  }
                  return existing;
                }
              }
            }
          // We intentionally fallthrough here if enableBlocksAPI is not on.
          // eslint-disable-next-lined no-fallthrough
          default: {
            if (
              child.elementType === element.type ||
              // Keep this check inline so it only runs on the false path:
              (__DEV__
                ? isCompatibleFamilyForHotReloading(child, element)
                : false)
            ) {
              deleteRemainingChildren(returnFiber, child.sibling);
              const existing = useFiber(child, element.props);
              existing.ref = coerceRef(returnFiber, child, element);
              existing.return = returnFiber;
              if (__DEV__) {
                existing._debugSource = element._source;
                existing._debugOwner = element._owner;
              }
              return existing;
            }
            break;
          }
        }
        // Didn't match.
        deleteRemainingChildren(returnFiber, child);
        break;
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    if (element.type === REACT_FRAGMENT_TYPE) {
      const created = createFiberFromFragment(
        element.props.children,
        returnFiber.mode,
        expirationTime,
        element.key,
      );
      created.return = returnFiber;
      return created;
    } else {
      // 第一次render会走这里
      // 创建一个与ReactElement相对于应的fiber且将该fiber与父fiber相关联
      const created = createFiberFromElement(
        element,
        returnFiber.mode, // 当前版本HostRootFiber的mode为NoMode
        expirationTime,
      );
      // 创建ref设置到新创建的fiber上
      created.ref = coerceRef(returnFiber, currentFirstChild, element);
      created.return = returnFiber;
      return created;
    }
  }
```

### `createFiberFromElement`函数
* `createFiberFromElement`函数逻辑很简单 创建了一个`fiber`，然后返回该`fiber`对象， `fiber`对象[参考文档](../Fiber/Fiber对象解读.md)

* `reconcileSingleElement` 函数参数
    - `element` 
        ```javascript
        {
            $$typeof: Symbol(react.element),
            key: null,
            props: {children: ""},
            ref: null,
            type: function App(),
            _owner: null,
            _store: {validated: false},
        }
        ```
    - mode NoWork
    - expirationTime
    
* 源码分析
```javascript
function createFiberFromElement(
  element: ReactElement, // <App>
  mode: TypeOfMode, // 当前版本HostRootFiber的mode为NoMode
  expirationTime: ExpirationTime,
): Fiber {
  let owner = null;
  const type = element.type;
  const key = element.key;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(
    type, // function App () {...}
    key,
    pendingProps, // { children: null }
    owner, // null
    mode, // NoMode
    expirationTime,
  );
  return fiber;
}
```
#### `createFiberFromTypeAndProps`函数
* 形参
    - type：function App () {...}
    - pendingProps： { children: null }
```javascript
function createFiberFromTypeAndProps(
  type: any, // function App () {...}
  key: null | string,
  pendingProps: any,
  owner: null | Fiber,
  mode: TypeOfMode, // 当前版本HostRootFiber的mode为NoMode
  expirationTime: ExpirationTime,
): Fiber {
  let fiber;

  let fiberTag = IndeterminateComponent;
  // The resolved type is set if we know what the final type will be. I.e. it's not lazy.
  //如果我们知道最终类型将是什么，则设置解析类型。一、 它不懒。
  let resolvedType = type;
  if (typeof type === 'function') {
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent;
    } else {
    }
  } else if (typeof type === 'string') {
    fiberTag = HostComponent;
  } else {
    getTag: switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(
          pendingProps.children,
          mode,
          expirationTime,
          key,
        );
      case REACT_CONCURRENT_MODE_TYPE:
        fiberTag = Mode;
        mode |= ConcurrentMode | BlockingMode | StrictMode;
        break;
      case REACT_STRICT_MODE_TYPE:
        fiberTag = Mode;
        mode |= StrictMode;
        break;
      case REACT_PROFILER_TYPE:
        return createFiberFromProfiler(pendingProps, mode, expirationTime, key);
      case REACT_SUSPENSE_TYPE:
        return createFiberFromSuspense(pendingProps, mode, expirationTime, key);
      case REACT_SUSPENSE_LIST_TYPE:
        return createFiberFromSuspenseList(
          pendingProps,
          mode,
          expirationTime,
          key,
        );
      default: {
        if (typeof type === 'object' && type !== null) {
          switch (type.$$typeof) {
            case REACT_PROVIDER_TYPE:
              fiberTag = ContextProvider;
              break getTag;
            case REACT_CONTEXT_TYPE:
              // This is a consumer
              fiberTag = ContextConsumer;
              break getTag;
            case REACT_FORWARD_REF_TYPE:
              fiberTag = ForwardRef;
              break getTag;
            case REACT_MEMO_TYPE:
              fiberTag = MemoComponent;
              break getTag;
            case REACT_LAZY_TYPE:
              fiberTag = LazyComponent;
              resolvedType = null;
              break getTag;
            case REACT_BLOCK_TYPE:
              fiberTag = Block;
              break getTag;
            case REACT_FUNDAMENTAL_TYPE:
              if (enableFundamentalAPI) {
                return createFiberFromFundamental(
                  type,
                  pendingProps,
                  mode,
                  expirationTime,
                  key,
                );
              }
              break;
            case REACT_SCOPE_TYPE:
              if (enableScopeAPI) {
                return createFiberFromScope(
                  type,
                  pendingProps,
                  mode,
                  expirationTime,
                  key,
                );
              }
          }
        }
        let info = '';
      }
    }
  }

  fiber = createFiber(fiberTag, pendingProps, key, mode);
  fiber.elementType = type;
  fiber.type = resolvedType;
  fiber.expirationTime = expirationTime;

  return fiber;
}
```

## `placeSingleChild`函数

* 源码
```javascript
function placeSingleChild(newFiber: Fiber): Fiber {
    //对于独生子女来说，这更简单。我们只需要做一个插入新孩子的位置。
    // This is simpler for the single child case. We only need to do a
    // placement for inserting new children.
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.effectTag = Placement;
    }
    return newFiber;
  }
```
