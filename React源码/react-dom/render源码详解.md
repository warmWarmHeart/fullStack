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

### createElement
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
### ReactElement
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

### `render`
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

### legacyCreateRootFromDOMContainer
* 创建 `FiberRoot`和`HostRootFiber`,且将`FiberRoot`的`current`指向`HostRootFiber`，而`HostRootFiber`的`stateNode`又指回`FiberRoot`

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

#### `createLegacyRoot`
* 会调用`ReactDOMBlockingRoot`函数，`ReactDOMBlockingRoot`函数又会调用`createRootImpl`, 接下来看`createRootImpl`函数
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

##### `createContainer`
* `createContainer`调用了`createFiberRoot`, 生成一个`FiberRoot`对象
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
###### `FiberRootNode`
* 生成一个FiberRoot对象
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

######`createHostRootFiber`
 * 创建一个`tag`为 `HostRoot`、`mode`为`NoMode`的Fiber对象
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

###### `createFiber`
 * 创建一个`Fiber`对象
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

##### `initializeUpdateQueue`
* 给 `fiber` 增加一个 `UpdateQueue`, 该属性上会记录该fiber对应的组件的所有副作用和更改
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

### 执行 `unbatchedUpdates`函数
* 标记一下`executionContext`执行上下文为`LegacyUnbatchedContext`，也就是非批量上下文的意思（每一个阶段的`executionContext`值都不一样）
* 紧接着执行传进来的`fn`回调函数，在`render`中`fn`就是`updateContainer`函数，执行完`updateContainer`后会根据`executionContext`是否等于`NoContext`,如果相等则执行`flushSyncCallbackQueue`
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

#### `requestCurrentTimeForUpdate`
 * 计算 `currentTime`
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

#### `msToExpirationTime` 
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

##### `now`
* 计算程序运行开始到需要获取一个时间戳的中间查值
```javascript
//initialTimeMs 是在程序运行之初用Scheduler_now()获取到的一个时间差 initialTimeMs小于10秒，就取Scheduler_now(), 大于10秒就取当前时间到initialTimeMs设置那一刻中间的时间差
export const now = initialTimeMs < 10000 ? Scheduler_now : () => Scheduler_now() - initialTimeMs;
```

##### `getCurrentTime`
* 也就是上面的 `Scheduler_now` 获取程序运行开始到执行`Scheduler_now`的中间的时间差
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

##### `computeAsyncExpiration`
* 算出一个比`currnetTime`大概小500毫秒的数值
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

##### `createUpdate`函数
* 创建一个`Update`对象。`Update`对象就是用来描述react组件的各种更新的对象，比如创建dom后的安置、取代旧dom、移除等更新都会绑定一个`Update`对象
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

### `enqueueUpdate`
* 函数用来将新创建的`update`对象放到Fiber的`UpdateQueue`对象的`share.pending`上，此处的Fiber为`HostRootFiber`
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

### `scheduleUpdateOnFiber`函数
* [参考文档](scheduleUpdateOnFiber解析.md)

* 通过调度`Scheduler`更新fiber，此处是更新创建好的`HostRootFiber`。
调度相关文档可以[参考这里](../调度scheduler/readme.md)



### `ensureRootIsScheduled`函数
 * 这里是真正的调度入口，内部包含了对`App`React组件下所有`chillren`相关Fiber的创建绑定，及各种Hooks相关`effect`的创建绑定以及`update`的创建绑定，也有对子组件下面render函数真实dom的创建绑定，还有各种生命周期的执行，最后渲染整个真实dom的过程
[ensureRootIsScheduled的真正解读](./ensureRootIsScheduled解读.md)

