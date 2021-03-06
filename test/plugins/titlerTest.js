/**
 * Titler plugin tests
 *
 */
"use strict";

var fs     = require('fs');
var assert = require("assert");
var titler = require('../../plugins/titler/');

describe('get title template', function () {
    beforeEach(function () {
        titler.init({
            "config": {
                "plugins": {
                    "titler": {
                        "boldTitles": false,
                        "titleTemplate": "^ {{title}}",
                        "ignoreDomains": [
                        
                        ]
                    }
                }
            },
            
            "addListener": function () {
            
            }
        });
    });
    
    it('given a title', function () {
        var expected = '^ the only thing hotter than my flow is da block';
        var actual   = titler.getTitleFromTemplate('the only thing hotter than my flow is da block');  
        
        assert.equal(expected, actual);
    });
});

describe('getYoutubeVideoID', function () {
    it('should get video id given a URL', function () {   
        var url      = 'http://youtu.be/veNtA5EziU0';
        var expected = 'veNtA5EziU0';
        var actual   = titler.getYoutubeVideoID(url);  
        
        assert.equal(expected, actual);
    });
});

describe('youtube views undefined bug', function () {
    it('views should be defined', function () {   
        var videoTitle = "One Mint Julep";
        var likeCount  = 500000;
        var rating     = 9;
        var viewCount  = 9001;
        
        var title = titler.getYoutubeVideoTitleDetailString({
            title: videoTitle,
            likeCount: likeCount,
            rating: rating,
            viewCount: viewCount
        });
        
        assert.notEqual(title.indexOf(videoTitle), -1);
        assert.notEqual(title.indexOf(likeCount), -1);
        assert.notEqual(title.indexOf(rating), -1);
        assert.notEqual(title.indexOf(viewCount), -1);
        assert.equal(title.indexOf('undefined'), -1);
    });
    
    it('views should not be undefined', function () {        
        var data  = JSON.parse(fs.readFileSync('fixture/youtubeVideoResponseWithViewsUndefined.json', 'utf8')).data;        
        var title = titler.getYoutubeVideoTitleDetailString(data);
        
        assert.notEqual(title.indexOf(data.title), -1);
        assert.notEqual(title.indexOf(data.likeCount), -1);
        assert.notEqual(title.indexOf(data.rating), -1);
        assert.equal(title.indexOf('undefined'), -1);
    });
});

describe('reload', function () {
    it('should reload the config', function () {
        titler.init({
            "config": {
                "plugins": {
                    "titler": {
                        "ignoreDomains": [
                        
                        ]
                    }
                }
            },
            
            "addListener": function () {
            
            }
        });
        
        assert.equal(titler.isIgnoredDomain('asdf.com'), false);
        
        titler.init({
            "config": {
                "plugins": {
                    "titler": {
                        "ignoreDomains": [
                            "asdf.com"
                        ]
                    }
                }
            },
            
            "addListener": function () {
            
            }
        });
        
        assert.equal(titler.isIgnoredDomain('asdf.com'), true);
    });
});

describe('ignore domains', function () {
    it('should not return false domain is not ignored', function () {
        var input    = 'http://momentjs.com/docs';
        var expected = false;    
    
        titler.init({
            "config": {
                "plugins": {
                    "titler": {
                        "ignoreDomains": [
                        
                        ]
                    }
                }
            },
            
            "addListener": function () {
            
            }
        });
        
        var actual = titler.requestWebsite(input, function (body) {
            return body;
        });
        
        assert.notEqual(expected, actual);
    }); 
    
    it('should be undefined if domain is ignored', function () {
        var input    = 'http://i.imgur.com/dSTFnd3.gif';
        var expected = undefined;
        
        titler.init({
            "config": {
                "plugins": {
                    "titler": {
                        "ignoreDomains": [
                            "i.imgur.com"
                        ]
                    }
                }
            },
            
            "addListener": function () {
            
            }
        });
        
        titler.requestWebsite(input, function (html) {
            assert.equal(expected, html);
            done();
        });
    });
});

describe('Youtube Info', function () {
    it('should get the video ID given a shortened URL', function () {
        var url     = 'http://youtu.be/veNtA5EziU0';
        
        var videoID = titler.getYoutubeVideoID(url);
        
        assert.equal(videoID, 'veNtA5EziU0');
    });
    
    it('should get the video ID given a URL', function () {
        var url     = 'http://www.youtube.com/watch?v=7B9z6VEzfDE';
        
        var videoID = titler.getYoutubeVideoID(url);
        
        assert.equal(videoID, '7B9z6VEzfDE');
    });
    
    it('should parse JSON and get correct info', function () {        
        var info = JSON.parse(fs.readFileSync('fixture/youtubeVideoResponse.json', 'utf8'));
        var url  = 'http://www.youtube.com/watch?v=7B9z6VEzfDE';
        
        titler.getYoutubeVideoInfo(url, function (data) {
            assert.equal(data.id, '7B9z6VEzfDE');
            assert.equal(data.title, 'Ray J...I Hit It First!!!!');
            assert.notEqual(data.viewCount, 'undefined');
            assert.notEqual(data.likeCount, 'undefined');
            assert.notEqual(data.rating, 'undefined');
        });
    });
});

