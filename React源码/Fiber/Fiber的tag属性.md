# Fiber之`tag`属性

## 根`root`的`tag`
```
const LegacyRoot = 0; // 传统root 默认是传统root
const BlockingRoot = 1; // 阻塞root
const ConcurrentRoot = 2; // 并发root
```

## 根`root`除外的其他`Fiber`的`tag`
```javascript
const FunctionComponent = 0; // 函数组件
const ClassComponent = 1; // 类组件
const IndeterminateComponent = 2; // Before we know whether it is function or class //在我们知道它是函数还是类之前
const HostRoot = 3; ////主机树的根
const HostPortal = 4; //子树。可能是其他渲染器的入口点。
const HostComponent = 5; // 在 DOM 环境中就是 DOM 节点，例如 div
const HostText = 6;//文本
const Fragment = 7; // 片段
const Mode = 8; // 模式
const ContextConsumer = 9;//上下文使用者
const ContextProvider = 10; //上下文提供程序
const ForwardRef = 11;//向前参考
const Profiler = 12; // 配置文件, 档案, 概况 分析器
const SuspenseComponent = 13; // 悬念组件
const MemoComponent = 14; // memo包含的组件
const SimpleMemoComponent = 15; // 简单memo组件
const LazyComponent = 16; // 懒组件
const IncompleteClassComponent = 17; // 不完全类组件
const DehydratedFragment = 18; // 脱水碎片   服务端渲染
const SuspenseListComponent = 19; // 暂停列表组件
const FundamentalComponent = 20; // 基本成分组件
const ScopeComponent = 21; // 范围组件
const Block = 22; // 块
```
