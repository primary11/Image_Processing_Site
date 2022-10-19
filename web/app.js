var express = require('express')
  , multer = require('multer')
  , AWS = require('aws-sdk')
  , Sequelize = require('sequelize')
  , mime = require('mime')
  , http = require('http')
  , fs = require('fs')
  , app = express()
  , server = http.createServer(app)
  , s3 = new AWS.S3({ region: 'us-west-2' })
  , sqs = new AWS.SQS({ region: 'us-west-2' });

var s3Bucket = 'examplephoto1.image';
var sqsQueueUrl = 'https://sqs.us-west-2.amazonaws.com/863323645498/ExamplePhotoQueue'; 
var rdsEndpoint = {
  host: 'examplephoto1.cqivvkrafxn1.us-west-2.rds.amazonaws.com',
  port: 3306
};

// MySQL DB Name, Account, Password
var sequelize = new Sequelize('examplephoto1', 'admin', 'admin12345', {
  host: rdsEndpoint.host,
  port: rdsEndpoint.port
});

// MySQL DB Table Definition
var Photo = sequelize.define('Photo', {
  filename: { type: Sequelize.STRING, allowNull: false, unique: true }
});

// MySQL DB Table Create
sequelize.sync();

app.use(multer({ dest: './uploads/' }));

app.get(['/', '/index.html'], function (req, res) {
  fs.readFile('./index.html', function (err, data) {
    res.contentType('text/html');
    res.send(data);
  });
});

// Image Items Print Out
app.get('/images', function (req, res) {
  Photo.findAll().success(function (photoes) {
    var data = [];
    photoes.map(function (photo) { return photo.values; }).forEach(function (e) {
      data.push(e.filename);
    });

    res.header('Cache-Control', 'max-age=0, s-maxage=0, public');
    res.send(data);
  });
});

// Receive image from web browser
app.post('/images', function (req, res) {
  fs.readFile(req.files.images.path, function (err, data) {
    var filename = req.files.images.name;
    s3.putObject({
      Bucket: s3Bucket,
      Key: 'original/' + filename,
      Body: data,
      ContentType: mime.lookup(filename)
    }, function (err, data) {
      if (err)
        console.log(err, err.stack);
      else {
        console.log(data);
        
        sqs.sendMessage({
          MessageBody: filename,
          QueueUrl: sqsQueueUrl
        }, function (err, data) {
          if (err)
            console.log(err, err.stack);
          else
            console.log(data);
        });
      }
    });
  });

  res.send();
});

server.listen(80);
