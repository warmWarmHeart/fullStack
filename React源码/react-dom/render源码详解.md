# render详解
## 示例代码
* 代码分析会根据此代码进行分析
```javascript
import React { Component, useState, useEffect, useCallback } from 'react'
import ReactDom from 'react-dom'

function ChildA (props) {
    const [name, setName] = useState('张三')
    useEffect(() => {
        console.log(name)
    }, [name])
    const handleClick = useCallback(() => {
        console.log('点击啦')
    }, [name])
    return (
        <div>
            ChildA
            { name }
            <button onClick={handleClick}>点击我</button>
            <ChildB />
        </div>
    )
}
class ChildB extends Component {
    render(){
        return '你好 ChildB'
    }
}
class ChildC extends Component {
    render(){
        return 'ChildC'
    }
}
class App extends Component {
    render () {
        return (
            <div>
                APP
                <ChildA />
                <ChildC />
            </div>
        )
    }
}

ReactDom.render(<App />, document.getElementById('app'));
```
## 步骤1 `<App />`
* `<App />`是`jsx`的一种写法，实际上相当于用`react`的`createElement`生成了一个虚拟`dom`（一个用来描述 想要渲染的真实 Dom的一个对象）

```javascript
export function createElement(type, config, children) {
  let propName;
  const props = {};
  let key = null;
  let ref = null;
  let self = null;
  let source = null;
  if (config != null) {
    if (hasValidRef(config)) {
      ref = config.ref;
    }
    if (hasValidKey(config)) {
      key = '' + config.key;
    }
    self = config.__self === undefined ? null : config.__self;
    source = config.__source === undefined ? null : config.__source;
    //剩余属性将添加到新的props对象中
    for (propName in config) {
      if (
        hasOwnProperty.call(config, propName) &&
        !RESERVED_PROPS.hasOwnProperty(propName) //RESERVED_PROPS 是 `key`、 ref、__self、__source
      ) {
        props[propName] = config[propName];
      }
    }
  }
  //子项可以是多个参数，并且这些子项被转移到新分配的props对象上。
  const childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2]; // 将children分别放入props.children数组中
    }
    props.children = childArray;
  }
  // Resolve default props
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  // 最终返回一个ReactElement对象 上面的$$typeof = REACT_ELEMENT_TYPE
  return ReactElement(
    type,
    key,
    ref,
    self,
    source,
    ReactCurrentOwner.current,
    props,
  );
}
```
```javascript
const ReactElement = function(type, key, ref, self, source, owner, props) {
  const element = {
    //这个标签允许我们将其唯一地标识为一个React元素
    // This tag allows us to uniquely identify this as a React Element
    $$typeof: REACT_ELEMENT_TYPE,

    // Built-in properties that belong on the element
    // 标签名或者组件名称
    type: type,
    key: key,
    ref: ref,
    props: props,
    //记录负责创建此元素的组件。
    // Record the component responsible for creating this element.
    _owner: owner,
  };
  return element;
};
```

* `<App />`最后生成的ReactElement如下： 
```javascript
const AppReactElement = {
    type: App, // App 就是上面定义的App类
    $$typeof: Symbol(react.element),
    key: null,
    ref: null,
    props: {},
    _owner: null,
    _store: {validated: false},
    _source: null,
}
```

## 步骤2 调用ReactDom.render函数
```javascript
export function render(
  element: React$Element<any>, // 执行的时候这里是AppReactElement
  container: Container, // container是document.getElementById('app')
  callback: ?Function, // 这里是undefined
) {
  return legacyRenderSubtreeIntoContainer(
    null, // 第一次参数是parementElement，这里App的父元素是undefined
    element, // AppReactElement
    container,
    false, // forceHydrate参数
    callback,// 这里是undefined
  );
}
```

* `render`内部会执行 `legacyRenderSubtreeIntoContainer`函数，生成一个`root`并生成一个`fiber`对象绑定到`root`上，`root`又绑定到`container._reactRootContainer`属性上
```javascript
function legacyRenderSubtreeIntoContainer(
  parentComponent: ?React$Component<any, any>, // 第一次参数是parementElement，这里App的父元素是undefined
  children: ReactNodeList,// AppReactElement
  container: Container,// container是document.getElementById('app')
  forceHydrate: boolean, // forceHydrate参数
  callback: ?Function,// 这里是undefined
) {
  let root: RootType = (container._reactRootContainer: any); //初次container并无此属性
  let fiberRoot;
  // 如果不存在一个reactRoot实例就创建一个
  if (!root) {
    root = container._reactRootContainer = legacyCreateRootFromDOMContainer(
      container,// container是document.getElementById('app')
      forceHydrate, // false
    );
    //     一、FiberRoot的含义与作用
    //      （1）FiberRoot是整个React应用的起点
    //      （2）FiberRoot包含应用挂载的目标节点（<div id='root'>root</div>）
    //      （3）FiberRoot记录整个React应用 更新过程中的各种信息
    // root._internalRoot属性会在上面legacyCreateRootFromDOMContainer执行的时候进行设置
    fiberRoot = root._internalRoot;
    // fiberRoot创建后执行callback回调 因为callback为undefined 所以忽略
    if (typeof callback === 'function') {
        ...
    }
    unbatchedUpdates(() => {
      updateContainer(children, fiberRoot, parentComponent, callback);
    });
  } else {
    fiberRoot = root._internalRoot;
    if (typeof callback === 'function') {
      const originalCallback = callback;
      callback = function() {
        const instance = getPublicRootInstance(fiberRoot);
        originalCallback.call(instance);
      };
    }
    updateContainer(children, fiberRoot, parentComponent, callback);
  }
  return getPublicRootInstance(fiberRoot);
}
```

