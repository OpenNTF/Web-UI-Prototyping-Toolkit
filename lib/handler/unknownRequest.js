"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var unknownRequest = function (rc) {
    var parsedUrl = url.parse(request.url, true);
    logger.info("Unknown " + request.method + " request: " + parsedUrl.pathname, parsedUrl.query);
    response.writeHead(404);
    response.end();
};
module.exports = unknownRequest;