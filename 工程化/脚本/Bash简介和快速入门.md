# Bash简介和快速入门

## Shell

### 定义
* Shell不仅仅是命令行，也可以是GUI
* Shell是操作系统和用户交互的接口
* 一般来说，我们说的Shell都是Unix shell，可以认为是CLI

* 命令（command）是什么？
    - 命令的本质是一个程序
    - 这些程序具有发起系统调用（System Call）的能力
    - 编写Shell脚本，其实就是在编排这些程序的执行
    - 除此之外还需要Shell语法解释器负责解释一行行的Shell语句
    
### Shell解释器
* bash（Linux/Unix）
* sh（Linux/Unix）
* zsh (inux/Unix)
* cmd (windows)
* PowerShell (windows)
* WSL (windows)

### 命令
* touch 新建文件
```
touch ./index.js
```
* mkdir 新建文件夹
```
mkdir ./a-new-project
```
* rmdir 移除文件
```
rmdir ./a-new-project
```
* rm 移除文件
```
rm ./a-single-file
rm -r ./a-dir # 递归删除
rm -rf ./a-dir-with-files # 递归强制删除
```
* mv 移动文件
```
mv ./source/a.txt ./target
mv -f ./source/a.txt ./target # 移动并强制覆盖
mv -n ./source/a.txt ./target # 移动但不覆盖
```
* cat、head、tail 文件查看
```
cat ./package.json # 查看文件
head -n 10 ~/.logs/sevivce-a.log # 查看文件的前10行
tail -n 10 ~/.logs/sevivce-a.log # 查看文件的后10行
```
* vi/vim 编辑文件 
* ps 进程
```
ps # 查看当前用户进程
ps -ax #查看所有进程
```
* lsof 查看网络相关文件
```
lsof -i # 查看打开的网络相关的文件
lsof -p 2333 查看pid=2333的进程打开的文件
```
* top 查看当前系统的实时状态
```
Processes: 411 total, 4 running, 407 sleeping, 2898 threads # 当前有411个进程，四个正在运行，407个在睡眠，另外共有2898个进程
Load Avg: 3.13, 3.28, 3.44 CPU usage: 8.79% user, 8.79% sys, 82.40% idle
# Load Avg后面的三个数分别是1分钟、5分钟、15分钟的负载情况，top会每隔5秒检查一次活跃的进程数，然后算出数值，如果这个数值除以逻辑CPU的数量，结果高于5的时候就表示系统超负荷运转了
# CPU usage: user - 用户空间占用CPU的百分比，sys：内核空间占用CPU的百分比，idle：空闲的百分比
PhysMem： 7941M used（2681M wired），250M unused # 物理内存已经使用了7941M，剩250M没有使用
```
* kill 杀进程
```
kill 45934 # SIGTERM信号
kill -9 45934 # SIGKILL信号 强杀进程
```
   > kill 命令实际上并不是在kill，本质是向进程发送信号。例如：kill -s SIGUSRI 34534实际上可以调试Node应用，因为Nodejs会在收到SIGUSR1时进入调试模式
   
* grep
```
lsof -i | grep LISTEN # 找到所有正在被监听的端口
```
* awk
```
# awk '{pattern + action}' {filenames}
docker rm $(docker ps -a | awk 'NR>1 {PRINT $1}') # 删除所有的docker 容器
chmod +x $(ls -al | awk 'NR>1 {print $9}') # 为当前目录下的所有文件添加可执行权限
```
* which 查看命令的来源
```
which python
which npm
```
## Bash编程 
### 变量
* 全局变量
```
COURSE=ENGINEERING
export COURSE=ENGINEERING
```

* 局部变量
```
local COURSE=ENGINEERING
```

* 环境变量
```
PATH: 指定命令的搜索路径
HOME: 指定用户的工作目录（用户登录到linux系统的时候，默认的目录）
HISTSIZE: 指保存历史命令记录的条数
LOGNAME: 用户当前的登录名
HOSTNAME: 主机名称
SHELL: 当前用户用的哪种Shell
LANG/LANGUGE: 和语言相关的环境变量，使用多种语言的用户可以修改此环境变量
MAIL：指当前用户的邮件存放目录
```
使用方法：`echo $PATH`