### 创建 `FiberRoot`和`HostRootFiber`,且将`FiberRoot`的`current`指向`HostRootFiber`，而`HostRootFiber`的`stateNode`又指回`FiberRoot`

* 初始化的时候 `root` 还是空值，需要调用`legacyCreateRootFromDOMContainer`创建一个`root`出来
```javascript
function legacyCreateRootFromDOMContainer(
  container: Container,// container是document.getElementById('app')
  forceHydrate: boolean, // false
): RootType {
  // 该状态依赖外界 1： 传参forceHydrate（render第一次传false）
  // 2 ： container容器有子元素，且子元素有属性自定义data-reactroot, 服务端渲染的话，会在React App的第一个元素上添加该属性 ROOT_ATTRIBUTE_NAME = 'data-reactroot';
  const shouldHydrate =
    forceHydrate || shouldHydrateDueToLegacyHeuristic(container);
  //如果不是服务端渲染的话
  // 第一次默认清除所有子元素 为什么要删除？因为React认为这些节点是不需要复用的
  if (!shouldHydrate) {
    let warned = false;
    let rootSibling;
    while ((rootSibling = container.lastChild)) {
      container.removeChild(rootSibling);
    }
  }

  // 创建React容器 返回创建的reactRoot实例
  return createLegacyRoot(
    container, // container是document.getElementById('app')
    shouldHydrate // 这里是undefined
      ? {
          hydrate: true,
        }
      : undefined,
  );
}
```

* `createLegacyRoot`会调用`ReactDOMBlockingRoot`函数，`ReactDOMBlockingRoot`函数又会调用`createRootImpl`, 接下来看`createRootImpl`函数
```javascript
  // `createLegacyRoot`函数return new ReactDOMBlockingRoot(container, LegacyRoot, options);
  // `ReactDOMBlockingRoot`类设置root = container._reactRootContainer = this._internalRoot = createRootImpl(container, tag, options);
    function createRootImpl(
      container: Container,// container是document.getElementById('app')
      tag: RootTag, // LegacyRoot
      options: void | RootOptions, // null
    ) {
      const root = createContainer(container, tag, hydrate, hydrationCallbacks); // 后两个参数分别是false和null
      // 给container加一个 '__reactContainere$' + randomKey 属性 ，指向rootFiber
      markContainerAsRoot(root.current, container);
      return root;
    }
```

* `createContainer`调用了`createFiberRoot`, 生成一个
```javascript
    // return createFiberRoot(containerInfo, tag, hydrate, hydrationCallbacks);
export function createFiberRoot(
  containerInfo: any, // id为app的dom元素
  tag: RootTag, // LegacyRoot
  hydrate: boolean, // false
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
): FiberRoot {
  // root 比 RootFiber多一个current属性也多了一个containerInfo属性
  const root: FiberRoot = (new FiberRootNode(containerInfo, tag, hydrate): any);
  //循环施工。这会欺骗类型系统，因为stateNode是any。
  // 创建一个未初始化RootFiber 比root多了一个mode属性和StateNode属性(指向FiberRoot) Fiber 上有sibling、child、next等关联属性
  const uninitializedFiber = createHostRootFiber(tag);
  // FiberRoot.current 指向RootFiber
  // RootFiber.stateNode指向FiberRoot
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;
  // 给新创建的uninitializedFiber初始化一个 UpdateQueue
  initializeUpdateQueue(uninitializedFiber);
  return root;
}
```

* `FiberRootNode` 生成一个FiberRoot对象
```javascript
function FiberRootNode(containerInfo, tag, hydrate) {
  // 标记不同的组件类型
  this.tag = tag;
  this.current = null; // 指向RootFiber
  this.containerInfo = containerInfo; // 代表容器的节点
  this.pendingChildren = null; //只有在持久化更新的平台会用到，在react-Dom中不会被用到
  this.pingCache = null; // Suspend组件会用到
  this.finishedExpirationTime = NoWork; // render root的期间，renderRootSync之后 commitRoot之前 会保留为当时的 expirationTime
  this.finishedWork = null; //在render阶段已经完成了的任务，在commit阶段只会执行finishedWork的任务
  this.timeoutHandle = noTimeout; //用来清理还没有被触发的计时器 // 会在finishConcurrentRender函数调用中设置，prepareFreshStack准备新栈的时候cancelTimeout
  this.context = null; //顶层的context对象，只用在调用“renderSubTreeIntoContainer”的时候在有用
  this.pendingContext = null;
  this.hydrate = hydrate;
  this.callbackNode = null; // 会在ensureRootIsScheduled中设置为一个空的对象// 调用scheduleSyncCallback的时候并不会立刻执行performSyncWorkOnRoot，而是将其放在syncQueue的一个变量中保留 等待flushSyncCallbackQueue执行的时候执行
                            // root.callbackNode = scheduleSyncCallback(
                            //   performSyncWorkOnRoot.bind(null, root),
                            // );
  this.callbackPriority = NoPriority;
  this.firstPendingTime = NoWork;
  this.firstSuspendedTime = NoWork;
  this.lastSuspendedTime = NoWork;
  this.nextKnownPendingLevel = NoWork;
  this.lastPingedTime = NoWork;
  this.lastExpiredTime = NoWork;
  this.mutableSourcePendingUpdateTime = NoWork;

}
```

