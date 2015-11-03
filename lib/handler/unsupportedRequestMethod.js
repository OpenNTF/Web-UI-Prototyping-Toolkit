"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var unsupportedRequestMethod = function (rc) {
    var errorMsg = "Unhandled request method: " + rc.request.method + " " + rc.request.url;
    logger.error(errorMsg);
    rc.response.writeHead(404, {
        Accept: "text/plain"
    });
    rc.response.write(errorMsg);
    rc.response.end();
};
module.exports = unsupportedRequestMethod;