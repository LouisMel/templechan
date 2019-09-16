const express = require('express');
const multer = require('multer');
var crypto = require('crypto');
var path = require('path');
const expressSanitizer = require('express-sanitizer');
const app = express();
const bodyParser = require('body-parser');

var svgCaptcha = require('svg-captcha');

app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(expressSanitizer());
// here is a change
var a;
// store session state in browser cookie
var cookieSession = require('cookie-session');
app.use(cookieSession({
  keys: ['secret1', 'secret2']
}));


//  it's imperative to have .cookieParser() and .session() before .static()
// app.use(express.cookieParser('your secret here'));
// app.use(express.csession());

app.use('/public', express.static('public'));
app.set('view engine', 'ejs');


const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/templedb');

mongoose.connection.once('open', function() {
  console.log('ram successfully connected to DB...');
}).on('error', function(err) {
  console.log(err);
});
//importing schema variable for mongoose
const postModel = require('./models/posts');

//boring Multer settings jargon
var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './public/images/')
  },
  filename: function(req, file, cb) {
    crypto.pseudoRandomBytes(16, function(err, raw) {
      let y = raw.toString('hex') + Date.now()
      let x = path.extname(file.originalname)
      cb(null, y + x);
    });
  }
});


var upload = multer({
  storage: storage,
  fileFilter: function(req, file, cb) {
    if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg" || file.mimetype == 'image/gif' || file.mimetype == 'audio/mp3' || file.mimetype == 'audio/mpeg') {
      cb(null, true);
    } else {
      // cb(null, false);
      return cb(new Error('Only .png, .jpg .jpeg .gif and .mp3 format allowed!'));
    }
  },
  limits: {
    fileSize: 10000000
  }

});


var reqBoard;
var reqPost;
var ifAjax;
var urlData;
var cutBoard;
var cutThread;
var cutURL;
var Board;
var Post;


app.get('/', function(req, res) {
  res.render('catalog', {
    title: false,
    thumbnails: false,
    post: false
  });
});


var options = {
  cookie: 'captcha',
  background: '#b9b6b6', //rgb(25,10,10)
  ignoreChars: '0o1ilI', // filter out some characters like 0o1i
  fontSize: 100,
  width: 250,
  height: 150,
  charPreset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  noise: 2,
  size: 4, // size of random string
  color: true, // will generate random color for each character
  mathMin: 0, // the minimum value the math expression can be
  mathMax: 15, // the maximum value the math expression can be
  mathOperator: '+-' //'+' '-' // The operator to use, +, - or +- (for random + or -)
}


app.get('/captcha/create', function(req, res) {
  var captcha = svgCaptcha.create(options);
  // var captcha = svgCaptcha.createMathExpr(options);

  if (!req || req.session === undefined) {
    throw Error('node-captcha requires express-session')
  }
  delete req.session.isValidHuman
  req.session.captcha = captcha.text;
  console.log("createCaptcha=============", captcha.text);
  res.type('svg');
  res.status(200).send(captcha.data);
});

app.get('/captcha/check/:text', async function(req, res) {

  var captcha = svgCaptcha.create(options);
  // var captcha = svgCaptcha.createMathExpr(options);
  // req.session.captcha = captcha.text;
  console.log("backend ==== checkCaptcha=============", req.session);
  let text = req.params.text

  // No need for this check, as mandatory already in url
  if (!text) {
    // throw Error('node-captcha requires express-session')
    res.status(200).send({
      error: true,
      "message": "Invalid Captcha Text"
    });
  }

  //For sending image form text
  // var result = svgCaptcha(text, options)
  // console.log("result=============", result);
  // res.type('svg');
  // res.status(200).send(captcha.data);

  async function check(req, text, caseSensitive = true) {
    if (!req || req.session === undefined) {
      res.status(200).send({
        error: true,
        "message": "Invalid Captcha Text"
      });

      throw Error('node-captcha requires express-session')
    }

    console.log("inside====", req.session.captcha, "===", text);
    const bool = caseSensitive ?
      req.session.captcha === text :
      req.session.captcha.toLowerCase() === text.toLowerCase()

    req.session.captcha = null
    //   req.session[this.params.cookie] === text :
    //   req.session[this.params.cookie].toLowerCase() === text.toLowerCase()
    // req.session[this.params.cookie] = null
    return bool
  }

  let bool_result = await check(req, text)
  req.session.isValidHuman = bool_result

  let send_result = {}
  if (bool_result == true) {
    delete req.session.captcha;
    req.session.isValidHuman = bool_result
    send_result = {
      error: false,
      "message": "Succes"
    }
  } else {
    delete req.session.captcha;
    delete req.session.isValidHuman;
    req.session.isValidHuman = bool_result
    send_result = {
      error: true,
      "message": "Invalid Captcha Text"
    }
  }

  console.log("booolean==========", req.session, bool_result);

  // res.type("Boolean");
  res.status(200).send(send_result);
  // res.status(200).send(captcha.data);
})


app.get('/:board', function(req, res) {
  reqBoard = req.sanitize(req.params.board);
  cutURL = reqBoard.indexOf('-');
  if (cutURL >= 1) {
    Board = reqBoard.substring(0, cutURL);
    ifAjax = true;
  } else {
    Board = reqBoard;
    ifAjax = false;
  }

  if (Board === 'pol' || Board === 'a' || Board === 'b') {
    postModel.find({board:Board,type:'post'}).sort({bumpNumber:'desc'}).exec(function(err, docs){
      if (ifAjax) {
        res.send({
          thumbnails: docs
        });
      }else{
        res.render('catalog', {
          title: reqBoard,
          thumbnails: docs,
          post: false
        });
      }
    });

  } else {
    res.send('board not found');
  }
});

