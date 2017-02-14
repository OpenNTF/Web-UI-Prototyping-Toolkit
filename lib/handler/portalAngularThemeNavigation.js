"use strict";
var utils = require("../utils");
var url = require("url");
var portalNavGen = require("../portalNavigationProducer");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var portalAngularThemeNavigation = function (rc) {
    var nav = portalNavGen.generateNavigation(rc.project);
    utils.writeResponse(rc.response, 200, {
        "Content-Type": "application/json; charset=utf-8"
    }, JSON.stringify(nav));
};
module.exports = portalAngularThemeNavigation;