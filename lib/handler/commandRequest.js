"use strict";
var utils = require("../utils");
var url = require("url");
var projectCommands = require("../projectCommands");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var commandRequest = function (rc) {
    var command = rc.wr.getQueryParam('command');
    logger.debug("Running command " + command);
    var responseData = projectCommands.runCommand(command, rc);
    if (typeof responseData === 'object') {
        if (responseData.status === 302) {
            rc.response.writeHead(responseData.status, responseData.headers);
            rc.response.end();
        } else {
            utils.writeResponse(rc.response, responseData.status, responseData.headers, responseData.content);
        }
    } else {
        logger.debug("No response for command " + command);
    }
};
module.exports = commandRequest;