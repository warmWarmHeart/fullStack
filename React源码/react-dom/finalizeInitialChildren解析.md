# finalizeInitialChildren
## 步骤分析
* 根据真实dom元素的标签名做关于事件Event的绑定等动作，
* 为dom元素绑定props中的各种属性，包括：style、nodeValue、textContent等等

## 源码
```javascript
function finalizeInitialChildren(
  domElement: Instance,
  type: string,
  props: Props,
  rootContainerInstance: Container,
  hostContext: HostContext,
): boolean {
  setInitialProperties(domElement, type, props, rootContainerInstance);
  return shouldAutoFocusHostComponent(type, props);
}
```

## setInitialProperties
* 为dom设置默认属性，包含事件属性

```javascript
function setInitialProperties(
  domElement: Element,
  tag: string,
  rawProps: Object,
  rootContainerElement: Element | Document,
): void {
  const isCustomComponentTag = isCustomComponent(tag, rawProps);

  // TODO: Make sure that we check isMounted before firing any of these events.
  let props: Object;
  switch (tag) {
    case 'iframe':
    case 'object':
    case 'embed':
        // enableModernEventSystem为false 所以会执行legacyTrapBubbledEvent
      if (!enableModernEventSystem) {
        legacyTrapBubbledEvent(TOP_LOAD, domElement);
      }
      props = rawProps;
      break;
    case 'video':
    case 'audio':
      if (!enableModernEventSystem) {
        // Create listener for each media event
        for (let i = 0; i < mediaEventTypes.length; i++) {
          legacyTrapBubbledEvent(mediaEventTypes[i], domElement);
        }
      }
      props = rawProps;
      break;
    case 'source':
      if (!enableModernEventSystem) {
        legacyTrapBubbledEvent(TOP_ERROR, domElement);
      }
      props = rawProps;
      break;
    case 'img':
    case 'image':
    case 'link':
      if (!enableModernEventSystem) {
        legacyTrapBubbledEvent(TOP_ERROR, domElement);
        legacyTrapBubbledEvent(TOP_LOAD, domElement);
      }
      props = rawProps;
      break;
    case 'form':
      if (!enableModernEventSystem) {
        legacyTrapBubbledEvent(TOP_RESET, domElement);
        legacyTrapBubbledEvent(TOP_SUBMIT, domElement);
      }
      props = rawProps;
      break;
    case 'details':
      if (!enableModernEventSystem) {
        legacyTrapBubbledEvent(TOP_TOGGLE, domElement);
      }
      props = rawProps;
      break;
    case 'input':
      ReactDOMInputInitWrapperState(domElement, rawProps);
      props = ReactDOMInputGetHostProps(domElement, rawProps);
      if (!enableModernEventSystem) {
        legacyTrapBubbledEvent(TOP_INVALID, domElement);
      }
      //对于受控组件，我们始终需要确保我们在倾听一旦改变。即使没有听众。
      // For controlled components we always need to ensure we're listening
      // to onChange. Even if there is no listener.
      ensureListeningTo(rootContainerElement, 'onChange');
      break;
    case 'option':
      ReactDOMOptionValidateProps(domElement, rawProps);
      props = ReactDOMOptionGetHostProps(domElement, rawProps);
      break;
    case 'select':
      ReactDOMSelectInitWrapperState(domElement, rawProps);
      props = ReactDOMSelectGetHostProps(domElement, rawProps);
      if (!enableModernEventSystem) {
        legacyTrapBubbledEvent(TOP_INVALID, domElement);
      }
      // For controlled components we always need to ensure we're listening
      // to onChange. Even if there is no listener.
      ensureListeningTo(rootContainerElement, 'onChange');
      break;
    case 'textarea':
      ReactDOMTextareaInitWrapperState(domElement, rawProps);
      props = ReactDOMTextareaGetHostProps(domElement, rawProps);
      if (!enableModernEventSystem) {
        legacyTrapBubbledEvent(TOP_INVALID, domElement);
      }
      // For controlled components we always need to ensure we're listening
      // to onChange. Even if there is no listener.
      ensureListeningTo(rootContainerElement, 'onChange');
      break;
    default:
      props = rawProps;
  }

  // 判定props有没有效 ,比如闭合标签不允许有children属性等等
  assertValidProps(tag, props);

// 为dom元素绑定各种props上的属性
  setInitialDOMProperties(
    tag,
    domElement,
    rootContainerElement,
    props,
    isCustomComponentTag,
  );

  switch (tag) {
    case 'input':
      // TODO: Make sure we check if this is still unmounted or do any clean
      // up necessary since we never stop tracking anymore.
      track((domElement: any));
      ReactDOMInputPostMountWrapper(domElement, rawProps, false);
      break;
    case 'textarea':
      // TODO: Make sure we check if this is still unmounted or do any clean
      // up necessary since we never stop tracking anymore.
      track((domElement: any));
      ReactDOMTextareaPostMountWrapper(domElement, rawProps);
      break;
    case 'option':
      ReactDOMOptionPostMountWrapper(domElement, rawProps);
      break;
    case 'select':
      ReactDOMSelectPostMountWrapper(domElement, rawProps);
      break;
    default:
      if (typeof props.onClick === 'function') {
        // TODO: This cast may not be sound for SVG, MathML or custom elements.
        trapClickOnNonInteractiveElement(((domElement: any): HTMLElement));
      }
      break;
  }
}
```