* `createHostRootFiber` 创建一个`tag`为 `HostRoot`、`mode`为`NoMode`的Fiber对象
```javascript
export function createHostRootFiber(tag: RootTag): Fiber {
  let mode;
  if (tag === ConcurrentRoot) {
    mode = ConcurrentMode | BlockingMode | StrictMode;
  } else if (tag === BlockingRoot) {
    mode = BlockingMode | StrictMode;
  } else {
    mode = NoMode; // root的tag是legacyRoot 所以mode就是NoMode
  }
  return createFiber(HostRoot, null, null, mode);
}
```

* `createFiber` 创建一个`Fiber`对象
```javascript
function FiberNode(
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode,
) {
  // Instance
  this.tag = tag;
  this.key = key;
  this.elementType = null;
  this.type = null;
  // FiberNode会通过stateNode绑定一些其他的对象，例如FiberNode对应的Dom、FiberRoot、ReactComponent实例
  this.stateNode = null;
  // Fiber
  this.return = null;//表示父级 FiberNode
  this.child = null;// 表示第一个子 FiberNode
  this.sibling = null;//表示紧紧相邻的下一个兄弟 FiberNode
  this.index = 0;
  this.ref = null;
  this.pendingProps = pendingProps;//表示新的props
  this.memoizedProps = null;//表示经过所有流程处理后的新props
  this.updateQueue = null;//更新队列，队列内放着即将要发生的变更状态
  this.memoizedState = null;//表示经过所有流程处理后的新state
  this.dependencies = null;
  this.mode = mode;
  // Effects
  this.effectTag = NoEffect;//16进制的数字，可以理解为通过一个字段标识n个动作，如Placement、Update、Deletion、Callback……所以源码中看到很多 &=
  this.nextEffect = null;//表示下一个将要处理的副作用FiberNode的引用
  this.firstEffect = null;//与副作用操作遍历流程相关 当前节点下，第一个需要处理的副作用FiberNode的引用
  this.lastEffect = null;//表示最后一个将要处理的副作用FiberNode的引用
  this.expirationTime = NoWork;
  this.childExpirationTime = NoWork;
  this.alternate = null;//Fiber调度算法采取了双缓冲池算法，FiberRoot底下的所有节点，都会在算法过程中，尝试创建自己的“镜像”
}
```

* `initializeUpdateQueue`给 `fiber` 增加一个 `UpdateQueue`, 该属性上会记录该fiber对应的组件的所有副作用和更改
```javascript
function initializeUpdateQueue<State>(fiber: Fiber): void {
  const queue: UpdateQueue<State> = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
    },
    effects: null,
  };
  fiber.updateQueue = queue;
}
```

### 执行 `unbatchedUpdates`函数 标记一下`executionContext`执行上下文为`LegacyUnbatchedContext`，也就是非批量上下文的意思（每一个阶段的`executionContext`值都不一样）
紧接着执行传进来的`fn`回调函数，在`render`中`fn`就是`updateContainer`函数，执行完`updateContainer`后会根据`executionContext`是否等于`NoContext`,如果相等则执行`flushSyncCallbackQueue`

```javascript
// 非批量更新
export function unbatchedUpdates<A, R>(fn: (a: A) => R, a: A): R {
  // const NoContext = /*                    */ 0b000000;
  // const BatchedContext = /*               */ 0b000001; // 分批上下文
  // const EventContext = /*                 */ 0b000010;
  // const DiscreteEventContext = /*         */ 0b000100; // 离散事件上下文
  // const LegacyUnbatchedContext = /*       */ 0b001000; //传统非批量上下文
  // const RenderContext = /*                */ 0b010000; // 渲染上下文
  // const CommitContext = /*                */ 0b100000; // 提交上下文
  // 暂存当前执行context
  const prevExecutionContext = executionContext;
  // 这段是个位运算，就是把prevExecutionContext的BatchedContext位置0，然后把LegacyUnbatchedContext的位置1。?????
  //首先 & 操作当且当两个位上都为1的时候返回1，| 只要有一位为1，返回1
  // 将执行上下文设置为非批量上下文
  // 把当前上下文的BatchedContext标志位置为false，表示当前为非批量更新
  executionContext &= ~BatchedContext;
  executionContext |= LegacyUnbatchedContext;
  try {
    return fn(a);
  } finally {
    executionContext = prevExecutionContext;
    if (executionContext === NoContext) {
      // 刷新此批处理期间计划的同步立即回调队列
      // Flush the immediate callbacks that were scheduled during this batch
      flushSyncCallbackQueue();
    }
  }
}
```

