"use strict";
var url = require("url");
var mime = require("mime");
var utils = require("../utils");
var fs = require("../filesystem");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var serveHEAD = function (rc) {
    var urlParts = url.parse(rc.request.url, true);
    var urlPathName = decodeURIComponent(urlParts.pathname);
    var filename = rc.runtime.findFileForUrlPathname(urlPathName);
    logger.info("Serving head for " + urlPathName + " => " + filename);
    fs.stat(filename).done(function (stat) {
        if (stat.isDirectory()) {
            rc.response.writeHead(301, {
                Location: "http://" + rc.request.headers.host + urlPathName + "/index.html"
            });
            rc.response.end();
        } else if (stat.isFile()) {
            rc.response.writeHead(200, {
                "Content-Type": mime.lookup(filename),
                "Server": "protostar",
                "Last-Modified": new Date(stat.mtime).toString(),
                "Content-Length": stat.size
            });
            rc.response.end();
        } else {
            logger.error("Unknown file type while resolving " + urlPathName + " : " + filename);
            var parsedUrl = url.parse(rc.request.url, true);
            logger.info("Unknown " + rc.request.method + " request: " + parsedUrl.pathname, parsedUrl.query);
            rc.response.writeHead(404);
            rc.response.end();
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
        if (lessPath && rc.runtime.isExistingFilePath(lessPath)) {
            rc.response.writeHead(200, {
                "Content-Type": "text/css; charset=utf-8",
                "Server": "protostar"
            });
            rc.response.end();
        } else if (sassPath && rc.runtime.isExistingFilePath(sassPath)) {
            rc.response.writeHead(200, {
                "Content-Type": "text/css; charset=utf-8",
                "Server": "protostar"
            });
            rc.response.end();
        } else {
            if (!rc.runtime.lenient) {
                throw new Error("Non existing path while resolving for HEAD " + urlPathName + " : " + filename);
            }
            logger.error("Non existing path while resolving for HEAD " + urlPathName + " : " + filename);
            var parsedUrl = url.parse(rc.request.url, true);
            logger.info("Unknown " + rc.request.method + " request: " + parsedUrl.pathname, parsedUrl.query);
            rc.response.writeHead(404);
            rc.response.end();
        }
    });
};
module.exports = serveHEAD;