"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleSavePartSourceUpdate = function (rc) {
    var saveSourceUpdateToFile = function (updateRequest, request, response) {
        var ur = updateRequest;
        logger.info("updating part source for " + ur.pathname);
        var pathName = runtime.findFileForUrlPathname(ur.pathname);
        if (!runtime.isProjectPath(pathName)) {
            logger.error("Refusing to write outside of project" + pathName);
            return false;
        }
        var content = ur.content;
        logger.info("Writing to " + pathName);
        runtime.writeFile(pathName, content);
        return true;
    };
    var body = '';
    request.on('data', function (data) {
        body += data;
        // Too much data
        if (body.length > 1e6)
            request.connection.destroy();
    });
    request.on('end', function () {
        var contentUpdateReq = JSON.parse(body);
        logger.info("SAVE REQ = ", contentUpdateReq);
        if (saveSourceUpdateToFile(contentUpdateReq, request, response)) {
            writeResponse(response, 200, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"ok"}');
        } else {
            writeResponse(response, 406, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"fail"}');
        }
    });
};
module.exports = handleSavePartSourceUpdate;