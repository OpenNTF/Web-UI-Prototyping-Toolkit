"use strict";
const utils = require("../utils");
let url = require('url');
const projectCommands = require("../projectCommands");
let logger = utils.createLogger({sourceFilePath: __filename});

/**
 *
 * @param {RequestContext} rc
 */
module.exports = function (rc) {
    const cmdNames = projectCommands.createCommandInfo();
    rc.writeJson(cmdNames);
};