### 重头戏 `updateContainer`
```javascript
export function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  callback: ?Function,
): ExpirationTime {
  const current = container.current; // 绑定在FiberRoot上的fiber对象
  const currentTime = requestCurrentTimeForUpdate(); // 获取当前已经花费的时间  // return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0); ms是no
  // 悬停配置
  // {
  //  timeoutMs: number, 超时时间
  //  busyDelayMs?: number 延迟时间Ms,
  //  busyMinDurationMs?: 最小持续时间Ms,
  //}
  const suspenseConfig = requestCurrentSuspenseConfig();
  // 计算过期时间，这是React优先级更新非常重要的点
  // 需要根据过期时间的前后将此任务放在React调度的timeQueue中，而React调度则在空闲时刻进行执行这些任务
  // 通过获取到的currentTime, 调用computeExpirationForFiber，计算该fiber的优先级，
  // 当前版本的React配置中 过期时间是根据1073741823计算，所以基本使用React应用期间，任务基本不会过期，必定会根据先后顺序进行执行
  // expirationTime越大，代表优先级越高，所以同步模式拥有最高的优先级。

  // currentTime = return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0);
  // celling(((ms / UNIT_SIZE) | 0) + 500) // 随着时间的增加 计算出来的值越来越大
  // 最后得出的结果随着cell的reurn的值的增加 变的越来越小
  // return (
  //   MAGIC_NUMBER_OFFSET -
  //   ceiling( // ceiling得出的值随着current的增大 越来越小
  //     MAGIC_NUMBER_OFFSET - currentTime + expirationInMs / UNIT_SIZE,
  //     bucketSizeMs / UNIT_SIZE, // 精度 固定值
  //   )
  // );

  // 当computeExpirationForFiber内部获取的expirationTime === renderExpirationTime的时候 将expirationTime - 1 然后返回
  // expirationTime 比 currentTime 小大概500ms有差值
  const expirationTime = computeExpirationForFiber(
    currentTime,
    current,
    suspenseConfig,
  );

  //render的时候由于parentComponent为null,所以返回空对象{}
  // 子元素的context则是合并父元素的context的
  // 获得上下文对象，然后分配给container.context或container.pendingContext。
  const context = getContextForSubtree(parentComponent);
  if (container.context === null) {
    container.context = context;
  } else {
    container.pendingContext = context;
  }
  // 用来标记 react 更新的节点 初始化的update.tag = UpdateState,
  const update = createUpdate(expirationTime, suspenseConfig);
  // React DevTools当前依赖于此属性
  // Caution: React DevTools currently depends on this property
  // being called "element".
  update.payload = {element};

  callback = callback === undefined ? null : callback;
  if (callback !== null) {
    // 为更新任务添加回调函数
    update.callback = callback;
  }
  // 就是在 fiber 对象上创建一个 updateQueue，然后把 update 对象传入到这个 queue 里
  // setState 三次会创建三个update，放到 updateQueue 里
  enqueueUpdate(current, update);
  // 找到当前Fiber的 root
  // 给更新节点的父节点链上的每个节点的expirationTime设置为这个update的expirationTime，除非他本身时间要小于expirationTime
  // 给更新节点的父节点链上的每个节点的childExpirationTime设置为这个update的expirationTime，除非他本身时间要小于expirationTime
  // 最终返回 root 节点的Fiber对象
  // setState、 还有HOOKS的一些useState等处罚的dispatchAction操作都会触发scheduleUpdateOnFiber函数
  scheduleUpdateOnFiber(current, expirationTime);

  return expirationTime;
}
```

* `requestCurrentTimeForUpdate` 计算 `currentTime`
```javascript
export function requestCurrentTimeForUpdate() {
  // executionContext 第一次的时候是LegacyUnbatchedContext，所以render的时候不会走这里
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    //我们在React里面，所以可以看实际时间。
    // We're inside React, so it's fine to read the actual time.
    return msToExpirationTime(now());
  }
  //我们没有在react中，所以我们可能正在浏览器事件中。
  // We're not inside React, so we may be in the middle of a browser event.
  if (currentEventTime !== NoWork) {
    //对所有更新使用相同的开始时间，直到我们再次输入React。
    // Use the same start time for all updates until we enter React again.
    return currentEventTime;
  }
  //这是React产生以来的第一次更新。计算新的开始时间。
  // return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0); ms是no
  // This is the first update since React yielded. Compute a new start time.
  currentEventTime = msToExpirationTime(now());
  return currentEventTime;
}
```

* `msToExpirationTime` 
```javascript
//到期时间单位为10ms。
// 1 unit of expiration time represents 10ms.
export function msToExpirationTime(ms: number): ExpirationTime {
   //MAGIC_NUMBER_OFFSET = 1073741823 - 2 = 1073741821
  //总是从偏移量中减去，这样我们就不会与NoWork的神奇数字冲突。
  // Always subtract from the offset so that we don't clash with the magic number for NoWork.
  // 10抹掉10ms时间差, | 0的意思是取整,
  return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0);
}
```

* `now` 计算程序运行开始到需要获取一个时间戳的中间查值
```javascript
//initialTimeMs 是在程序运行之初用Scheduler_now()获取到的一个时间差 initialTimeMs小于10秒，就取Scheduler_now(), 大于10秒就取当前时间到initialTimeMs设置那一刻中间的时间差
export const now = initialTimeMs < 10000 ? Scheduler_now : () => Scheduler_now() - initialTimeMs;
```