describe('URL Matcher', function() {
    it('should match valid URLs', function () {
        var validURLs = [
            'http://google.com',
            'http://youtu.be/j2fmevbZi40',
            'https://www.youtube.com/watch?v=mqFLXayD6e8',
            'http://www.youtube.com/watch?v=7B9z6VEzfDE',
            'https://www.youtube.com/watch?v=MJ17szvj1gk&feature=player_detailpage'
        ];
        
        var validURLsLen = validURLs.length;
        
        for (var j = 0; j < validURLsLen; j++) {
            assert.equal(titler.matchURL(validURLs[j]), true);
        }
    });
    
    it('should not match invalid URLs', function () {
        var invalidURLs = [
            'http://google',
            'cheddarwurst',
            'httpl://lol.com'
        ];
        
        var invalidURLsLen = invalidURLs.length;
        
        for (var j = 0; j < invalidURLsLen; j++) {
            assert.equal(titler.matchURL(invalidURLs[j]), false);
        }
    });   
});

describe('html', function() {
    it('should find the title tag in this html', function (done) {
        var html = fs.readFileSync('fixture/titler-cant-find-title.html', 'utf8');
        
        titler.parseHTMLAndGetTitle(html, function (title) {
            assert.equal(title, 'Chuck Palahniuk Announces a Graphic Novel Sequel to FIGHT CLUB! - ChuckPalahniuk');
            done();
        });
    });
});

describe('html part 2', function() {
    it('should find the title tag in this html', function (done) {
        var html = fs.readFileSync('fixture/titler.html', 'utf8');
        
        titler.parseHTMLAndGetTitle(html, function (title) {
            assert.equal(title, 'Capybara - Wikipedia, the free encyclopedia');
            done();
        });
    });
});

describe('html with special characters', function() {
    it('should find the title tag in this html', function (done) {
        var html = fs.readFileSync('fixture/titler-with-special-chars.html', 'utf8');
        
        titler.parseHTMLAndGetTitle(html, function (title) {
            assert.equal(title, '& bacon & bacon & bacon & bacon & bacon');
            done();
        });
    });
});

describe('non html input', function() {
    it('should return a blank string if its not valid HTML', function (done) {
        var html = fs.readFileSync('fixture/titler-non-html.html', 'utf8');
        
        titler.parseHTMLAndGetTitle(html, function (title) {
            assert.equal(title, '');
            done();
        });
    });
});

describe('title with newline', function() {
    it('should return a blank string if its not valid HTML', function (done) {
        var html = fs.readFileSync('fixture/title-with-newline.html', 'utf8');
        
        titler.parseHTMLAndGetTitle(html, function (title) {
            assert.equal(title.indexOf("\r\n"), -1);
            assert.equal(title.indexOf("\n"), -1);
            assert.equal(title.indexOf("\t"), -1);
            assert.equal(title, "Melissa Nelson fired for being 'irresistible' | News.com.au");
            done();
        });
    });
});

describe('title with extra spaces', function() {
    it('should return a string without spaces on the end', function (done) {
        var html = fs.readFileSync('fixture/titler-with-spaces.html', 'utf8');
        
        titler.parseHTMLAndGetTitle(html, function (title) {
            assert.equal(title.indexOf("\r\n"), -1);
            assert.equal(title.indexOf("\n"), -1);
            assert.equal(title.indexOf("\t"), -1);
            assert.equal(title, "Fighting Gifs - Imgur");
            done();
        });
    });
    
    it('should replace tabs with spaces', function (done) {
        var html = fs.readFileSync('fixture/titler-with-tabs.html', 'utf8');
        
        titler.parseHTMLAndGetTitle(html, function (title) {
            assert.equal(title.indexOf("\r\n"), -1);
            assert.equal(title.indexOf("\n"), -1);
            assert.equal(title.indexOf("\t"), -1);
            assert.equal(title, "Full Disclosure: [SECURITY] [DSA 2741-1] chromium-browser security	update");
            done();
        });
    });
});

/*
describe('title image info', function() {
    it('should return info about an image', function (done) {
        //var data = fs.readFileSync('fixture/costanza-russian-hat.jpg', 'utf8');
        
        titler.getImageInfo('./fixture/costanza-russian-hat.jpg', function (err, img, stderr) {
            console.log(img);
            
            // 510x370
            assert.equal(img.width, 510);
            assert.equal(img.height, 370);
            assert.equal(img.type, 'JPEG');
            assert.equal(img.size, '54467B');
            
            done();
        });
    });
});
*/