"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleEditData = function (rc) {
    var urlParts = url.parse(request.url, true);
    logger.info("Handling edit " + urlParts.query.path);
    var urlQuery = urlParts.query;
    var filename = runtime.findFileForUrlPathname(urlQuery.path);
    logger.info("Found file to edit: " + filename);
    var content = "" + runtime.readFile(filename);
    var data = {
        pathname: urlQuery.path,
        content: content
    };
    writeResponse(response, 200, {
        "Content-Type": "application/json; charset=utf-8"
    }, JSON.stringify(data));
};
module.exports = handleEditData;