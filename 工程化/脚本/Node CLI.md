# Node CLI 

## process.argv
 获取当前进程的命令行参数
 * 例程
    ```javascript
    // 打印process.argv
    process.argv.forEach((val, index) => {
        console.log(`${index}: ${val}`)
    })
    ```
* 执行语句
    > process.argv 属性返回第一个数组，其中包含当启动Node.js进程时进入的命令行参数。第一个参数是process.execPath。第二个参数是执行的JavaScript文件路径。其余元素将是任何命令行参数
    ```
      $ node process-args.js one two=three four
    ```

## commander.js

```javascript
const program = require('commander')

const getHelp = ()=> {}

program.name('better-clone')
        .version('0.0.1')
        .options('-v, --verbose', 'verbosity that can be increased')

program.command('clone <source> [destination]')
        .options('-d, --depaths <level>', 'git clone depaths')
        .description('clone a repository into a newly created directory')
        .action((source, destination, cmdObj) => {
            
        })
        
program.parse(process.argv)
        
        
```
[program参考文档](https://www.jianshu.com/p/2cae952250d1)

## CLI交互
###更好的输入
#### Inquirer.js
* 灵活的CLI交互方式
    - input
    - number
    - expand
    - confirm
    - password
    - list
    - Editor
    - rawlist
    - checkbox
    - ...
[Inquirer参考文档](https://www.jianshu.com/p/0409cdf0e396)
### 更友好的输出
* 错误提示，醒目
* 操作成功，希望给用户正面的反馈
* 用户搜索关键字，希望高亮显示
#### chalk
```javascript
const chalk = reuqire('chalk')
const log = console.log

log(chalk.blue('\nHello'))
log(chalk.red('\nHello'))
log(chalk.blue.bgRed.blod('\nHello'))
```
* 为什么chalk可以输出颜色呢？
    - ANSI Escape Code
[chalk参考文档](https://www.npmjs.com/package/chalk)

## 调用其他程序

* CLI程序的复用
    - 不用再重复发明git、npm、yarn等
* 异步的进行某些耗时操作，尤其是CPU Bound操作
    - 让网络请求、后台的密集计算等不影响前台CLI程序与用户的交互
* Node通过child_process模块赋予了我们创造子进程的能力
    - cp.exec, cp.spawn

### 调用其他程序的CLI shelljs、execa

#### shelljs
对bash命令提供了跨平台的封装
```javascript
const shell = reuqire('shelljs')
if (!shell.which('git')) {
    shell.echo('Sorry, this script reuqires git')
   shell.exit(1)
}

shell.rm('-rf', 'out/Release')

shell.ls('*.js').forEach(item => {
    shell.sed('-i', 'BUILD_VERSION', 'v0.1.2', item)
})
shell.cd('..')

if (shell.exec('git commit -am "Auto-commit"').code !== 0) {
    shell.echo('Error: Git commit failed')
    shell.exit(1)
}
```
[shell参考文档](https://www.npmjs.com/package/shelljs)
#### execa
```javascript
const execa = reuqire('execa')
(async () => {
    const {stdout} = await execa('echo', ['unicorns'])
    console.log(stdout)
})()

execa('echo', ['unicorns']).stdout.pipe(process.stdout)
```
* 结果Promise化
* 跨平台支持Shebang（CLI开头的一串注释，告诉我们以什么程序执行当前代码，如：#!usr/bin/env node）
* 获取进程的结束信号
* 优雅的退出
* 更好的Windows的支持

## 拆解CLI设计-以脚手架为例
### 需求描述
设计一个脚手架CLI, 根据命令生成不同的模板，按照指定的参数在指定的路径生成一个样板工程

### 拆解需求
* 参数的输入，结果的输出
    - commander.js inquirer.js chalk
* 模板在哪儿维护
    - git 仓库维护模板
* 如何获取模板
    - git clone 使用execa或者shelljs调用
* 如何根据模板和参数生成工程
    - 模板引擎，如handlebars
    [handlebars参考文档](https://www.handlebarsjs.cn/guide/#html-%E8%BD%AC%E4%B9%89)

### 脚手架似乎是有套路的

#### Plop
[Plop参考文档](https://plopjs.com/documentation/)
#### 革命性的新一代脚手架 - Schemetics
* 配合schematics-utilities可以做到语法级别的样板代码生成
* 引入了虚拟文件系统， 可以保证写入原子性
* 支持多个Schematics之间的组合和管道
* 文档还不完善
[Schemetics参考文档](https://www.npmjs.com/package/@angular-devkit/schematics)

## 扩展阅读
### ink
用React开发CLI应用
* 专注于CLI的视图层
* 利用React的平台无关性（更换renderer）
```javascript
import React, {useState, useEffect} from 'react';
import {render, Text} from 'ink';
 
const Counter = () => {
    const [counter, setCounter] = useState(0);
 
    useEffect(() => {
        const timer = setInterval(() => {
            setCounter(previousCounter => previousCounter + 1);
        }, 100);
 
        return () => {
            clearInterval(timer);
        };
    }, []);
 
    return <Text color="green">{counter} tests passed</Text>;
};
 
render(<Counter />);
```
[ink参考文档](https://www.npmjs.com/package/ink)

### oclif
从工程的角度封装CLI开发的复杂性，是一个CLI的框架
* 提供了Plugin机制，便于扩展
* 提供预定义的生命周期
* 更紧凑的工程结构

[oclif参考文档](https://www.npmjs.com/package/oclif)