### setInitialDOMProperties
* 为dom元素绑定各种props上的属性

```javascript
function setInitialDOMProperties(
  tag: string,
  domElement: Element,
  rootContainerElement: Element | Document,
  nextProps: Object,
  isCustomComponentTag: boolean,
): void {
  for (const propKey in nextProps) {
    if (!nextProps.hasOwnProperty(propKey)) {
      continue;
    }
    const nextProp = nextProps[propKey];
    if (propKey === STYLE) {
        //依赖于“updateStylesByID”而不是“styleUpdates”。
      // Relies on `updateStylesByID` not mutating `styleUpdates`.
      // 为dom元素设置style属性
      setValueForStyles(domElement, nextProp);
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) { 
       // propKey === `dangerouslySetInnerHTML`
      const nextHtml = nextProp ? nextProp[HTML] : undefined;
      if (nextHtml != null) {
        setInnerHTML(domElement, nextHtml);
      }
    } else if (propKey === CHILDREN) {
        // 属性名是children的话 给dom设置文本内容
      if (typeof nextProp === 'string') {
        // Avoid setting initial textContent when the text is empty. In IE11 setting
        // textContent on a <textarea> will cause the placeholder to not
        // show within the <textarea> until it has been focused and blurred again.
        // https://github.com/facebook/react/issues/6731#issuecomment-254874553
        const canSetTextContent = tag !== 'textarea' || nextProp !== '';
        if (canSetTextContent) {
          setTextContent(domElement, nextProp);
        }
      } else if (typeof nextProp === 'number') {
        setTextContent(domElement, '' + nextProp);
      }
    } else if (
      (enableDeprecatedFlareAPI && propKey === DEPRECATED_flareListeners) ||
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING    
    ) {
        // 悬停有关的属性
      // Noop
    } else if (propKey === AUTOFOCUS) {
      // 属性名是 autoFocus  
      
      //我们在提交时在客户身上单独填写。
      //我们本可以在属性列表中排除它，而不是在这里添加一个特殊的大小写，但这样它就不会在服务器呈现时发出（但我们*确实*希望在SSR中发出它）。
      // We polyfill it separately on the client during commit.
      // We could have excluded it in the property list instead of
      // adding a special case here, but then it wouldn't be emitted
      // on server rendering (but we *do* want to emit it in SSR).
    } else if (registrationNameModules.hasOwnProperty(propKey)) {
        // *从注册名到插件模块的映射
      
      if (nextProp != null) {
        ensureListeningTo(rootContainerElement, propKey);
      }
    } else if (nextProp != null) {
      setValueForProperty(domElement, propKey, nextProp, isCustomComponentTag);
    }
  }
}
```
##### DANGEROUSLY_SET_INNER_HTML: dangerouslySetInnerHTML
* 使用react开发前端项目，我们常会遇到需要在一个dom里直接筛入一段纯html(后端给的)的需求，比如我们的编辑器，文章的初始内容是一段通过ajax获取的html。当然这么一个常见的需求，react当然帮你想好了解决方案，那就是dangerouslySetInnerHTML

