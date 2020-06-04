# reconcileChildren解析

## `reconcileChildren` 函数
* `mount`阶段为传入的所有**直接**子元素分配`Fiber`
* `update`阶段根据旧 `Fiber` 的下标 `index`、`key` 等属性进行更新、删除操作
* 将所有`fiber`用`sibling`属性和`return`属性连接起来
    - `sibling`属性指向兄弟Fiber节点
    - `return`指向父Fiber节点
* 最后返回 第一个Fiber对象，作为父`Fiber`对象的`child`属性值
### `newChildren` 参数
* 如果是一个ReactElement，则会使类似如下一个对象：
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
* 如果是一个对象，代表有多个`child`：则会是如下参数
    ```javascript
      [
          0: "hello"
          1: {$$typeof: Symbol(react.element), type: "span", key: null, ref: null, props: {…}, …}
          2: {$$typeof: Symbol(react.element), key: null, ref: null, props: {…}, type: ƒ, …}
          3: {$$typeof: Symbol(react.element), key: null, ref: null, props: {…}, type: ƒ, …}
          4: {$$typeof: Symbol(react.element), key: null, ref: null, props: {…}, type: ƒ, …}
      ]
    ```
* 如果是数字`number`类型或者`string`字符串类型，则证明`this.props.children`是文字类型

## `reconcileChildren`源码
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
    // 通过reconcileChildFibers为workInProgress创建一个子Fiber，指向其child属性
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child, // 第一次render的时候current是初始值 null
      nextChildren, // Root的React$Element
      renderExpirationTime,
    );
  }
}
```
### mountChildFibers
```javascript
const mountChildFibers = ChildReconciler(true)

```
### `reconcileChildFibers`源码分析
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


### `placeSingleChild`函数

* `placeSingleChild`函数的形参是一个新`Fiber`,`placeSingleChild`函数就是加工下该`Fiber`,为其effectTag 赋值`Placement`

* 源码
```javascript
function placeSingleChild(newFiber: Fiber): Fiber {
    //对于独生子女来说，这更简单。我们只需要做一个插入新孩子的位置。
    // This is simpler for the single child case. We only need to do a
    // placement for inserting new children.
    // shouldTrackSideEffects 参数 等于 true，newFiber是新创建出来的fiber 所以alternate属性等于null，因此会进行下面赋值
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.effectTag = Placement;
    }
    return newFiber;
  }
