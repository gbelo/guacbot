/**
 * Titler - matches URL patterns in the channel and returns the title
 * of that page
 *
 */
"use strict";
var request    = require('request');
var ignore     = require('../ignore/');
var parser     = require('../../lib/messageParser');
var moment     = require('moment');
var cheerio    = require('cheerio');
var easyimg    = require('easyimage');
var path       = require('path');
var fs         = require('fs');
var filesize   = require('filesize');
var repost     = require('../../plugins/repost');
var Handlebars = require('handlebars');
var ent        = require('ent');

var titler  = {
    imageInfoEnabled: false,
    lastTopicChange: null
};

titler.loadConfig = function (cfg) {
    titler.cfg = cfg.plugins.titler;
};

titler.init = function (client) {
    titler.pluginConfig = client.config.plugins.titler;
    titler.loadConfig(client.config);
    
    // Listen to messages from any channel
    client.addListener('message#', function (nick, channel, text, message) {
        ignore.isIgnored(message.user + '@' + message.host, function (ignored) {
            if (!ignored) {
                var link = titler.getFirstLinkFromString(text);
                
                titler.getTitle (link, function (title) {
                    if (title) {
                        client.say(channel, titler.getTitleFromTemplate(title));
                    }
                });
            }
        });
    });
    
    // Look for topics that have URLs in them
    client.addListener('topic', function (channel, topic, nick, message) {
        if (!titler.lastTopicChange) {
            titler.lastTopicChange = moment();
        }
        
        // We want to ignore the topic event that occurs when joining a channel
        var timeElapsedSinceLastTopicChange = moment().diff(titler.lastTopicChange, 'seconds');
        var threshold                       = 30;
        var isInitialJoinTopicChange        = timeElapsedSinceLastTopicChange < threshold;
        
        if (!isInitialJoinTopicChange) {
            ignore.isIgnored(message.user + '@' + message.host, function (ignored) {
                if (!ignored) {
                    var link = titler.getFirstLinkFromString(topic);
                    
                    if (link) {
                        titler.getTitle (link, function (title) {
                            if (title) {                               
                                client.say(channel, titler.getTitleFromTemplate(title));
                            }
                        });
                    }
                }
            });
        }
    });
};

titler.isBoldEnabled = function () {
    var enabled = true;
    
    if (typeof titler.pluginConfig.boldTitles !== 'undefined') {
        enabled = titler.pluginConfig.boldTitles;
    }
    
    return enabled;
};

titler.getBoldString = function (input) {
    return "\u0002" + input;
};

titler.getTitleFromTemplate = function (title) {
    var defaultTemplate = '^ {{title}}';
    var compileMe       = titler.pluginConfig.titleTemplate || defaultTemplate;
    var titleTemplate   = Handlebars.compile(compileMe);
    var tpl             = titleTemplate({
        title: title
    });
    
    if (titler.isBoldEnabled()) {
        tpl = titler.getBoldString(tpl);
    }
    
    tpl = ent.decode(tpl);
    
    return tpl;
};

titler.getFirstLinkFromString = function (input) {
    var link  = '', word = '';
    var words = parser.splitMessageIntoWords(input);

    /**
     * sometimes people have text in the same line as the URL,
     * so split the entire message into words
     * and only get the title of the first URL found
     *
     */
    for (var j = 0; j < words.length; j++) {
        word = words[j];
        
        // Only try to get source of things that look like a URL
        if (titler.matchURL(word)) {
            link = word;
            break;
        }
    }
    
    return link;
};

titler.matchURL = function (url) {
    var urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
    
    return urlPattern.test(url);
};

titler.isIgnoredDomain = function (domain) {
    var domains = [];
    
    if (typeof titler.cfg !== 'undefined') {
        domains = typeof(titler.cfg.ignoreDomains) !== 'undefined' ? titler.cfg.ignoreDomains : [];
    }
    
    return domains && domains.indexOf(domain) !== -1;
};

titler.requestWebsite = function (url, websiteCallback, imageCallback) {
    var u               = require('url');
    var host            = u.parse(url).host;
    var isIgnoredDomain = titler.isIgnoredDomain(host);
    
    if (!isIgnoredDomain) {
        //console.log('Retrieving page HTML for URL: ' + url);
        
        var options = {
            uri: url,
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.94 Safari/537.36'
            },
        };
        
        request(options, function (error, response, body) {            
            if (!error) {
                var type      = response.headers['content-type'];
                var isWebsite = titler.isHTML(type);
                
                if (isWebsite) {
                    if (response.statusCode == 200) {
                        websiteCallback(body);
                    } else {
                        console.log('titler error: ', 
                                    error, 
                                    ' response code:', 
                                    response.statusCode,
                                    " URL: ", url);
                    }
                } else {
                    if (titler.imageInfoEnabled) {
                        var isImage = titler.isImage(type);
                        
                        if (isImage) {
                            repost.isRepost(null, url, function (rpst) {
                                if (rpst === false) {
                                    titler.downloadFile(options.uri, function (filename, length) {
                                        console.log('file downloaded:', filename);
                                        
                                        titler.getImageInfo(filename, function (err, img, stderr) {
                                            if (err || stderr) {
                                                console.log('Error getting image info: ', err, stderr);
                                            } else {
                                                imageCallback(err, img, stderr, length, filename);
                                            }
                                        });
                                    });
                                }
                            });
                        }
                    } else {
                        //console.log('not an image:', type);
                    }
                }
            }
        });
    }
};