app.get('/:board/:post', function(req, res) {
  Board = req.sanitize(req.params.board);
  reqPost = req.sanitize(req.params.post);
  cutURL = reqPost.indexOf('-');
  if (cutURL >= 1) {
    Post = reqPost.substring(0, cutURL);
    ifAjax = true;
  } else {
    Post = reqPost;
    ifAjax = false;
  }

  if (Board === 'pol' || Board === 'a' || Board === 'b') {
    postModel.find({postNumber: Post},function(err,docs){
      if(docs !== []){
        postModel.find({OPreplyNumber:Post,type:'reply'},function(err, docs2){
          if (ifAjax) {
            res.send({thread:docs,replies:docs2});
          } else {
            res.render('catalog',{title:Board,post:docs,replies:docs2,thumbnails:false});
          }
        });
      } else {
        res.send('thread not found');
      }
    });

  } else {
    res.send('board not found');
  }
});

// upload.single('image'),
var multipleupload = upload.fields([{
  name: 'image',
  maxCount: 1
}, {
  name: 'music',
  maxCount: 1
}])
app.post('/post', multipleupload, function(req, res) {

  console.log("pooooooooooooooooosttttttttt=====", req.session.isValidHuman);
  if (!req.session.isValidHuman) {
    console.log("inside throw=====");
   res.status(200).send({
      error: true,
      message: "User Not Validate"
    });
    return
  }

  //refreshing
  req.session.isValidHuman = false

  var Name = req.sanitize(req.body.name);
  if (!Name) {
    Name = 'Anonymous';
  }
  var Options = req.sanitize(req.body.options);
  if (!Options) {
    Options = '';
  }
  var Subject = req.sanitize(req.body.subject);
  if (!Subject) {
    Subject = '';
  }
  if (req.files.image) {
    var Image = req.files.image[0].filename;
  } else {
    var Image = '';
  }
  if (req.files.music) {
    var Music = req.files.music[0].filename;
  } else {
    var Music = '';
  }
  console.log("ppppppppp=============",req.body);
  var Comment = req.sanitize(req.body.comment);
  var thePath = req.sanitize(req.body.path);
  var cutPath = thePath.indexOf('/', 1);
  var Type;
  if (cutPath >= 1) {
    Board = thePath.substring(1, cutPath);
    Type = 'reply';
    var OPreplyNumb = thePath.substring(cutPath + 1);

  } else {
    Board = thePath.substring(1);
    Type = 'post';
  }

  var d = new Date();
  var TimeStamp = d.toJSON();

  var repliesArray = [];
  var regexOPcomment = Comment.replace(/&gt;&gt;\d*/g, function(x) {
    var id = x.substring(8);
    repliesArray.push(id);
    return `<a id='replyLink' href='#${id}'>${x}</a>`;
  });

  //checking for duplicates in the replyArray
  let uRepliesArray = []
  for (var v = 0; v < repliesArray.length; v++) {
    if (uRepliesArray.indexOf(repliesArray[v]) == -1) {
      uRepliesArray.push(repliesArray[v])
    }
  }


  postModel.count({}, function(err, count) {

    if (uRepliesArray.length >= 1) {
      for (var i = 0; i < uRepliesArray.length; i++) {
        postModel.findOneAndUpdate({
          postNumber: uRepliesArray[i]
        }, {
          $push: {
            replies: count
          }
        }, function(err) {
          if (err) {
            throw err;
          }
        });
      }
    }

    var newPost = new postModel({
      postNumber: count,
      name: Name,
      options: Options,
      subject: Subject,
      image: Image,
      music: Music,
      comment: regexOPcomment,
      board: Board,
      type: Type,
      OPreplyNumber: OPreplyNumb,
      timestamp: TimeStamp,
      bumpNumber: 3,
    });

    newPost.save(function() {

      if (Type == 'reply') {
        postModel.find({
          board: Board,
          type: 'post'
        }).sort({
          bumpNumber: 'desc'
        }).limit(1).exec(function(err, docs) {
          var bumpNumber = docs[0].bumpNumber;
          var replaceBump = bumpNumber + 1;

          postModel.findOneAndUpdate({
            postNumber: OPreplyNumb
          }, {
            bumpNumber: replaceBump
          }, function(err, doc) {
            if (err) {
              console.log("Something wrong when updating data!");
              throw err;
            }

            postModel.find({
              OPreplyNumber: Post,
              type: Type
            }, function(err, docs) {
              res.send({
                replies: docs,
                type: Type
              });
            });
          });
        });
      }else if(Type == 'post') {
        postModel.find({board:Board,type:'post'}).sort({bumpNumber:'desc'}).limit(1).exec(function(err, docs){
          var bumpNumber = docs[0].bumpNumber;
          var replaceBump = bumpNumber + 1;
          postModel.findOneAndUpdate({postNumber:count},{bumpNumber:replaceBump},function(err,doc){
            if (err) {
              console.log("Something wrong when updating data!");
              throw err;
            }

            postModel.find({board:Board,type:Type}).sort({bumpNumber:'desc'}).exec(function(err,docs){
              res.send({thumbnails:docs,type:Type});
            });
          });
        });
      }

    });


  });
});

app.listen(process.env.PORT || 5000);