```


### `reconcileSingleElement`函数

* 源码
```javascript
function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null, // 第一次为null
    element: ReactElement, // <App>
    expirationTime: ExpirationTime,
  ): Fiber {
    const key = element.key; // 第一次为null
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

#### `createFiberFromElement`函数
* `createFiberFromElement`函数逻辑很简单 创建了一个`fiber`，然后返回该`fiber`对象， `fiber`对象[参考文档](../Fiber/Fiber对象解读.md)
* 上面创建的`fiber`对象包含了通过 reactElement.render 返回来的 `props.children`: 一个包含普通html元素、react元素、文本元素的集合
* `reconcileSingleElement` 函数参数
    - `element` 
        ```javascript
        {
            $$typeof: Symbol(react.element),
            key: null,
            props: {children: [
                0: "hello"
                1: {$$typeof: Symbol(react.element), type: "span", key: null, ref: null, props: {…}, …}
                2: {$$typeof: Symbol(react.element), key: null, ref: null, props: {…}, type: ƒ, …}
                3: {$$typeof: Symbol(react.element), key: null, ref: null, props: {…}, type: ƒ, …}
                4: {$$typeof: Symbol(react.element), key: null, ref: null, props: {…}, type: ƒ, …}
            ]},
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
    pendingProps, // { children: [....] }
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
    - pendingProps： { children: [] }
* 根据传进来的`type`先生成一个fiber的tag
* 创建一个fiber return出去
```javascript
function createFiberFromTypeAndProps(
  type: any, // function App () {...}
  key: null | string,
  pendingProps: any, // { children: null }
  owner: null | Fiber, // null
  mode: TypeOfMode, // 当前版本HostRootFiber的mode为NoMode
  expirationTime: ExpirationTime,
): Fiber {
  let fiber;
    // Before we know whether it is function or class //在我们知道它是函数还是类之前
  let fiberTag = IndeterminateComponent;
  // The resolved type is set if we know what the final type will be. I.e. it's not lazy.
  //如果我们知道最终类型将是什么，则设置解析类型。一、 它不懒。
  let resolvedType = type;
  if (typeof type === 'function') {
    // Component.prototype.isReactComponent = {};
    // 如果是类组件，继承自Component的属性isReactComponent
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent;
    } else {
    }
  } else if (typeof type === 'string') {
      // 这里就是寻常的html标签 如： div、li等等
    fiberTag = HostComponent;
  } else {
      // 根据type 获取不同 fiber tag
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
  // pendingProps: {children: ['div', ReactElement1,ReactElement2, ...]}
  fiber = createFiber(fiberTag, pendingProps, key, mode);
  fiber.elementType = type;
  fiber.type = resolvedType; // 如果类型是REACT_LAZY_TYPE则会 设置为null
  fiber.expirationTime = expirationTime;

  return fiber;
}
```


#### `coerceRef`函数

```javascript
// 当 ref 定义为 string 时，需要 React 追踪当前正在渲染的组件，在 reconciliation 阶段，React Element 创建和更新的过程中，ref 会被封装为一个闭包函数，
// 等待 commit 阶段被执行，这会对 React 的性能产生一些影响。
// 当使用 render callback 模式时，使用 string ref 会造成 ref 挂载位置产生歧义。
// string ref 无法被组合，例如一个第三方库的父组件已经给子组件传递了 ref，那么我们就无法再在子组件上添加 ref 了，而 callback ref 可完美解决此问题。
// 对于静态类型较不友好，当使用 string ref 时，必须显式声明 refs 的类型，无法完成自动推导。
// 编译器无法将 string ref 与其 refs 上对应的属性进行混淆，而使用 callback ref，可被混淆
// 强制引用
// 检查ref是否合法转换string ref
function coerceRef(
  returnFiber: Fiber,
  current: Fiber | null,
  element: ReactElement,
) {
  let mixedRef = element.ref;
  if (
    mixedRef !== null &&
    typeof mixedRef !== 'function' &&
    typeof mixedRef !== 'object'
  ) {
    if (element._owner) {
      const owner: ?Fiber = (element._owner: any);
      let inst;
     
      const stringRef = '' + mixedRef;
      //检查前一个字符串引用是否与新字符串引用匹配
      // Check if previous string ref matches new string ref
      if (
        current !== null &&
        current.ref !== null &&
        typeof current.ref === 'function' &&
        current.ref._stringRef === stringRef
      ) {
        return current.ref;
      }
      const ref = function(value) {
        let refs = inst.refs;
        if (refs === emptyRefsObject) {
          //这是一个延迟池冻结对象，因此需要初始化。
          // This is a lazy pooled frozen object, so we need to initialize.
          refs = inst.refs = {};
        }
        if (value === null) {
          delete refs[stringRef];
        } else {
          refs[stringRef] = value;
        }
      };
      ref._stringRef = stringRef;
      return ref;
    } else {
     
    }
  }
  return mixedRef;
}
```

### reconcileChildrenArray
* 当外界传给`reconcileChildren`的`nextChildren`类型是`Array`的时候调用此函数
    > 当某些组件的render出来的children所对应的fiber中有多个child的时候会触发此函数如：
        ```
        // 下面代码所代表的fiber  会触发此函数
        <div>
            hello
            <SelfComponent>
        </div>
        ```
* 如果是初次渲染则为`nextChildren`每个元素都分配一个`fiber`对象
* 否则按照新旧Fiber对象的key、index等属性进行更新Fiber操作

```javascript
function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<*>,
    expirationTime: ExpirationTime,
  ): Fiber | null {
    //这个算法不能通过从两端搜索来优化，因为
    //光纤上没有反向指针。我想看看我们能走多远
    //用那个模型。如果最终不值得权衡，我们可以
    //以后再加。
    //即使是双端优化，我们也希望对这个案例进行优化
    //只有很少的变化和残酷的比较而不是
    //去拿地图。我想先探索一下这条路
    //只前进模式，只有当我们注意到我们需要
    //展望未来。这不能像两个结束时那样处理反转
    //但这不寻常。另外，对于双端优化
    //我们需要复制整套。
    //在第一次迭代中，我们将只处理坏情况
    //（将所有内容添加到地图中）用于每次插入/移动。
    //如果更改此代码，还应更新reconcileChildrenIterator（），其中
    //使用相同的算法。
    // This algorithm can't optimize by searching from both ends since we
    // don't have backpointers on fibers. I'm trying to see how far we can get
    // with that model. If it ends up not being worth the tradeoffs, we can
    // add it later.
    // Even with a two ended optimization, we'd want to optimize for the case
    // where there are few changes and brute force the comparison instead of
    // going for the Map. It'd like to explore hitting that path first in
    // forward-only mode and only go for the Map once we notice that we need
    // lots of look ahead. This doesn't handle reversal as well as two ended
    // search but that's unusual. Besides, for the two ended optimization to
    // work on Iterables, we'd need to copy the whole set.
    // In this first iteration, we'll just live with hitting the bad case
    // (adding everything to a Map) in for every insert/move.
    // If you change this code, also update reconcileChildrenIterator() which
    // uses the same algorithm.

    let resultingFirstChild: Fiber | null = null;
    let previousNewFiber: Fiber | null = null;

    let oldFiber = currentFirstChild; // 初次渲染为null
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;
    // 初次渲染oldFiber为null 所以不会走下列循环
    // 更新阶段oldFiber不为null
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
        // 如果旧的第一个Fiber的下标大于newIdx，证明旧Fiber并不是当前`newChildren`集合的第一个fiber
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber;
        oldFiber = null; // 在循环末尾会将nextOldFiber又赋值给oldFiber
      } else {
        nextOldFiber = oldFiber.sibling;
      }
      // 更新每个子Fiber
      const newFiber = updateSlot(
        returnFiber,
        oldFiber,
        newChildren[newIdx],
        expirationTime,
      );
      if (newFiber === null) {
        // TODO: This breaks on empty slots like null children. That's
        // unfortunate because it triggers the slow path all the time. We need
        // a better way to communicate whether this was a miss or null,
        // boolean, undefined, etc.
        if (oldFiber === null) {
          oldFiber = nextOldFiber;
        }
        break;
      }
      // 初始渲染的时候shouldTrackSideEffects为false
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          // We matched the slot, but we didn't reuse the existing fiber, so we
          // need to delete the existing child.
          deleteChild(returnFiber, oldFiber);
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
       // 将兄弟节点之间用sibling属性连接起来
        previousNewFiber.sibling = newFiber;
      }
      // 将兄弟节点之间用sibling属性连接起来
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    // 删除所有旧的多于的Fiber节点
    if (newIdx === newChildren.length) {
        //我们已经到了新孩子的末日。我们可以删除其余的。
      // We've reached the end of the new children. We can delete the rest.
      deleteRemainingChildren(returnFiber, oldFiber);
      return resultingFirstChild;
    }

    if (oldFiber === null) {
        // 初始化会走这里
        //如果我们没有任何现有的孩子，我们可以选择一条快速的道路，因为其余的都是插入。
      // If we don't have any more existing children we can choose a fast path
      // since the rest will all be insertions.
      for (; newIdx < newChildren.length; newIdx++) {
          // 为每个child都创建一个单独的fiber对象
        const newFiber = createChild(
          returnFiber,
          newChildren[newIdx],
          expirationTime,
        );
        if (newFiber === null) {
          continue;
        }
        // 为newFiber分配一个下标index = newIdx
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber; // 通过sibling属性将所以兄弟Fiber节点关联起来
        }
        previousNewFiber = newFiber;
      }
      return resultingFirstChild;
    }
    //将所有子项添加到键映射以进行快速查找。
    // Add all children to a key map for quick lookups.
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

    //继续扫描并使用映射还原移动时删除的项目。
    // Keep scanning and use the map to restore deleted items as moves.
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx],
        expirationTime,
      );
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
              //新的光纤正在进行中，但如果存在电流，这意味着我们重新使用了光纤。我们需要从子列表中删除它，这样就不会将其添加到删除列表中。
            // The new fiber is a work in progress, but if there exists a
            // current, that means that we reused the fiber. We need to delete
            // it from the child list so that we don't add it to the deletion
            // list.
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key,
            );
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    if (shouldTrackSideEffects) {
      //删除了上面未使用的所有现有子项。我们需要将它们添加到删除列表中。
      // Any existing children that weren't consumed above were deleted. We need
      // to add them to the deletion list.
      existingChildren.forEach(child => deleteChild(returnFiber, child));
    }

    return resultingFirstChild;
  }
