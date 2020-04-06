var MongoClient = require('mongodb').MongoClient;

var url = "mongodb://root:root@10.112.227.46:27017";

const insertDocuments = function(db, callback) {
    // Get the documents collection
    const collection = db.collection('student');
    // Insert some documents
    collection.insertMany([
        {a : 1}, {a : 2}, {a : 3}
    ], function(err, result) {
        console.log("Inserted 3 documents into the collection");
        callback(result);
    });
}
const findDocuments = function(db, callback) {
    // Get the documents collection
    const collection = db.collection('student');
    // Find some documents
    collection.find({ id: {$lt: 10} }).toArray(function(err, docs) {
        console.log("Found the following records");
        console.log(docs)
        callback(docs);
    });
}
// Database Name
const dbName = 'list';

// Use connect method to connect to the server
MongoClient.connect(url,{useUnifiedTopology:true, useNewUrlParser: true}, function(err, client) {
    console.log("Connected successfully to server");
    // console.log(err, client)

    const db = client.db(dbName);

    // insertDocuments(db, function() {
    //     client.close();
    // });

    findDocuments(db, function() {
        client.close();
    });
});
