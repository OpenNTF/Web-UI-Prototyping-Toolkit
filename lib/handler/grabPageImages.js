"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var grabPageImages = function (rc) {
    var imageUrlsData = '';
    req.on('data', function (data) {
        imageUrlsData += data;
        // Too much data
        if (imageUrlsData.length > 1e6)
            req.connection.destroy();
    });
    req.on('end', function () {
        var imageUrls = JSON.parse(imageUrlsData);
        var download = function(uri, filename, callback){
            if(uri.indexOf('flickr.com')>0 && uri.indexOf('_m.jpg') >0){
                uri = uri.replace('_m.jpg', '_b.jpg');
            }
            if(typeof filename !== 'string'){
                var imagesDir = runtime.constructProjectPath("images");
                if(!runtime.isExistingDirPath(imagesDir)){
                    copier.mkdirsSync(imagesDir);
                }
                filename = path.resolve(imagesDir, "image_downloaded_" + (new Date().getTime()) + path.extname(uri));
            }

            var file = _fs.createWriteStream(filename);
            var request = http.get(uri, function(response) {
                response.pipe(file);
                logger.info('Saved ' + uri + " to " + filename);
            });


        };
        imageUrls.forEach(function(iu){
            download(iu, undefined, function(filename){
                logger.info('Saved ' + iu + " to " + filename);
            });
        });
        resp.end();
    });
};
module.exports = grabPageImages;