* 该属性的用法如下：
    ```javascript
    dangerouslySetInnerHTML={{ __html: content }}
    ```
#### setValueForProperty
````javascript
function setValueForProperty(
  node: Element,
  name: string,
  value: mixed,
  isCustomComponentTag: boolean,
) {
  const propertyInfo = getPropertyInfo(name);
  if (shouldIgnoreAttribute(name, propertyInfo, isCustomComponentTag)) {
    return;
  }
  if (shouldRemoveAttribute(name, value, propertyInfo, isCustomComponentTag)) {
    value = null;
  }
  //如果prop不在特殊列表中，则将其视为简单属性。
 
  // If the prop isn't in the special list, treat it as a simple attribute.
  if (isCustomComponentTag || propertyInfo === null) {
    if (isAttributeNameSafe(name)) {
      const attributeName = name;
      if (value === null) {
        node.removeAttribute(attributeName);
      } else {
        node.setAttribute(
          attributeName,
          enableTrustedTypesIntegration ? (value: any) : '' + (value: any),
        );
      }
    }
    return;
  }
  const {mustUseProperty} = propertyInfo;
  if (mustUseProperty) {
    const {propertyName} = propertyInfo;
    if (value === null) {
      const {type} = propertyInfo;
      (node: any)[propertyName] = type === BOOLEAN ? false : '';
    } else {
      // Contrary to `setAttribute`, object properties are properly
      // `toString`ed by IE8/9.
      (node: any)[propertyName] = value;
    }
    return;
  }
  // The rest are treated as attributes with special cases.
  const {attributeName, attributeNamespace} = propertyInfo;
  if (value === null) {
    node.removeAttribute(attributeName);
  } else {
    const {type} = propertyInfo;
    let attributeValue;
    if (type === BOOLEAN || (type === OVERLOADED_BOOLEAN && value === true)) {
      // If attribute type is boolean, we know for sure it won't be an execution sink
      // and we won't require Trusted Type here.
      attributeValue = '';
    } else {
      // `setAttribute` with objects becomes only `[object]` in IE8/9,
      // ('' + value) makes it output the correct toString()-value.
      if (enableTrustedTypesIntegration) {
        attributeValue = (value: any);
      } else {
        attributeValue = '' + (value: any);
      }
      if (propertyInfo.sanitizeURL) {
        sanitizeURL(attributeValue.toString());
      }
    }
    if (attributeNamespace) {
      node.setAttributeNS(attributeNamespace, attributeName, attributeValue);
    } else {
      node.setAttribute(attributeName, attributeValue);
    }
  }
}

````
### shouldAutoFocusHostComponent
*只有标签名是以下几种（`button input select textarea`），才可以根据其autoFocus属性判断是否要自动获取焦点
```javascript
function shouldAutoFocusHostComponent(type: string, props: Props): boolean {
  switch (type) {
    case 'button':
    case 'input':
    case 'select':
    case 'textarea':
      return !!props.autoFocus;
  }
  return false;
}
```