* `getCurrentTime` 也就是上面的 `Scheduler_now` 获取程序运行开始到执行`Scheduler_now`的中间的时间差
```javascript
if (
    typeof performance === 'object' &&
    typeof performance.now === 'function'
  ) {
    getCurrentTime = () => performance.now();
  } else {
    const initialTime = Date.now();
    getCurrentTime = () => Date.now() - initialTime;
  }
```
```javascript
export function computeExpirationForFiber(
  currentTime: ExpirationTime,
  fiber: Fiber,
  suspenseConfig: null | SuspenseConfig,
): ExpirationTime {
  const mode = fiber.mode; // root的mode是NoMode
  // const BlockingMode = 0b0010; BlockingMode不等于NoMode，所以不反回Sync
  if ((mode & BlockingMode) === NoMode) {
    return Sync;
  }
  // 获取当前React版本的默认优先等级 NormalPriority = 3
  const priorityLevel = getCurrentPriorityLevel();
  // 如果是并发模式变成无模式的话
  if ((mode & ConcurrentMode) === NoMode) {
      // 也不会走这里
    // ImmediatePriority == 99
    // Sync = 1073741823
    // Batched = Sync -1
    return priorityLevel === ImmediatePriority ? Sync : Batched;
  }
  if ((executionContext & RenderContext) !== NoContext) {
      // 第一次也不会走这里
    // 使用我们已经渲染的任何时间
    // 待办事项：是否应该有一种退出的方式，比如使用“runWithPriority”？
    // Use whatever time we're already rendering
    // TODO: Should there be a way to opt out, like with `runWithPriority`?
    return renderExpirationTime;
  }

  let expirationTime;
  if (suspenseConfig !== null) {
    //根据暂停超时计算过期时间。
    // LOW_PRIORITY_EXPIRATION === 5000
    // Compute an expiration time based on the Suspense timeout.
    expirationTime = computeSuspenseExpiration(
      currentTime,
      suspenseConfig.timeoutMs | 0 || LOW_PRIORITY_EXPIRATION,
    );
  } else {
    //根据调度程序优先级计算过期时间。
    // Compute an expiration time based on the Scheduler priority.   
    switch (priorityLevel) {
      case ImmediatePriority:  // 1
        expirationTime = Sync;
        break;
      case UserBlockingPriority: // 2
        // TODO: Rename this to computeUserBlockingExpiration
        expirationTime = computeInteractiveExpiration(currentTime);
        break;
      case NormalPriority: // 3
      case LowPriority: // 4
        // 因为上面获取到的priorityLevel是NormalPriority 所以会走这里的逻辑
        expirationTime = computeAsyncExpiration(currentTime);
        break;
      case IdlePriority: // 5
        // 空闲的优先级比从不稍高。它必须完全完成顺序要一致
        expirationTime = Idle;
        break;
      default:
        invariant(false, 'Expected a valid priority level');
    }
  }
  //如果正在渲染树，请不要在已渲染的过期时间更新。
  // 因为updateContainer会在setState的时候或者 触发hook的dispatchAction的时候触发 ？？
  // 所以此处就是为了在root正在渲染阶段的时候触发了dispatchAction的时候 将过期时间减去1  后面会有如果expirationTime < renderExpirationTime 之类的代码 ？？
  if (workInProgressRoot !== null && expirationTime === renderExpirationTime) {
    // This is a trick to move this update into a separate batch
    expirationTime -= 1;
  }

  return expirationTime;
}
```

* `computeAsyncExpiration` 算出一个比`currnetTime`大概小500毫秒的数值
```javascript
function computeAsyncExpiration(
  currentTime: ExpirationTime,
): ExpirationTime {
  return computeExpirationBucket(
    currentTime,
    LOW_PRIORITY_EXPIRATION, // 5000
    LOW_PRIORITY_BATCH_SIZE, // 250
  );
}

function computeExpirationBucket(
  currentTime,
  expirationInMs, // 5000
  bucketSizeMs, // 250
): ExpirationTime {
  // currentTime = return MAGIC_NUMBER_OFFSET - ((now() / 10) | 0) 约等于 MAGIC_NUMBER_OFFSET - now();
  // 最后得出的结果随着cell的reurn的值的增加 变的越来越小
  return (
    // MAGIC_NUMBER_OFFSET - ((MAGIC_NUMBER_OFFSET - currentTime + 500) | 0) * 25 - 1 * 25
    // MAGIC_NUMBER_OFFSET - (((now() + 500) | 0) / 25) - 1) * 25
    // 接近于 MAGIC_NUMBER_OFFSET - now() - 500
    MAGIC_NUMBER_OFFSET - 
    ceiling(
      MAGIC_NUMBER_OFFSET - currentTime + expirationInMs / UNIT_SIZE,
      bucketSizeMs / UNIT_SIZE, // 精度 固定值 25
    )
  );
}

function ceiling(num: number, precision: number): number {
  // 将num按25精度计算 如 （252 / 25） | 0 = 10 ; 10 + 1 = 11 ; 11 * 25 = 275
  // 计算后的值比原值大
  // 这样的做法 我猜测是想将在差距很小的范围内的时间统一 然后批量处理
  return (((num / precision) | 0) + 1) * precision;
}
```

