"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var unknownDynamicDataRequest = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    logger.info("Unknown path " + parsedUrl.pathname, parsedUrl.query);
    rc.response.end();
};
module.exports = unknownDynamicDataRequest;