```

#### createChild

* 根据newChild的类型为每一个`newChild`分配一个Fiber对象

```javascript
function createChild(
    returnFiber: Fiber,
    newChild: any,
    expirationTime: ExpirationTime,
  ): Fiber | null {
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // Text nodes don't have keys. If the previous node is implicitly keyed
      // we can continue to replace it without aborting even if it is not a text
      // node.
      const created = createFiberFromText(
        '' + newChild,
        returnFiber.mode,
        expirationTime,
      );
      created.return = returnFiber;
      return created;
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const created = createFiberFromElement(
            newChild,
            returnFiber.mode,
            expirationTime,
          );
          created.ref = coerceRef(returnFiber, null, newChild);
          created.return = returnFiber;
          return created;
        }
        case REACT_PORTAL_TYPE: {
          const created = createFiberFromPortal(
            newChild,
            returnFiber.mode,
            expirationTime,
          );
          created.return = returnFiber;
          return created;
        }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        const created = createFiberFromFragment(
          newChild,
          returnFiber.mode,
          expirationTime,
          null,
        );
        created.return = returnFiber;
        return created;
      }

      throwOnInvalidObjectType(returnFiber, newChild);
    }
    return null;
  }
```

#### placeChild
* 为child元素的`Fiber`分配一个`index`属性，用于标明该child元素位于父元素的第几个子元素
* 更新Update阶段`shouldTrackSideEffects`为`true`，所以 根据当前子元素的Fiber对象的下标来判定元素是否应该往前后者往后移动：当旧index小于新index的时候，证明元素需要向后移

```javascript
function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIndex: number,
  ): number {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects) {
      // Noop.
      return lastPlacedIndex;
    }
    // 更新阶段shouldTrackSideEffects为true，所以 根据当前子元素的Fiber对象的下标来判定元素是否应该往前后者往后移动
    const current = newFiber.alternate;
    if (current !== null) {
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        // This is a move.
        newFiber.effectTag = Placement;
        return lastPlacedIndex;
      } else {
        // This item can stay in place.
        return oldIndex;
      }
    } else {
      //这是插入。
      // This is an insertion.
      newFiber.effectTag = Placement;
      return lastPlacedIndex;
    }
  }