* `createUpdate`函数创建一个`Update`对象。`Update`对象就是用来描述react组件的各种更新的对象，比如创建dom后的安置、取代旧dom、移除等更新都会绑定一个`Update`对象
```javascript
// 创建 update 来标记 react 需要更新的点
export function createUpdate(
  expirationTime: ExpirationTime,
  suspenseConfig: null | SuspenseConfig,
): Update<*> {
  let update: Update<*> = {
    expirationTime, // 这里的expirationTime可能比renderExpirationTime 小 1
    suspenseConfig,
    // 四个状态，更新updateState 0、替换replaceState 1、强制forceUpdate 2、throw 捕获 captureUpdate 3
    tag: UpdateState,
    payload: null, //  实际操作内容，在外面赋值上去 update.payload = { element } 初次渲染传入的是元素，setState 可能传入的就是对象或者方法
    callback: null, //对应的回调，比如setState({}, callback)
    next: null,// 下一个 update 单向链表
  };
 
  return update;
}
```

* `enqueueUpdate`函数用来将新创建的`update`对象放到Fiber的`UpdateQueue`对象的`share.pending`上，此处的Fiber为`HostRootFiber`
```javascript
export function enqueueUpdate<State>(fiber: Fiber, update: Update<State>) {
  const updateQueue = fiber.updateQueue; // 节点创建的 update 对象 queue
  if (updateQueue === null) {
    //仅当fiber已卸下时发生。
    // Only occurs if the fiber has been unmounted.
    return;
  }
  // updateQueue.shared.pending 会在processUpdateQueue中加到firstBaseUpdate和lastBaseUpdate上生成新的update环
  const sharedQueue = updateQueue.shared;
  const pending = sharedQueue.pending;
  if (pending === null) {
    //这是第一次更新。创建循环列表。
    // 末尾update的next永远指向updateQueue.shared.pending，也就是第一个pending的第一个update
    // This is the first update. Create a circular list.
    update.next = update;
  } else {
    // 将update加入到 updateQueue.shared.pending.next之后 且将以前shared.pending.next指向的内容指向自己的next
    // 相当于将自己插入updateQueue这个堆栈的顶部
    update.next = pending.next;
    pending.next = update;
  }
  // 第一次将update放在更新队列updateQueue的shared的pending属性上
  // 下次进来则会通过上面else里的语句将上次update的next指向本次update
  sharedQueue.pending = update;
}
```

* `scheduleUpdateOnFiber`函数通过调度`Scheduler`更新fiber，此处是更新创建好的`HostRootFiber`。调度相关文档可以[参考这里](../调度scheduler/readme.md)

