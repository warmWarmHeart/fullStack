# npm 命令

## 常用命令
| 命令 | 说明 |
| ----- | ------ |
| npm init | 初始化工程 |
| npm run | run scripts |
| npm install | 安装依赖|
| npm update | 升级依赖|
| npm bin | 查看bin文件目录|
| npm link | 将工程软连接到全局|
| npm publish | 发布包|
| npm deprecate | 废弃包|

## npm scripts 内部命令

| 变量 | 说明 |
| ----- | ------ |
| $npm_package_name | name in package.json |
| $npm_package_version | version in package.json |
| $npm_package_config_var1 | config.var1 in package.json|

## npm scripts 参数
* 问题： 如何对npm scripts二次包装的命令传参
* 答案： 利用 `--` 透传参数
```
{
    "scripts": {
        "serve": "npm run serve -- -l 80"
    }
}
```

## npm scripts 脚本钩子
脚本钩子类似于hook, 当事件触发时，对应的钩子逻辑也被触发

| 钩子 | 说明 |
| ----- | ------ |
| preinstall | 用户执行npm install前先执行此脚本 |
| postinstall | 用户执行npm install安装后执行此脚本 |
| preuninstall | 卸载一个模块前执行|
| postuninstall | 卸载一个模块后执行|
| prelink | link模块前执行|
| postlink | link模块后执行|
| pretest | 运行 npm test命令前执行|
| posttest | 运行npm test命令后执行|

* 规律： pre-* 和 post-*
除了内置脚本钩子，我们也可以按照规则自定义添加钩子

* 例子： 自动化发版
```javascript
#!/usr/bin/env node

// 发版前自动化增加版本号
const semver = require('semver')
const packageInfo = require('./package.json')
const fs = require('fs')
const targetVersion = semver.inc(packageInfo.version)
packageInfo.version = targetVersion
...
```
