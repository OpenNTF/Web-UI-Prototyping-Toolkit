"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var serveExistingFile = function (rc) {
    if(!this.hasOwnProperty("staticCache")){
        this.staticCache = {};
    }

    var parsedUrl = url.parse(request.url, true);
    var requestedFilePath = runtime.findFileForUrlPathname(decodeURIComponent(parsedUrl.pathname));

    var t = this;
    fs.stat(requestedFilePath).done(function (stat) {
        var atime = stat.ctime.getTime();
        var cached = false;

        if(enableFileCaching && t.staticCache.hasOwnProperty(requestedFilePath)){
            cached = t.staticCache[requestedFilePath];
            if(atime <= cached.lastModified){
                if(cached.binary){
                    writeBinaryResponse(response, 200, {
                        "Content-Type": cached.mime,
                        "Content-Length": cached.size
                    }, cached.data);
                    logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime)
                }else{
                    writeResponse(response, 200, {
                        "Content-Type": cached.mime,
                        "Content-Length": cached.size
                    }, cached.data);
                    logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime)
                }
            }else{
                cached = false;
            }
        }
        if(!cached){
            var fileMime = mime.lookup(requestedFilePath);
            if (fileMime && (fileMime.indexOf("text/") === 0 || fileMime.indexOf('application/json') === 0 || fileMime.indexOf('application/javascript') === 0)) {
                cached = {
                    data: runtime.readFile(requestedFilePath),
                    size : stat.size,
                    mime: fileMime,
                    binary: false,
                    lastModified : atime
                };

            } else {
                cached = {
                    data: utils.readBinaryFileSync(requestedFilePath),
                    size : stat.size,
                    mime: fileMime,
                    binary: true,
                    lastModified : atime
                };

            }
            if(enableFileCaching){
                t.staticCache[requestedFilePath] = cached;
            }

            if(cached.binary){
                writeBinaryResponse(response, 200, {
                    "Content-Type": cached.mime,
                    "Content-Length": cached.size
                }, cached.data);
                logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime)
            }else{
                var acceptEncoding = request.headers['accept-encoding'];
                //console.log("ACCEPT == " + acceptEncoding);
                if(acceptEncoding){
                    var raw = new stream.Readable();
                    raw._read = function noop() {}; // redundant? see update below
                    raw.push(cached.data);
                    raw.push(null);

                    if (acceptEncoding.indexOf("deflate") >=0) {
                        response.writeHead(200, { 'content-type':cached.mime,'content-encoding': 'deflate' });
                        raw.pipe(zlib.createDeflate()).pipe(response);
                    } else if (acceptEncoding.indexOf("gzip") >=0) {
                        response.writeHead(200, { 'content-type':cached.mime,'content-encoding': 'gzip' });
                        raw.pipe(zlib.createGzip()).pipe(response);
                    } else {
                        writeResponse(response, 200, {
                            "Content-Type": cached.mime,
                            "Content-Length": cached.size
                        }, cached.data);
                    }

                }else{
                    writeResponse(response, 200, {
                        "Content-Type": cached.mime,
                        "Content-Length": cached.size
                    }, cached.data);
                }



                logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime)
            }
        }
    }, function (err) {
        logger.error("Existing file to serve does not exist: " + requestedFilePath, err.stack);
        writeResponse(response, 404, {
            "Content-Type": "text/plain; charset=utf-8"
        }, "File could not be found");
    });
};
module.exports = serveExistingFile;