### 基本类型
```
#String
COURSE=ENGINEERING
COURSE="what the day today？"

#Number
COURSE=$[ 1 + 1 ]
COURSE=$(( 1 + 1 ))

#Array
COURSE=(what\'s the day today)
COURSE=(1 2 3 4 5)
COURSE[1] = 0
```
* 组合
```
COURSE=ENGINEERING
AAA=$(( 1 + 1 ))

STR="The alphabet starts with $COURSE"
echo $STR         # The alphabet starts with ENGINEERING

SEQ=(1 $AAA 3 4 5)
echo $SEQ         # 1 2 3 4 5
```
### 条件语句
* if then语句
```
if condition1
then 
    command1
elif condition1
then command2
else
    commandN
fi 
# fi 结束标识
```
* case 语句
```
case $VAR in
    condition1)
        command1
        ;;
    condition2)
        echo command2
        ;;
    *)
        echo command3
        ;;
esac
# esac 结束标识
```

### 比较符

| 符号 | 说明 |
| ---- | ---- |
| -z var | 检查var是否为空 |
| -d file | 检查file是否存在并且是一个目录 |
| -e file | 检查file是否存在 |
| -f file | 检查file是否存在并且是一个文件 |
| -r file | 检查file是否存在并且刻度 |
| -s file | 检查file是否存在并且非空 |
| -w file | 检查file是否存在并且可写 |
| -x file | 检查file是否存在并且可以执行 |
| -G file | 检查file是否存在并且其用户组与当前用户相同 |
| -O file | 检查file是否存在并且属于当前用户 |
| file1 -nt file2 | 检查file1是否比file2新 |
| file1 -0t file2 | 检查file1是否比file2旧 |

### 循环语句
* for循环

```
for index in 1 2 3 4 5; do
    echo "index="$index
done

for ((i=0; i<5; i++)); do
    echo $i
done
```

* while 循环
```
while (($i<=10)) do
    echo $i
done
```

### 函数
* 函数的定义
> 在函数体中，可以使用`$n`来获取第n个实参
```
function custom_echo()
{
    local prefix="input is"
    if [ -z $1]; then
        echo "no input"
    else echo "$prefix $1"
    fi
    return 0
}
```
* 函数的调用和返回值
> Shell 中运行的命令都使用退出状态码（exit status）告诉shell它完成了处理。退出的状态码是一个0-255之间的整数值，在命令结束时由命令传给shell，可以在命令执行完毕后立即使用`$?`捕获
```
custom_echo                 # unknown
custom_echo abc             # input is abc
echo $?                     # 0
```
### 特殊变量
| 变量 | 说明 |
| ---- | ---- |
| $# | 传递到脚本或者函数的参数的个数 |
| $* | 以一个单字符串显示所有向脚本传递的参数 |
| $$ | 脚本运行的当前进程ID |
| $!| 与$*相同，但是使用时加引号，并且在引号中返回每个参数 |
| $- | 显示Shell使用的当前选项，与set命令功能相同 |
| $? | 显示最后命令退出的状态。 0表示没有任何错误，其他任何值表示有错误 |

### 重定向
* 什么是重定向？
    - 重定向，全称是I/O重定向，默认情况下，Bash命令从终端接收输入，并在终端打印输出（标准输入、标准输出）
    - 如果想改变输入的来源，或者输出的目的地，name需要使用'重定向'
* 符号

```
command > file 将输出重定向到 file
command < file 将输入重定向到 file
command >> file 将输出以追加的方式重定向到 file
command << file 将输入重定向到 file 的部分内容
```

### 交互式程序

* echo 和 read

```
echo "xxx"          # 打印并换行
echo -n "xxx"       # 打印且不换行

read var            # 读取输入，并存入变量var
read -n 1 var       # 读入输入的第一个字符，存入变量var
```
