# commitMutationEffects 解读

```javascript
function commitMutationEffects(root: FiberRoot, renderPriorityLevel) {
  //TODO:可能应该将此函数的大部分移到commitWork。
  // TODO: Should probably move the bulk of this function to commitWork.

  //循环 effect 链
  while (nextEffect !== null) {
    const effectTag = nextEffect.effectTag;

    //如果有文字节点，则将value 置为''
    if (effectTag & ContentReset) {
      // 提交重置文本内容
      commitResetTextContent(nextEffect);
    }

    // 将 ref 的指向置为 null
    if (effectTag & Ref) {
      const current = nextEffect.alternate;
      if (current !== null) {
        commitDetachRef(current);
      }
    }

    //下面的switch语句只关心放置、更新和删除。为了避免为每个可能的位图值添加一个大小写，我们从effect标记中移除次要效果并打开该值。
    // The following switch statement is only concerned about placement,
    // updates, and deletions. To avoid needing to add a case for every possible
    // bitmap value, we remove the secondary effects from the effect tag and
    // switch on that value.

    // 先是Placement(替换/新增)、Update(更新) 和Deletion(删除) 三者之间的或操作，相当于把三者合并在了一起。然后将其和effectTag进行与操作，从而得到不同的集合，如「增/删/改」和「增改」
    let primaryEffectTag =
      effectTag & (Placement | Update | Deletion | Hydrating);
    switch (primaryEffectTag) {
      case Placement: {
        //针对该节点及子节点进行插入操作
        commitPlacement(nextEffect);
        //清除effect标签中的“placement”，这样我们就知道在调用componentDidMount之类的任何生命周期之前，已经插入了它。
        //待办事项：findDOMNode不再依赖于此，但isMounted确实依赖于此，isMounted无论如何都不推荐使用，因此我们应该能够终止此操作。
        // Clear the "placement" from effect tag so that we know that this is
        // inserted, before any life-cycles like componentDidMount gets called.
        // TODO: findDOMNode doesn't rely on this any more but isMounted does
        // and isMounted is deprecated anyway so we should be able to kill this.
        nextEffect.effectTag &= ~Placement;
        break;
      }
      case PlacementAndUpdate: {
        // Placement
        //针对该节点及子节点进行插入操作
        commitPlacement(nextEffect);
        //清除effect标签中的“placement”，这样我们就知道在调用componentDidMount之类的任何生命周期之前，已经插入了它。
        // Clear the "placement" from effect tag so that we know that this is
        // inserted, before any life-cycles like componentDidMount gets called.
        nextEffect.effectTag &= ~Placement;

        // Update
        const current = nextEffect.alternate;
        //对 DOM 节点上的属性进行更新
        commitWork(current, nextEffect);
        break;
      }
      case Hydrating: {
        nextEffect.effectTag &= ~Hydrating;
        break;
      }
      case HydratingAndUpdate: {
        nextEffect.effectTag &= ~Hydrating;

        // Update
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      case Update: {
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      case Deletion: {
        //删除节点
        commitDeletion(root, nextEffect, renderPriorityLevel);
        break;
      }
    }

    // TODO: Only record a mutation effect if primaryEffectTag is non-zero.
    recordEffect();

    resetCurrentDebugFiberInDEV();
    nextEffect = nextEffect.nextEffect;
  }
}
```

### commitPlacement
替换或者新增

```javascript
// 替换或者新增
function commitPlacement(finishedWork: Fiber): void {
  if (!supportsMutation) {
    return;
  }
  //向上循环祖先节点，返回是 DOM 元素的父节点
  //递归地将所有主机节点插入父节点。
  // Recursively insert all host nodes into the parent.
  const parentFiber = getHostParentFiber(finishedWork);

    //注意：这两个变量必须一起更新。
  // Note: these two variables *must* always be updated together.
  let parent;
  let isContainer; // 判断当前节点对应的真实dom元素是否是 外部容器元素
  const parentStateNode = parentFiber.stateNode;
  //判断父节点的类型
  switch (parentFiber.tag) {
    //如果是 DOM 元素的话
    case HostComponent:
      //获取对应的 DOM 节点
      parent = parentStateNode;
      isContainer = false;
      break;
    //如果是 fiberRoot 节点的话，
    case HostRoot:
      parent = parentStateNode.containerInfo;
      isContainer = true;
      break;
    //React.createportal 节点的更新
    case HostPortal:
      parent = parentStateNode.containerInfo;
      isContainer = true;
      break;
    case FundamentalComponent:
      if (enableFundamentalAPI) {
        parent = parentStateNode.instance;
        isContainer = false;
      }
    // eslint-disable-next-line-no-fallthrough
    default:
      invariant(
        false,
        'Invalid host parent fiber. This error is likely caused by a bug ' +
          'in React. Please file an issue.',
      );
  }
  //如果父节点是文本节点
  
  // 内容重置
  if (parentFiber.effectTag & ContentReset) {
    //在进行任何插入操作前，需要先将 value 置为 ''
    // Reset the text content of the parent before doing any insertions
    resetTextContent(parent);
    //再清除掉 ContentReset 这个 effectTag
    // Clear ContentReset from the effect tag
    parentFiber.effectTag &= ~ContentReset;
  }
  //查找插入节点的位置，也就是获取它后一个 DOM 兄弟节点的位置
  const before = getHostSibling(finishedWork);
  //我们只插入了顶部的fiber，但是我们需要递归它的子节点来找到所有的终端节点。
  // We only have the top Fiber that was inserted but we need to recurse down its
  // children to find all the terminal nodes.
 
  if (isContainer) {
    // 将放置节点插入或附加到容器中
    // 第一次代码会先进入到这里，before为null parent为 container容器dom元素
    insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent);
  } else {
    // 插入或附加放置节点
    insertOrAppendPlacementNode(finishedWork, before, parent);
  }
}
```
#### insertOrAppendPlacementNodeIntoContainer
[参考文档](insertOrAppendPlacementNodeIntoContainer解析.md)
