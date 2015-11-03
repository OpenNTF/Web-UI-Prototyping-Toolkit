"use strict";
var utils = require("../utils");
var url = require("url");
var projectCommands = require("../projectCommands");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var commandNamesJSON = function (rc) {
    var cmdNames = projectCommands.createCommandInfo();
    utils.writeResponse(rc.response, 200, {
        'Content-Type': 'application/json'
    }, JSON.stringify(cmdNames));
};
module.exports = commandNamesJSON;