```javascript
export function scheduleUpdateOnFiber(
  fiber: Fiber,
  expirationTime: ExpirationTime,
) {
  // 检查嵌套更新
  //使用这些来防止嵌套更新的无限循环
  // nested Update Count嵌套更新计数最大为50
  // 如果超过50具有嵌套更新的根目录rootWithNestedUpdates置为null，nested Update Count置为0
  // 对比nestedUpdateCount、NESTED_UPDATE_LIMIT这两个参数，nestedUpdateCount会在performSyncWorkOnRoot执行flushPassiveEffects的时候加一或置零（rootWithPendingPassiveEffects === null ）
  checkForNestedUpdates();
  // 获取到 FiberRoot
  // 找到当前Fiber的 root
  // 给更新节点的父节点链上的每个节点的expirationTime设置为这个update的expirationTime，除非他本身时间要小于expirationTime
  // 给更新节点的父节点链上的每个节点的childExpirationTime设置为这个update的expirationTime，除非他本身时间要小于expirationTime
  // 最终返回 root 节点的Fiber对象
  // 因为 React 的更新需要从FiberRoot开始，所以会执行一次向上遍历找到FiberRoot，
  // 而向上遍历则正好是一步步找到创建更新的节点的父节点的过程，这时候 React 就会对每一个该节点的父节点链上的节点设置childExpirationTime，
  // 因为这个更新是他们的子孙节点造成的
  // 在我们向下更新整棵Fiber树的时候，每个节点都会执行对应的update方法，
  // 在这个方法里面就会使用节点本身的expirationTime和childExpirationTime来判断他是否可以直接跳过，不更新子树。expirationTime代表他本身是否有更新，
  // 如果他本身有更新，那么他的更新可能会影响子树；childExpirationTime表示他的子树是否产生了更新；如果两个都没有，那么子树是不需要更新的。
  // 1 同一个节点产生的连续两次更新，最红在父节点上只会体现一次childExpirationTime
  // 2 不同子树产生的更新，最终体现在跟节点上的是优先级最高的那个更新:
  // 设置root.firstPendingTime = expirationTime
  const root = markUpdateTimeFromFiberToRoot(fiber, expirationTime);
  if (root === null) {
    // 如果找不到root报警告 警告在DEV中更新未安装的fiber
    // 无法对未装载的组件执行反应状态更新。这是一个no操作，但它表示应用程序内存泄漏。若要修复，请取消useffect清理函数中的所有订阅和异步任务
    warnAboutUpdateOnUnmountedFiberInDEV(fiber);
    return;
  }
  //优先权作为那个函数和这个函数的参数。
  // 会返回 NormalPriority; // 97
  const priorityLevel = getCurrentPriorityLevel();
  // 如果当前是同步更新的
  if (expirationTime === Sync) {
    // 如果不是批量更新或者  不是render或commit阶段，则直接同步调用任务
    if (
      // unbatchedUpdates 函数执行的时候 executionContext 会设置为 LegacyUnbatchedContext
      // 如果正在执行的上下文是unbatchUpdate不是批量更新
      // Check if we're inside unbatchedUpdates
      (executionContext & LegacyUnbatchedContext) !== NoContext &&
      // Check if we're not already rendering
      // 检查不是render或者commit阶段
      (executionContext & (RenderContext | CommitContext)) === NoContext
    ) {
      //这是一个遗留的边缘案例。ReactDOM.render-ed的初始装载
      //batchedUpdates的根目录应该是同步的，但是布局更新应推迟到批处理结束。
      // 在根目录上执行同步工作 这是不通过调度程序的同步任务的入口点
      // 内部会执行 1 flushPassiveEffects 2 renderRootSync 3 commitRoot 4 ensureRootIsScheduled
      performSyncWorkOnRoot(root);
    } else {
      ensureRootIsScheduled(root);
      if (executionContext === NoContext) {
        //现在刷新同步工作，除非我们已经在工作或在批处理中。
        // 这是在scheduleUpdateOnFiber而不是scheduleCallbackForFiber内部故意设置的，以保留在不立即刷新回调的情况下调度回调的功能。
        // 我们只对用户发起的更新执行此操作，以保留传统模式的历史行为。
        // Flush the synchronous work now, unless we're already working or inside
        // a batch. This is intentionally inside scheduleUpdateOnFiber instead of
        // scheduleCallbackForFiber to preserve the ability to schedule a callback
        // without immediately flushing it. We only do this for user-initiated
        // updates, to preserve historical behavior of legacy mode.
        flushSyncCallbackQueue();
      }
    }
  } else {
    // 这个是真正任务调度的入口
    // 每一个root都有一个唯一的调度任务，如果已经存在，我们要确保到期时间与下一级别任务的相同，每一次更新都会调用这个方法
    //使用此函数可为根目录安排任务。每个根目录下只有一个任务；如果已经计划了任务，我们将检查以确保现有任务的过期时间与根目录下一个工作级别的过期时间相同。
    // 此函数在每次更新时调用，并在退出任务之前调用。
    ensureRootIsScheduled(root);
  }

  if (
    (executionContext & DiscreteEventContext) !== NoContext &&
    (priorityLevel === UserBlockingPriority ||
      priorityLevel === ImmediatePriority)
  ) {
      // 忽略暂时不看
    ...
  }
}
```

* `markUpdateTimeFromFiberToRoot`函数
```javascript
function markUpdateTimeFromFiberToRoot(fiber, expirationTime) {
  // 跟新fiber的过期时间 render App 的时候会将expirationTime设置为HostRootFiber.expirationTime
  if (fiber.expirationTime < expirationTime) {
    fiber.expirationTime = expirationTime;
  }
  // fiber拥有一个辅助属性alternate，
  // fiber对象是新时代的虚拟DOM，它是用来承载着组件实例与真实DOM等重要数据。这些重要数据在更新过程是不需要重新生成的。但React希望能像git那样按分支开发，遇错回滚。
  // alternate就是这个备胎
  // 下面是将备胎的过期时间更新
  let alternate = fiber.alternate;
  if (alternate !== null && alternate.expirationTime < expirationTime) {
    alternate.expirationTime = expirationTime;
  }
  //将父路径移动到根目录并更新子到期时间。
  // 父级 Fiber， HostRootFiber的return属性是null
  let node = fiber.return;
  let root = null;
  if (node === null && fiber.tag === HostRoot) {
    // stateNode组件实例
    root = fiber.stateNode;
  } else {
    while (node !== null) {
      // 更新当前Fiber所有父节点祖父节点和他们的备胎alternate上的childExpirationTime，
      // 因为当当前fiber的过期时间更新的时候证明当前fiber绑定的React组件需要更新，name它的父级组件也需要知道它下面有子组件要更新的消息
      alternate = node.alternate;
      // 设置父级Fiber的过期时间，以及挂载在父Fiber上的它下面的children的过期时间childExpirationTime，当一个Fiber的childExpirationTime有值的时候证明它的子元素可能需要更新
      if (node.childExpirationTime < expirationTime) {
        node.childExpirationTime = expirationTime;
        if (
          alternate !== null &&
          alternate.childExpirationTime < expirationTime
        ) {
          alternate.childExpirationTime = expirationTime;
        }
      } else if (
        alternate !== null &&
        alternate.childExpirationTime < expirationTime
      ) {
        alternate.childExpirationTime = expirationTime;
      }
      if (node.return === null && node.tag === HostRoot) {
        root = node.stateNode;
        break;
      }
      node = node.return;
    }
  }

  if (root !== null) {
    // 将workInProgressRoot设置为新创建的HostRootFiber所挂载的ReactElement 也就是 <App />
    if (workInProgressRoot === root) {
      //接收到正在呈现的树的更新。作记号这root是未经加工的
      markUnprocessedUpdateTime(expirationTime);// 设置 workInProgressRootNextUnprocessedUpdateTime = expirationTime

      if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
        //根已被延迟挂起，这意味着此render肯定不会完成。既然我们有了一个新的更新，就在标记传入的更新之前，现在将其标记为挂起。
        // 这会中断当前呈现并切换到更新 暂不解读
        markRootSuspendedAtTime(root, renderExpirationTime);
      }
    }
    // 标记根目录有挂起的更新。
    // Mark that the root has a pending update.
    markRootUpdatedAtTime(root, expirationTime);
  }

  return root;
}
```

