# context解析

```javascript
function createContext<T>(
  defaultValue: T,
  //使用Object.is()计算新老context的差异
  calculateChangedBits: ?(a: T, b: T) => number,
): ReactContext<T> {
  if (calculateChangedBits === undefined) {
    calculateChangedBits = null;
  } else {
  }

  const context: ReactContext<T> = {
    //还是那句话，ReactContext中的$$typeof是
    // 作为createElement中的属性type中的对象进行存储的，并不是ReactElement的$$typeof
    // $$typeof: REACT_PROVIDER_TYPE,一个symbol标志位，react中很多对象都会有这样一个唯一的symbol属性，只是为了提供在react-dom中做更新操作的时候能更好的区分和判断类型
    $$typeof: REACT_CONTEXT_TYPE,
    _calculateChangedBits: calculateChangedBits,
    //作为支持多个并发渲染器的解决方法，我们将一些渲染器分类为主要渲染器，而将其他渲染器分类为次要渲染器。
    // 我们只希望最多有两个并发渲染器：React Native（primary）和Fabric（secondary）；
    // React DOM（primary）和React ART（secondary）。辅助呈现程序将其上下文值存储在单独的字段中。
    // As a workaround to support multiple concurrent renderers, we categorize
    // some renderers as primary and others as secondary. We only expect
    // there to be two concurrent renderers at most: React Native (primary) and
    // Fabric (secondary); React DOM (primary) and React ART (secondary).
    // Secondary renderers store their context values on separate fields.
    
    //也就是说_currentValue和_currentValue2作用是一样的，只是分别给主渲染器和辅助渲染器使用

    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    //用来追踪该context的并发渲染器的数量
    //用于跟踪此上下文当前在单个呈现程序中支持多少个并发呈现程序。例如并行服务器渲染。
    // Used to track how many concurrent renderers this context currently
    // supports within in a single renderer. Such as parallel server rendering.
    _threadCount: 0,
    // These are circular
    // Provider 的属性是一个$$typeof: REACT_PROVIDER_TYPE,一个symbol标志位，react中很多对象都会有这样一个唯一的symbol属性，只是为了提供在react-dom中做更新操作的时候能更好的区分和判断类型
    // Concumer：把context整个对象都赋值给了它
    Provider: (null: any),
    Consumer: (null: any),
  };

  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };
  //const obj={}
  //obj.consumer=obj
  //也就是Consumber对象指向React.Context对象

  //在<Consumer>进行渲染时，为了保证Consumer拿到最新的值，
  //直接让Consumer=React.Context，
  // React.Context中的_currentValue已经被<Provider>的value给赋值了
  //所以Consumer能立即拿到最新的值
  context.Consumer = context;

  return context;
}
```
