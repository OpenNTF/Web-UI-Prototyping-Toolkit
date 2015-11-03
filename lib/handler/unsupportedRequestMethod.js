"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var unsupportedRequestMethod = function (rc) {
    var errorMsg = "Unhandled request method: " + request.method + " " + request.url;
    logger.error(errorMsg);
    response.writeHead(404, {
        Accept: "text/plain"
    });
    response.write(errorMsg);
    response.end();
};
module.exports = unsupportedRequestMethod;