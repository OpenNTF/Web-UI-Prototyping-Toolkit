"use strict";
var utils = require("../utils");
var url = require("url");
var fs = require("../filesystem");
var rfs = require("fs");
var mime = require("mime");
var stream = require("stream");
var zlib = require("zlib");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var serveExistingFile = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(decodeURIComponent(parsedUrl.pathname));

    var handleFileNotFound = function handleFileNotFound(err) {
        logger.error("Existing file to serve does not exist: " + requestedFilePath, err.stack);
        utils.writeResponse(rc.response, 404, {
            "Content-Type": "text/plain; charset=utf-8"
        }, "File could not be found");
    };

    var handleExists = function handleExists(stat) {
        var changeTime = stat.ctime.getTime();
        var cached = false;
        var before = new Date().getTime();
        var fileMime = mime.lookup(requestedFilePath);
        var after = new Date().getTime();
        var mimeDiff = after-before;
        // console.log("Mime in " + mimeDiff + "ms : " + requestedFilePath);
        var textual = fileMime && (fileMime.indexOf("text/") === 0 || fileMime.indexOf('application/json') === 0 || fileMime.indexOf('application/javascript') === 0);
        if (textual) {
            cached = {
                data: rc.runtime.readFile(requestedFilePath),
                size : stat.size,
                mime: fileMime,
                binary: false,
                lastModified : changeTime
            };
            utils.writeResponse(rc.response, 200, {
                "Content-Type": cached.mime,
                "Content-Length": cached.size
            }, cached.data);

            // var acceptEncoding = rc.request.headers['accept-encoding'];
            // //console.log("ACCEPT == " + acceptEncoding);
            // if(acceptEncoding){
            //     var raw;
            //
            //
            //     if (acceptEncoding.indexOf("deflate") >=0) {
            //         raw = new stream.Readable();
            //         raw._read = function noop() {}; // redundant? see update below
            //         raw.push(cached.data);
            //         raw.push(null);
            //         rc.response.writeHead(200, { 'content-type':cached.mime,'content-encoding': 'deflate' });
            //         raw.pipe(zlib.createDeflate()).pipe(rc.response);
            //     } else if (acceptEncoding.indexOf("gzip") >=0) {
            //         raw = new stream.Readable();
            //         raw._read = function noop() {}; // redundant? see update below
            //         raw.push(cached.data);
            //         raw.push(null);
            //         rc.response.writeHead(200, { 'content-type':cached.mime,'content-encoding': 'gzip' });
            //         raw.pipe(zlib.createGzip()).pipe(rc.response);
            //     } else {
            //         utils.writeResponse(rc.response, 200, {
            //             "Content-Type": cached.mime,
            //             "Content-Length": cached.size
            //         }, cached.data);
            //     }
            // }else{
            //     utils.writeResponse(rc.response, 200, {
            //         "Content-Type": cached.mime,
            //         "Content-Length": cached.size
            //     }, cached.data);
            // }
            // logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime);

        } else {
            rc.response.writeHead(200, {
                "Content-Type": fileMime,
                "Content-Length": stat.size
            });
            var rstream = rfs.createReadStream(requestedFilePath);
            rstream.pipe(rc.response);
            // rc.response.end();
            // cached = {
            //     data: utils.readBinaryFileSync(requestedFilePath),
            //     size : stat.size,
            //     mime: fileMime,
            //     binary: true,
            //     lastModified : changeTime
            // };
            // utils.writeBinaryResponse(rc.response, 200, {
            //     "Content-Type": cached.mime,
            //     "Content-Length": cached.size
            // }, cached.data);
            // logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime);
        }
    };
    fs.stat(requestedFilePath).done(handleExists, handleFileNotFound);
};
module.exports = serveExistingFile;