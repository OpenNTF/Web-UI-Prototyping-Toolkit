"use strict";

var url = require("url");
var path = require("path");
var fs = require('fs');
var http= require("http");
var utils = require("../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
var copier = require("fsops");


//var http = require('http');


var downloadFile = function(url, dest, cb) {
    var file = fs.createWriteStream(dest);
    var request = http.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(cb);  // close() is async, call cb after close completes.
        });
    }).on('error', function(err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        if (cb) {
            cb(err.message);
        }
    });
};

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var grabPageImages = function (rc) {
    var imageUrlsData = '';
    var req = rc.request;
    var resp = rc.response;
    req.on('data', function (data) {
        imageUrlsData += data;
        if (imageUrlsData.length > 1e6){
            req.connection.destroy();
        }
    });
    req.on('end', function () {
        var imageUrls = JSON.parse(imageUrlsData);
        var downloadImage = function(){
            if(imageUrls.length > 0){
                var imgUrl = imageUrls.shift();
                download(imgUrl, undefined, function(){
                    setTimeout(function(){
                        downloadImage();
                    }, 500 + (Math.random()*1000));
                });
            }else{
                logger.info("No images to download");
            }
        };

        var download = function(theUri, theFilename, callback){
            var uri = theUri;
            var filename = theFilename;
            if(uri.indexOf('flickr.com')>0 && uri.indexOf('_m.jpg') >0){
                uri = uri.replace('_m.jpg', '_b.jpg');
            }
            if(typeof filename !== 'string'){
                var imagesDir = rc.runtime.constructProjectPath("images");
                if(!rc.runtime.isExistingDirPath(imagesDir)){
                    copier.mkdirsSync(imagesDir);
                }
                filename = path.resolve(imagesDir, "image_downloaded_" + (new Date().getTime()) + path.extname(uri));
            }
            downloadFile(uri, filename, function() {
                //response.pipe(file);
                logger.info('Saved ' + uri + " to " + filename);
                if(callback){
                    callback(filename);
                }
            });
        };
        downloadImage();
        resp.end();
    });
};
module.exports = grabPageImages;