* `markRootUpdatedAtTime`函数标记根目录有挂起的更新，render函数第一次走到这里会将`HostRootFiber`下绑定的reactElement`<App />`的`firstPendingTime`设置为`expirationTime`
```javascript
// //标记根目录有正在等待状态的更新。
export function markRootUpdatedAtTime(
  root: FiberRoot,
  expirationTime: ExpirationTime,
): void {
  // 更新pending时间范围， HostRootFiber初始化firstPendingTime=null ，所以会在这里设置firstPendingTime
  const firstPendingTime = root.firstPendingTime;
  if (expirationTime > firstPendingTime) {
    root.firstPendingTime = expirationTime;
  }
  //更新悬停的时间的范围。将优先级较低或等于此更新的所有内容都视为未悬停
  // 首先我们定义一下什么情况下任务是被悬停的：
  // 出现可捕获的错误并且还有优先级更低的任务的情况下
  // 当捕获到thenable，并且需要设置onTimeout的时候
  // 我们称这个任务被suspended(悬停)了。记录这个时间主要是在resolve了promise之后，
  const firstSuspendedTime = root.firstSuspendedTime;
  if (firstSuspendedTime !== NoWork) {
    if (expirationTime >= firstSuspendedTime) {
      //整个暂停范围现在没有暂停。
      // The entire suspended range is now unsuspended.
      root.firstSuspendedTime = root.lastSuspendedTime = root.nextKnownPendingLevel = NoWork;
    } else if (expirationTime >= root.lastSuspendedTime) {
      root.lastSuspendedTime = expirationTime + 1;
    }
    //这是pending的级别。检查该级别是否高于下一个已知pending级别。
    if (expirationTime > root.nextKnownPendingLevel) {
      root.nextKnownPendingLevel = expirationTime;
    }
  }
}
```

* `ensureRootIsScheduled`函数 这里是真正的调度入口，内部包含了对`App`React组件下所有`chillren`相关Fiber的创建绑定，及各种Hooks相关`effect`的创建绑定以及`update`的创建绑定，也有对子组件下面render函数真实dom的创建绑定，还有各种生命周期的执行，最后渲染整个真实dom的过程
[ensureRootIsScheduled的真正解读](./ensureRootIsScheduled解读.md)

* `getNextRootExpirationTimeToWorkOn`会按照 `root.lastExpiredTime`、`root.firstPendingTime`、`root.lastPingedTime`或`root.nextKnownPendingLevel`(哪个大返回那个)的顺序返回一个`expirationTime`
```javascript
function getNextRootExpirationTimeToWorkOn(root: FiberRoot): ExpirationTime {
  //考虑到可能被挂起的级别或可能已收到ping的级别，确定根应呈现的下一个到期时间
  // Determines the next expiration time that the root should render, taking
  // into account levels that may be suspended, or levels that may have
  // received a ping.
  const lastExpiredTime = root.lastExpiredTime;
  // 一般情况下lastExpiredTime = NoWork
  if (lastExpiredTime !== NoWork) {
    return lastExpiredTime;
  }
  //“挂起”是指任何尚未提交的更新，包括是否已挂起。因此，“suspended”范围是一个子集。
  // "Pending" refers to any update that hasn't committed yet, including if it
  // suspended. The "suspended" range is therefore a subset.
  const firstPendingTime = root.firstPendingTime;
  // 判断root是否处于悬停时间，firstSuspendedTime >= firstPendingTime >= lastSuspendedTime
  if (!isRootSuspendedAtTime(root, firstPendingTime)) {
    // The highest priority pending time is not suspended. Let's work on that.
    //最高优先级挂起时间未挂起。让我们继续执行它。
    return firstPendingTime;
  }
  //如果第一个挂起时间已挂起，请检查是否存在我们知道的较低优先级挂起级别。或者检查我们是否收到ping。优先考虑哪个
  // If the first pending time is suspended, check if there's a lower priority
  // pending level that we know about. Or check if we received a ping. Work
  // on whichever is higher priority.
  const lastPingedTime = root.lastPingedTime;
  const nextKnownPendingLevel = root.nextKnownPendingLevel; // //挂起范围之后的下一个已知过期时间
  const nextLevel =
    lastPingedTime > nextKnownPendingLevel
      ? lastPingedTime
      : nextKnownPendingLevel;
  if (nextLevel <= Idle && firstPendingTime !== nextLevel) {
    //不要在空闲/从不优先的情况下工作，除非所有其他事情都已完成。
    // Don't work on Idle/Never priority unless everything else is committed.
    return NoWork;
  }
  return nextLevel;
}
```