```

#### updateSlot
* 
```javascript
function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: any,
    expirationTime: ExpirationTime,
  ): Fiber | null {
    //如果key匹配，则更新fiber，否则返回null。
    // Update the fiber if the keys match, otherwise return null.

    const key = oldFiber !== null ? oldFiber.key : null;

    if (typeof newChild === 'string' || typeof newChild === 'number') {
      //文本节点没有键。如果上一个节点隐式设置了关键帧即使不是文本，我们也可以继续替换它而不终止节点。
      // Text nodes don't have keys. If the previous node is implicitly keyed
      // we can continue to replace it without aborting even if it is not a text
      // node.
      if (key !== null) {
        return null;
      }
      // 更新文本节点
      return updateTextNode(
        returnFiber,
        oldFiber,
        '' + newChild,
        expirationTime,
      );
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          if (newChild.key === key) {
            if (newChild.type === REACT_FRAGMENT_TYPE) {
              return updateFragment(
                returnFiber,
                oldFiber,
                newChild.props.children,
                expirationTime,
                key,
              );
            }
            // 更新React元素
            return updateElement(
              returnFiber,
              oldFiber,
              newChild,
              expirationTime,
            );
          } else {
            return null;
          }
        }
        case REACT_PORTAL_TYPE: {
          if (newChild.key === key) {
            return updatePortal(
              returnFiber,
              oldFiber,
              newChild,
              expirationTime,
            );
          } else {
            return null;
          }
        }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        if (key !== null) {
          return null;
        }

        return updateFragment(
          returnFiber,
          oldFiber,
          newChild,
          expirationTime,
          null,
        );
      }

      throwOnInvalidObjectType(returnFiber, newChild);
    }
    return null;
  }
```

### `reconcileSingleTextNode`

* 当外界传给`reconcileChildren`的`nextChildren`类型是`String`或者`Number`的时候调用此函数

```javascript
function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string,
    expirationTime: ExpirationTime,
  ): Fiber {
    //不需要检查文本节点上的键，因为我们没有方法定义它们。
    // There's no need to check for keys on text nodes since we don't have a
    // way to define them.
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      //我们已经有一个现有的节点，所以让我们更新它并删除其余的节点。
      // We already have an existing node so let's just update it and delete
      // the rest.
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      const existing = useFiber(currentFirstChild, textContent);
      existing.return = returnFiber;
      return existing;
    }
    //现有的第一个子节点不是文本节点，因此我们需要创建一个删除现有的
    // The existing first child is not a text node so we need to create one
    // and delete the existing ones.
    deleteRemainingChildren(returnFiber, currentFirstChild);
    const created = createFiberFromText(
      textContent,
      returnFiber.mode,
      expirationTime,
    );
    created.return = returnFiber;
    return created;
  }
```
#### deleteRemainingChildren
* 删除剩余的节点，复用currentFirstChild节点，并且更新复用节点（existing）的父级节点（return）
```javascript
  function deleteRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
  ): null {
    let childToDelete = currentFirstChild;
    // 删除子节点以及所有孙子节点
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete); 
      childToDelete = childToDelete.sibling; 
    }
    return null;
  }
```
#### createFiberFromText
* 创建一个`tag`属性是`HostText`的Fiber对象
````javascript
function createFiberFromText(
  content: string,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
): Fiber {
  const fiber = createFiber(HostText, content, null, mode);
  fiber.expirationTime = expirationTime;
  return fiber;
}
````
