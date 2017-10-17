//initialize express app
var express = require('express');
var app = express();

//for scraping
var request = require('request');
var cheerio = require('cheerio');
var ua = ''
var url = 'http://www.newyorker.com/popular?intcid=mod-most-popular'


// other dependencies
var logger = require('morgan');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');

//middleware to use morgan and bodyparser
app.use(logger('dev'));
app.use(bodyParser.urlencoded({
    extended: false
}));

//public static dir
app.use(express.static(process.cwd() + '/public'));
var exphbs = require('express-handlebars');
app.engine('handlebars', exphbs({
    defaultLayout: 'main'
}));
app.set('view engine', 'handlebars');

//connect to db
mongoose.connect('');
var db = mongoose.connection;

//show any errors
db.on('error', function(err) {
    console.log('Mongoose Error: ' + err);
});

//show inevitable success
db.once('open', function() {
    console.log('Mongoose connection a success!');
});

//rounding up the model
var Article = require('./models/articles.js');
var Comment = require('./models/comments.js');

//home
app.get('/', function(req, res) {
    res.render('index');
});

app.get('/articles', function(req, res) {
    Article.find({})
        .sort({ 'date': -1 })
        .limit(30)
        .exec(
            function(err, doc) {
                // log any errors
                if (err) {
                    console.log(err);
                }
                // or send the doc to the browser as a json object
                else {
                    res.json(doc);
                }
            });
});

app.get('/articles/:id', function(req, res) {
    Article.findOne({ '_id': req.params.id })
        .populate('comments')
        .exec(function(err, doc) {
            if (err) {
                console.log(err);
            } else {
                console.log("those are some sweet comments", doc);
                res.render('comments', doc);

            }
        });
});

app.post('/articles/:id', function(req, res) {
    // create a new note and pass the req.body to the entry.
    var newComment = new Comment(req.body);

    // and save the new note the db
    newComment.save(function(err, doc) {
        // log any errors
        if (err) {
            console.log(err);
        }
        // otherwise
        else {
            // using the Article id passed in the id parameter of our url, 
            // prepare a query that finds the matching Article in our db
            // and update it to make it's lone note the one we just saved
            Article.findOneAndUpdate({ '_id': req.params.id }, { $push: { 'comments': doc._id } }, { new: true, upsert: true })
                .populate('comments')
                .exec(function(err, doc) {
                    console.log("COMMENTS", doc)
                        // log any errors
                    if (err) {
                        console.log(err);
                    } else {
                        res.render('comments', doc);
                    }
                });
        }
    });

});


app.get('/scrape', function(req, res) {

    var scrapePage = function(error, response, html) {
        if (error || response.statusCode != 200) {
            console.log(error);
        } else {
            var result = {};
            var $ = cheerio.load(html);

            $('.popular-page1').each(function(i, element) {

                result.title = $(this).children('article').children('span').find('a').text();

                result.img_url = $(this).children('article').children('figure').children('a').children('img').attr('src');

                result.link = $(this).children('article').children('figure').children('a').attr('href');

                result.author = $(this).children('article').children('.text').children('h3').children('a').text();

                result.author_url = $(this).children('article').children('.text').children('h3').children('a').attr('href');;

                var entry = new Article(result);

                entry.save(function(err, doc) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(doc);
                    }

                });


            });
        }
    }

    request({
        url: url,
        headers: {
            "User-Agent": ua
        }
    }, scrapePage);

    res.redirect("/");
});

var PORT = process.env.PORT || 3000
app.listen(PORT, function() {
    console.log("Listening at Port " + PORT)
});