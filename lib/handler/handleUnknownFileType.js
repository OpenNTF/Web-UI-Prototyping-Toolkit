"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleUnknownFileType = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(parsedUrl.pathname);
    logger.error("Unknown file type while resolving " + parsedUrl.pathname + " : " + requestedFilePath);
    //handleUnknownFiletype(response, filename);
    var responseHeaders = {"Content-Type": "text/plain; charset=utf-8"};
    var statusCode = 500;
    var responseContent = "500 Unknown filetype  : " + requestedFilePath + "\n";
    utils.writeResponse(rc.response, statusCode, responseHeaders, responseContent);
};
module.exports = handleUnknownFileType;