# UpdateQueue属性详解

* 每个React组件都对应于一个`Fiber`对象，`Fiber`对象详细信息[参考文档](../Fiber/Fiber对象解读.md)

```javascript
// processUpdateQueue函数执行函数中 会取shared.pending然后放在firstBaseUpdate上（firstBaseUpdate为空）  或者当firstBaseUpdate不为空的时候放在lastBaseUpdate.next上
export type UpdateQueue<State> = {|
  // 在组件setState后，渲染并更新state，在下次更新时，拿的就是这次更新过的state
  baseState: State,// 表示更新前的基础状态
  // firstUpdate和lastUpdate之间的update通过上个update的next串联
  firstBaseUpdate: Update<State> | null, //第一个 Update 对象引用，总体是一条单链表
  lastBaseUpdate: Update<State> | null, // 最后一个 Update 对象引用
 // 放置所有还未执行的、正在处于等待状态的update
  shared: SharedQueue<State>,
  //effect 链表。里面存放的就是之前各个 Update 的 callback，通常就来源于setState的第二个参数，或者是ReactDom.render的 callback。在执行完上面的生命周期函数后，就开始遍历这个 effect 链表，把 callback 都执行一次。
  effects: Array<Update<State>> | null, // React Hook  Effect中的update
|};
```
