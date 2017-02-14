"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var handleEditData = function (rc) {
    logger.info("Handling edit " + rc.wr.getQueryParam('path'));
    var filename = rc.runtime.findFileForUrlPathname(rc.wr.getQueryParam('path'));
    logger.info("Found file to edit: " + filename);
    var content = "" + rc.runtime.readFile(filename);
    var data = {
        pathname: rc.wr.getQueryParam('path'),
        content: content
    };
    utils.writeResponse(rc.response, 200, {
        "Content-Type": "application/json; charset=utf-8"
    }, JSON.stringify(data));
};
module.exports = handleEditData;