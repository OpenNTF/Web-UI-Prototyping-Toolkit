"use strict";
var utils = require("../utils");
var url = require("url");
var mime = require("mime");
var fs = require("../filesystem");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var serveExistingCssFile = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(decodeURIComponent(parsedUrl.pathname));
    fs.readFile(requestedFilePath).done(function (file) {
        var fileMime = mime.lookup(requestedFilePath);
        if (fileMime && (fileMime.indexOf("text/") === 0 || fileMime.indexOf('application/json') === 0 || fileMime.indexOf('application/javascript') === 0)) {
            utils.writeResponse(rc.response, 200, {
                "Content-Type": fileMime
            }, file);
        } else {
            utils.writeBinaryResponse(rc.response, 200, {
                "Content-Type": fileMime
            }, file);
        }
    }, function (err) {
        logger.error("Existing css file to serve does not exist: " + requestedFilePath, err.stack);
        utils.writeResponse(rc.response, 404, {
            "Content-Type": "text/plain; charset=utf-8"
        }, "File could not be found");
    });
};
module.exports = serveExistingCssFile;