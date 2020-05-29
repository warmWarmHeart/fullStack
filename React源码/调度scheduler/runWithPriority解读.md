# `runWithPriority`函数
* 在 `eventHandler`执行之前初始化 `currentPriorityLevel`为`NormalPriority`
* 执行`eventHandler`
* 执行完`eventHandler`后再恢复`currentPriorityLevel`为以前的值
```javascript
function unstable_runWithPriority(priorityLevel, eventHandler) {
  // 默认priorityLevel设置为NormalPriority
  switch (priorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
    case LowPriority:
    case IdlePriority:
      break;
    default:
      priorityLevel = NormalPriority;
  }

  // currentPriorityLevel 默认为NormalPriority
  var previousPriorityLevel = currentPriorityLevel; // 将外侧任务的优先级保存为currentPriorityLevel，方便unstable_scheduleCallback调用的时候对优先级的使用
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    // 还原currentPriorityLevel 默认为NormalPriority
    currentPriorityLevel = previousPriorityLevel;
  }
}
```
