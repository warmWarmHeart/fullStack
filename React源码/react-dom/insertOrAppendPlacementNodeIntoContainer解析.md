# insertOrAppendPlacementNodeIntoContainer解析
遍历整个`Fiber`树，将所有的子Fiber的stateNode所代表的真实dom全部插入父节点中

## 源码
```javascript
// 将放置节点插入或附加到容器中
function insertOrAppendPlacementNodeIntoContainer(
  node: Fiber,
  before: ?Instance,
  parent: Container,
): void {
  const {tag} = node;
  // 判断节点是否是文本节点或者普通标签节点
  const isHost = tag === HostComponent || tag === HostText;
  // 基本成分组件基本成分组件
  if (isHost || (enableFundamentalAPI && tag === FundamentalComponent)) {
    const stateNode = isHost ? node.stateNode : node.stateNode.instance;
    // 有兄弟节点插入兄弟节点之前，否则插入container之中
    if (before) {
      //插入容器之前
      insertInContainerBefore(parent, stateNode, before);
    } else {
      // 将c元素插入container
      appendChildToContainer(parent, stateNode);
    }
  } else if (tag === HostPortal) {
    //如果插入本身是一个入口，那么我们不想遍历它的子级。相反，我们将直接从门户中的每个子项获取插入
    // If the insertion itself is a portal, then we don't want to traverse
    // down its children. Instead, we'll get insertions from each child in
    // the portal directly.
  } else {
    const child = node.child;
    if (child !== null) {
      //如果是组件节点的话，比如 ClassComponent，则找它的第一个子节点（DOM 元素），进行插入操作
      insertOrAppendPlacementNodeIntoContainer(child, before, parent);
      let sibling = child.sibling;
      // 循环插入组件节点的所有兄弟节点
      while (sibling !== null) {
        insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}
```

### insertInContainerBefore
```javascript

```

### appendChildToContainer

* 将所有dom元素挂载到容器元素上，从此以后真实dom就真实挂载在了html中

```javascript
function appendChildToContainer(
  container: Container,
  child: Instance | TextInstance,
): void {
  let parentNode;
  // 如果是容器节点类型注释的话 将child节点插入到 容器之前
  if (container.nodeType === COMMENT_NODE) {
    parentNode = (container.parentNode: any);
    parentNode.insertBefore(child, container);
  } else {
    // 否则，将子节点插入容器中
    parentNode = container;
    parentNode.appendChild(child);
  }
  //此容器可能用于门户。
  
  //如果门户中的某个内容被单击，则该单击将出现气泡  穿过反应树。然而，在移动Safari上，点击除非存在具有onclick事件的祖先，否则不要在*DOM*树中冒泡。这样我们就看不到它了。
  
  //这就是为什么我们要确保非React根容器定义了内联onclick。
  // This container might be used for a portal.
  // If something inside a portal is clicked, that click should bubble
  // through the React tree. However, on Mobile Safari the click would
  // never bubble through the *DOM* tree unless an ancestor with onclick
  // event exists. So we wouldn't see it and dispatch it.
  // This is why we ensure that non React root containers have inline onclick
  // defined.
  // https://github.com/facebook/react/issues/11918
  const reactRootContainer = container._reactRootContainer;
  if (
    (reactRootContainer === null || reactRootContainer === undefined) &&
    parentNode.onclick === null
  ) {
    // TODO: This cast may not be sound for SVG, MathML or custom elements.
    trapClickOnNonInteractiveElement(((parentNode: any): HTMLElement));
  }
}
```
