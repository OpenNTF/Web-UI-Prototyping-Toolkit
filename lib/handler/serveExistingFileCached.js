"use strict";
var utils = require("../utils");
var url = require("url");
var fs = require("../filesystem");
var mime = require("mime");
var stream = require("stream");
var zlib = require("zlib");
var logger = utils.createLogger({sourceFilePath : __filename});

var enableFileCaching = false;

/**
 *
 * @param {RequestContext} rc
 */
var serveExistingFile = function (rc) {
    if(enableFileCaching){
        if(!this.hasOwnProperty("staticCache")){
            this.staticCache = {};
        }
    }

    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(decodeURIComponent(parsedUrl.pathname));

    var t = this;
    fs.stat(requestedFilePath).done(function (stat) {
        var changeTime = stat.ctime.getTime();
        var cached = false;

        if(enableFileCaching && t.staticCache.hasOwnProperty(requestedFilePath)){
            cached = t.staticCache[requestedFilePath];
            if(changeTime <= cached.lastModified){
                if(cached.binary){
                    utils.writeBinaryResponse(rc.response, 200, {
                        "Content-Type": cached.mime,
                        "Content-Length": cached.size
                    }, cached.data);
                    logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime);
                }else{
                    utils.writeResponse(rc.response, 200, {
                        "Content-Type": cached.mime,
                        "Content-Length": cached.size
                    }, cached.data);
                    logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime);
                }
            }else{
                cached = false;
            }
        }
        setImmediate(function(){
            if(!cached){
                var fileMime = mime.lookup(requestedFilePath);
                if (fileMime && (fileMime.indexOf("text/") === 0 || fileMime.indexOf('application/json') === 0 || fileMime.indexOf('application/javascript') === 0)) {
                    cached = {
                        data: rc.runtime.readFile(requestedFilePath),
                        size : stat.size,
                        mime: fileMime,
                        binary: false,
                        lastModified : changeTime
                    };
                } else {
                    cached = {
                        data: utils.readBinaryFileSync(requestedFilePath),
                        size : stat.size,
                        mime: fileMime,
                        binary: true,
                        lastModified : changeTime
                    };
                }
                if(enableFileCaching){
                    t.staticCache[requestedFilePath] = cached;
                }
                if(cached.binary){
                    utils.writeBinaryResponse(rc.response, 200, {
                        "Content-Type": cached.mime,
                        "Content-Length": cached.size
                    }, cached.data);
                    logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime);
                }else{
                    var acceptEncoding = rc.request.headers['accept-encoding'];
                    //console.log("ACCEPT == " + acceptEncoding);
                    if(acceptEncoding){
                        var raw;


                        if (acceptEncoding.indexOf("deflate") >=0) {
                            raw = new stream.Readable();
                            raw._read = function noop() {}; // redundant? see update below
                            raw.push(cached.data);
                            raw.push(null);
                            rc.response.writeHead(200, { 'content-type':cached.mime,'content-encoding': 'deflate' });
                            raw.pipe(zlib.createDeflate()).pipe(rc.response);
                        } else if (acceptEncoding.indexOf("gzip") >=0) {
                            raw = new stream.Readable();
                            raw._read = function noop() {}; // redundant? see update below
                            raw.push(cached.data);
                            raw.push(null);
                            rc.response.writeHead(200, { 'content-type':cached.mime,'content-encoding': 'gzip' });
                            raw.pipe(zlib.createGzip()).pipe(rc.response);
                        } else {
                            utils.writeResponse(rc.response, 200, {
                                "Content-Type": cached.mime,
                                "Content-Length": cached.size
                            }, cached.data);
                        }
                    }else{
                        utils.writeResponse(rc.response, 200, {
                            "Content-Type": cached.mime,
                            "Content-Length": cached.size
                        }, cached.data);
                    }
                    logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime);
                }
            }
        });
    }, function (err) {
        logger.error("Existing file to serve does not exist: " + requestedFilePath, err.stack);
        utils.writeResponse(rc.response, 404, {
            "Content-Type": "text/plain; charset=utf-8"
        }, "File could not be found");
    });
};
module.exports = serveExistingFile;