titler.downloadFile = function (uri, callback) {
    request.head(uri, function (err, res, body) {
        var filename  = './images/';
            filename += titler.generateFilename(uri);
        
        var req = request(uri).pipe(fs.createWriteStream(filename));
        
        req.on('finish', function () {
            callback(filename, res.headers['content-length']);
        });
    });
};

titler.generateFilename = function (uri) {
    var p         = path.normalize(uri);
    var basename  = path.basename(p);
    var filename  = Math.floor(Math.random() * 100000);
        filename += '-' + basename;
    
    return filename;
};

titler.isImage = function (contentType) {
    return contentType.indexOf('image/')    !== -1;
};

titler.isHTML = function (contentType) {
    return contentType.indexOf('text/html') !== -1;
};

titler.parseHTMLAndGetTitle = function (html, callback) {
    var $     = cheerio.load(html);
    var title = $('title').text();
    
    if (title && title.length > 0) {
        title = title.replace(/\t\t/g, '');
        title = title.replace(/\t/g, ' ');
        title = title.replace(/\r\n/g, '');
        title = title.replace(/\n/g, ' ');
        title = title.trim();
    }
    
    callback(title);
};

titler.getTitle = function (url, callback) {
    if (url) {
        // Parse the URL and see if it's a youtube video    
        var u    = require('url');
        var info = u.parse(url);
        
        // If so, query the API and get extra info about the video
        if (info.host && titler.isYoutubeURL(info.host)) {        
            
            // Build title based on API data
            titler.getYoutubeVideoInfo(url, function (data) {
                var title = titler.getYoutubeVideoTitleDetailString(data);
                
                callback(title);
            });
            
        } else {
            var websiteCallback = function (html) {
                titler.parseHTMLAndGetTitle(html, function (title) {
                    callback(title);
                });
            };
            
            var imageCallback = function (err, img, stderr, length, filename) {
                //console.log(length);
                //console.log(err);
                //console.log(stderr);
                
                var hrfs  = length ? filesize(length, 0) : 0;
                var msg   = [img.type, 
                             img.width + 'x' + img.height];
                
                if (length) {             
                    msg.push(hrfs);
                }
                
                var title = msg.join(' ');
                
                if (err) {
                    console.log('Image info error: ', err);
                } else {
                    callback(title);
                    fs.unlinkSync(filename);
                    console.log('file deleted: ', filename);
                }
            };
            
            titler.requestWebsite(url, websiteCallback, imageCallback);
        }
        
    } else {
        callback('');
    }
};

titler.getYoutubeVideoTitleDetailString = function (data) {
    var viewCount = typeof data.viewCount !== 'undefined' ? data.viewCount : 0;
    var rating    = typeof data.rating    !== 'undefined' ? data.rating    : 0;
    var likeCount = typeof data.likeCount !== 'undefined' ? data.likeCount : 0;
    
    var title     = ent.decode(data.title);
        title    += ' - Rating: ' + rating; 
        title    += ' - Views: '  + viewCount;
        title    += ' - Likes: '  + likeCount;
    
    return title;
};

titler.getYoutubeVideoInfo = function (url, callback) {
    var videoID = titler.getYoutubeVideoID(url);
    
    if (videoID) {
        var apiURL = titler.getYoutubeAPIURL(videoID);
        
        request(apiURL, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                callback(JSON.parse(body).data);
            }
        });
        
    } else {
        console.log('Failed to get video ID for url: ' + url);
    }
};

titler.getYoutubeAPIURL = function (videoID) {
    return 'https://gdata.youtube.com/feeds/api/videos/' + videoID + '?v=2&alt=jsonc';
};

titler.getYoutubeVideoID = function (url) {    
    var u       = require('url');
    var qs      = require('qs');
    
    var info    = u.parse(url);
    var query   = info.query;
    var videoID = '';
    
    if (query) {
        var qsInfo = qs.parse(info.query);        
        videoID    = qsInfo.v;        
    } else {
        if (info.hostname === 'youtu.be') {
            videoID = info.path.substring(1);
        }
    }
    
    return videoID;
};

titler.isYoutubeURL = function (host) {
    var looksLikeAYoutubeDomain  = host.indexOf('youtube.') > -1;
    var isShortenedYoutubeDomain = host === 'youtu.be';
    
    return looksLikeAYoutubeDomain || isShortenedYoutubeDomain;
};

titler.getImageInfo = function (path, callback) {
    easyimg.info(path, callback);
};

module.exports = titler;