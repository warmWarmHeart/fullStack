var list = [];
for(var i = 1; i< 1000; i++) {
    list.push({
        name: 'student' + i,
        id: i,
    })
}
var db = connect('list');
var msg = db.student.insert(list);
print(msg);
