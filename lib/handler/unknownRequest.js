"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var unknownRequest = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    logger.info("Unknown " + rc.request.method + " request: " + parsedUrl.pathname, parsedUrl.query);
    rc.response.writeHead(404);
    rc.response.end();
};
module.exports = unknownRequest;