### legacyTrapBubbledEvent
```javascript
function legacyTrapBubbledEvent(
  topLevelType: DOMTopLevelEventType,
  element: Document | Element,
  listenerMap?: ElementListenerMap,
): void {
  const listener = addTrappedEventListener(element, topLevelType, false);
  if (listenerMap) {
    listenerMap.set(topLevelType, {passive: undefined, listener});
  }
}
```

#### addTrappedEventListener
```javascript
function addTrappedEventListener(
  targetContainer: EventTarget,
  topLevelType: DOMTopLevelEventType,
  capture: boolean,
  isDeferredListenerForLegacyFBSupport?: boolean,
  passive?: boolean,
  priority?: EventPriority,
): any => void {
  const eventPriority =
    priority === undefined
      ? getEventPriorityForPluginSystem(topLevelType)
      : priority;
  let listener;
  let listenerWrapper;
  switch (eventPriority) {
    case DiscreteEvent:
      listenerWrapper = dispatchDiscreteEvent;
      break;
    case UserBlockingEvent:
      listenerWrapper = dispatchUserBlockingUpdate;
      break;
    case ContinuousEvent:
    default:
      listenerWrapper = dispatchEvent;
      break;
  }
  // If passive option is not supported, then the event will be
  // active and not passive.
  if (passive === true && !passiveBrowserEventsSupported) {
    passive = false;
  }
  const eventSystemFlags =
    enableLegacyFBSupport && isDeferredListenerForLegacyFBSupport
      ? PLUGIN_EVENT_SYSTEM | LEGACY_FB_SUPPORT
      : PLUGIN_EVENT_SYSTEM;

  listener = listenerWrapper.bind(
    null,
    topLevelType,
    eventSystemFlags,
    targetContainer,
  );

  // When the targetContainer is null, it means that the container
  // target is null, but really we need a real DOM node to attach to.
  // In this case, we fallback to the "document" node, but leave the
  // targetContainer (which is bound in the above function) to null.
  // Really, this only happens for TestUtils.Simulate, so when we
  // remove that support, we can remove this block of code.
  if (targetContainer === null) {
    targetContainer = document;
  }

  targetContainer =
    enableLegacyFBSupport && isDeferredListenerForLegacyFBSupport
      ? (targetContainer: any).ownerDocument
      : targetContainer;

  const rawEventName = getRawEventName(topLevelType);

  let unsubscribeListener;
  // When legacyFBSupport is enabled, it's for when we
  // want to add a one time event listener to a container.
  // This should only be used with enableLegacyFBSupport
  // due to requirement to provide compatibility with
  // internal FB www event tooling. This works by removing
  // the event listener as soon as it is invoked. We could
  // also attempt to use the {once: true} param on
  // addEventListener, but that requires support and some
  // browsers do not support this today, and given this is
  // to support legacy code patterns, it's likely they'll
  // need support for such browsers.
  if (enableLegacyFBSupport && isDeferredListenerForLegacyFBSupport) {
    const originalListener = listener;
    listener = function(...p) {
      try {
        return originalListener.apply(this, p);
      } finally {
        removeEventListener(
          targetContainer,
          rawEventName,
          unsubscribeListener,
          capture,
        );
      }
    };
  }
  if (capture) {
    if (enableUseEventAPI && passive !== undefined) {
      // This is only used with passive is either true or false.
      unsubscribeListener = addEventCaptureListenerWithPassiveFlag(
        targetContainer,
        rawEventName,
        listener,
        passive,
      );
    } else {
      unsubscribeListener = addEventCaptureListener(
        targetContainer,
        rawEventName,
        listener,
      );
    }
  } else {
    if (enableUseEventAPI && passive !== undefined) {
      // This is only used with passive is either true or false.
      unsubscribeListener = addEventBubbleListenerWithPassiveFlag(
        targetContainer,
        rawEventName,
        listener,
        passive,
      );
    } else {
      unsubscribeListener = addEventBubbleListener(
        targetContainer,
        rawEventName,
        listener,
      );
    }
  }
  return unsubscribeListener;
}
```
