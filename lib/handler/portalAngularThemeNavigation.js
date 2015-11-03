"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var portalAngularThemeNavigation = function (rc) {
    var nav = portalNavGen.generateNavigation(project);
    writeResponse(response, 200, {
        "Content-Type": "application/json; charset=utf-8"
    }, JSON.stringify(nav));
};
module.exports = portalAngularThemeNavigation;