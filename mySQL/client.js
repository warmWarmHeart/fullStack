const mysql = require('mysql');

const conn = mysql.createConnection({
    host: '10.112.227.46',
    user: 'root',
    password: 'Wyqn1002.',
    database: 'list'
});

// 查
// 创建sql语句
const sqlStr1 = "select * from student";
// 执行sql语句
conn.query(sqlStr1, (err, result) => {
    if (err) return console.log("查询失败"+err.message);
    console.log(result);
});
//
// // 增
// const user = { uname: "zs", age: 12, gender: "男" };
// // 创建sql语句 ? 为占位符
// const sqlStr2 = "insert into users set ?";
// // 执行sql语句
// conn.query(sqlStr1, user, (err, result) => {
//     if (err) return console.log("执行失败" + err.message);
//     console.log(result);
// });
//
// // 改
// const user = { id: 1, uname: "zs", age: 12, gender: "男" };
// // 创建sql语句 ? 为占位符
// const sqlStr3 = "update users set ? where id=?";
// // 执行sql语句
// conn.query(sqlStr3, [user, user.id], (err, result) => {
//     if (err) return console.log("执行失败" + err.message);
//     console.log(result);
// });
//
// // 删
// const user = { id: 1 };
// // 创建sql语句 ? 为占位符
// const sqlStr4 = "delete from users where id=?";
// // 执行sql语句
// conn.query(sqlStr4, user.id, (err, result) => {
//     if (err) return console.log("执行失败" + err.message);
//     console.log(result);
// });
