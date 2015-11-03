"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var commandRequest = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    var command = parsedUrl.query.command;
    logger.info("Running command " + command);
    var responseData = projectCommands.handleCommandRequest(command, rc.request, rc.response);
    if (typeof responseData === 'object') {
        if (responseData.status === 302) {
            rc.response.writeHead(responseData.status, responseData.headers);
            rc.response.end();
        } else {
            utils.writeResponse(rc.response, responseData.status, responseData.headers, responseData.content);
        }
    } else {
        logger.info("No response for command " + command);
    }
};
module.exports = commandRequest;