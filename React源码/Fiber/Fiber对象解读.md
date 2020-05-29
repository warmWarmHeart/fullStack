# Fiber对象
看这篇解读前可以先在你的React项目的浏览器控制台执行下面语句，便可以查看你页面某个元素对应的React中Fibe对象

```javascript
// app 是 想看的一个元素Id，也可以换成别的
console.log(document.getElementById('app')._reactRootContainer._internalRoot.current)
```
## Fiber对象详细属性介绍
```javascript
export type Fiber = {|
  // These first fields are conceptually members of an Instance. This used to
  // be split into a separate type and intersected with the other Fiber fields,
  // but until Flow fixes its intersection bugs, we've merged them into a
  // single type.

  // An Instance is shared between all versions of a component. We can easily
  // break this out into a separate object to avoid copying so much to the
  // alternate versions of the tree. We put this on a single object for now to
  // minimize the number of objects created during the initial render.
  //这些第一个字段在概念上是实例的成员。这曾经被分成一个单独的类型，并与其他光纤场相交，但在Flow修复其相交错误之前，我们将它们合并为一个单独的类型。

  //实例在组件的所有版本之间共享。我们可以很容易地将其分解为一个单独的对象，以避免将如此多的内容复制到树的其他版本。现在，我们将其放在单个对象上，以最小化在初始渲染期间创建的对象数
  // Tag identifying the type of fiber.
  // 标记不同的组件类型
  // FiberNode的类型，可以在packages/shared/ReactTypeOfWork.js中找到。当前文章 demo 可以看到ClassComponent、HostRoot、HostComponent、HostText这几种

  tag: WorkTag,

  // Unique identifier of this child.
  // ReactElement里面的key
  key: null | string,

  // The value of element.type which is used to preserve the identity during
  // reconciliation of this child.
  // ReactElement.type，也就是我们调用`createElement`的第一个参数
  elementType: any,
  // 异步组件resolved之后返回的内容，一般是`function`或者`class`
  // The resolved function/class/ associated with this fiber.
  type: any, // 在beginWork的时候会调用这里 和ReactElement表现一致

  // FiberNode会通过stateNode绑定一些其他的对象，例如FiberNode对应的Dom、FiberRoot、ReactComponent实例
  // renderWithHooks的时候会绑定ReactComponent，且在stateNode的_reactInternalFiber属性 指向fiber自己（adoptClassInstance函数设置）
  stateNode: any, // cacheContext会保存instance.__reactInternalMemoizedUnmaskedChildContext = unmaskedContext;
                  // instance.__reactInternalMemoizedMaskedChildContext = maskedContext;

  // Conceptual aliases
  // parent : Instance -> return The parent happens to be the same as the
  // return fiber since we've merged the fiber and instance.

  // Remaining fields belong to Fiber

  // The Fiber to return to after finishing processing this one.
  // This is effectively the parent, but there can be multiple parents (two)
  // so this is only the parent of the thing we're currently processing.
  // It is conceptually the same as the return address of a stack frame.
  // 指向他在Fiber节点树中的`parent`，用来在处理完这个节点之后向上返回
  return: Fiber | null,

  // Singly Linked List Tree Structure.
  // 单链表树结构
  // 指向自己的第一个子节点
  child: Fiber | null, // 类组件构造函数child指向通过执行类组件render后返回的reactElement所代表的的Fiber对象，函数组件则是指向通过构造函数执行后return的reactElement所代表的Fiber对象
  // 指向自己的兄弟结构
  // 兄弟节点的return指向同一个父节点
  sibling: Fiber | null,
  index: number,

  // The ref last used to attach this node.
  // I'll avoid adding an owner field for prod and model that as functions.
  // ref属性
  ref:
    | null
    | (((handle: mixed) => void) & {_stringRef: ?string, ...})
    | RefObject,

  // Input is the data coming into process this fiber. Arguments. Props.
  // 新的变动带来的新的props
  pendingProps: any, // This type will be more specific once we overload the tag.
  // 上一次渲染完成之后的props
  memoizedProps: any, // The props used to create the output.

  // A queue of state updates and callbacks.
  // 该Fiber对应的组件产生的Update会存放在这个队列里面
  updateQueue: UpdateQueue<any> | null,

  // The state used to create the output
  // 上一次渲染的时候的state
  // HostRoot设置为{element: React$Element}, 带有hook钩子的时候是通过mountWorkInProgressHook创建的一个hook对象，
  // hook的next是一个通过useState/useEffect等创建的一个链表
  memoizedState: any,
  //一个列表，存在该Fiber依赖的contexts，events
  // Dependencies (contexts, events) for this fiber, if it has any
  dependencies: Dependencies | null,

  // Bitfield that describes properties about the fiber and its subtree. E.g.
  // the ConcurrentMode flag indicates whether the subtree should be async-by-
  // default. When a fiber is created, it inherits the mode of its
  // parent. Additional flags can be set at creation time, but after that the
  // value should remain unchanged throughout the fiber's lifetime, particularly
  // before its child fibers are created.
  // 用来描述当前Fiber和他子树的`Bitfield`
  // 共存的模式表示这个子树是否默认是异步渲染的
  // Fiber被创建的时候他会继承父Fiber
  // 其他的标识也可以在创建的时候被设置
  // 但是在创建之后不应该再被修改，特别是他的子Fiber创建之前
  mode: TypeOfMode,

  // Effect
  // 用来记录Side Effect(副作用)
  //副作用是 标记组件哪些需要更新的工具、标记组件需要执行哪些生命周期的工具
  // effectTag 代表了 Fiber 节点做了怎样的变更
  // React DevTools 会用到此属性
  effectTag: SideEffectTag,

  // Singly linked list fast path to the next fiber with side-effects.
  // 单链表用来快速查找下一个side effect Fiber
  nextEffect: Fiber | null,

  // The first and last fiber with side-effect within this subtree. This allows
  // us to reuse a slice of the linked list when we reuse the work done within
  // this fiber.
  // 子树中第一个side effect Fiber
  firstEffect: Fiber | null,
  // 子树中最后一个side effect Fiber
  lastEffect: Fiber | null,

  // Represents a time in the future by which this work should be completed.
  // Does not include work found in its subtree.
  // 代表任务在未来的哪个时间点内应该被完成
  // 不包括他的子树产生的任务
  expirationTime: ExpirationTime, // 会在renderWithHooks和beginWork执行开始的时候的时候设置为NoWork 清除“挂起的更新优先级”。

  // This is used to quickly determine if a subtree has no pending changes.
  // 快速确定子树中是否有不在等待的变化
  //快速确定子树中是否有 update
  //如果子节点有update的话，就记录应该更新的时间
  childExpirationTime: ExpirationTime,

  // This is a pooled version of a Fiber. Every fiber that gets updated will
  // eventually have a pair. There are cases when we can clean up pairs to save
  // memory if we need to.
  // 在Fiber树更新的过程中，每个Fiber都会有一个跟其对应的Fiber（备胎）
  // 我们称他为`current <==> workInProgress`
  // 在渲染完成之后他们会交换位置
  // fiber对象是新时代的虚拟DOM，它是用来承载着组件实例与真实DOM等重要数据。
  // 这些重要数据在更新过程是不需要重新生成的。但React希望能像git那样按分支开发，遇错回滚。
  // alternate就是这个备胎
  alternate: Fiber | null,

  // Time spent rendering this Fiber and its descendants for the current update.
  // This tells us how well the tree makes use of sCU for memoization.
  // It is reset to 0 each time we render and only updated when we don't bailout.
  // This field is only set when the enableProfilerTimer flag is enabled.
  // 下面是调试相关的，收集每个Fiber和子树渲染时间的
  actualDuration?: number,

  // If the Fiber is currently active in the "render" phase,
  // This marks the time at which the work began.
  // This field is only set when the enableProfilerTimer flag is enabled.
  actualStartTime?: number,

  //此光纤最近渲染时间的持续时间。
  //当我们出于备忘目的进行紧急救援时，此值不会更新。
  //此字段仅在启用enableProfilerTimer标志时设置。
  // Duration of the most recent render time for this Fiber.
  // This value is not updated when we bailout for memoization purposes.
  // This field is only set when the enableProfilerTimer flag is enabled.
  selfBaseDuration?: number,

  // Sum of base times for all descendants of this Fiber.
  // This value bubbles up during the "complete" phase.
  // This field is only set when the enableProfilerTimer flag is enabled.
  treeBaseDuration?: number,
|};
```
