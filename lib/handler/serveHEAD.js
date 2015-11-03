"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var serveHEAD = function (rc) {
    var urlParts = url.parse(request.url, true);
    var urlPathName = decodeURIComponent(urlParts.pathname);
    var filename = runtime.findFileForUrlPathname(urlPathName);
    logger.info("Serving head for " + urlPathName + " => " + filename);
    fs.stat(filename).done(function (stat) {
        if (stat.isDirectory()) {
            response.writeHead(301, {
                Location: "http://" + request.headers.host + urlPathName + "/index.html"
            });
            response.end();
        } else if (stat.isFile()) {
            response.writeHead(200, {
                "Content-Type": mime.lookup(filename),
                "Server": "protostar",
                "Last-Modified": new Date(stat.mtime).toString(),
                "Content-Length": stat.size
            });
            response.end();
        } else {
            logger.error("Unknown file type while resolving " + urlPathName + " : " + filename);
            handlers.unknownRequest(request, response);
        }
    }, function (errNoSuchFile) {
        var cssMapSuffix = '.css.map';
        var cssSuffix = '.css';
        var endsWith = function (str, postfix) {
            return str.length >= postfix.length && str.substring(str.length - postfix.length) === postfix;
        };
        var lessPath = false;
        var sassPath = false;
        var map = false;
        if (endsWith(filename, cssMapSuffix)) {
            lessPath = filename.substring(0, filename.length - cssMapSuffix.length) + ".less";
            sassPath = filename.substring(0, filename.length - cssMapSuffix.length) + ".scss";
            map = true;
        } else if (endsWith(filename, cssSuffix)) {
            lessPath = filename.substring(0, filename.length - cssSuffix.length) + ".less";
            sassPath = filename.substring(0, filename.length - cssSuffix.length) + ".scss";
        }
        logger.info("lessPath = " + lessPath);
        logger.info("sassPath = " + sassPath);
        if (lessPath && runtime.isExistingFilePath(lessPath)) {
            response.writeHead(200, {
                "Content-Type": "text/css; charset=utf-8",
                "Server": "protostar"
            });
            response.end();
        } else if (sassPath && runtime.isExistingFilePath(sassPath)) {
            response.writeHead(200, {
                "Content-Type": "text/css; charset=utf-8",
                "Server": "protostar"
            });
            response.end();
        } else {
            if (!runtime.lenient) {
                throw new Error("Non existing path while resolving for HEAD " + urlPathName + " : " + filename);
            }
            logger.error("Non existing path while resolving for HEAD " + urlPathName + " : " + filename);
            handlers.unknownRequest(request, response);
        }
    });
};
module.exports = serveHEAD;