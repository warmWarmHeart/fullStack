# protobuf.js

## protobufjs.parse

```javascript
function parse(source, root, options) {
    ...
    return {
        "package"     : pkg, // 包名称（如果声明）
        "imports"     : imports,
         weakImports  : weakImports,
         syntax       : syntax, // 语法版本
         root         : root
    };
}
```
### root 属性

```javascript
root = new Root();
```
#### Root构造函数
```javascript
function Root(options) {
    Namespace.call(this, "", options);

    /**
     * Deferred extension fields.
     * 延迟扩展字段
     * @type {Field[]}
     */
    this.deferred = [];

    /**
     * Resolved file names of loaded files.
     * 已解析加载文件的文件名。
     * @type {string[]}
     */
    this.files = [];
}
```

#### Namespace
```javascript

```
