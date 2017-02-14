"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var handleSavePartSourceUpdate = function (rc) {
    var saveSourceUpdateToFile = function (updateRequest, request, response) {
        var ur = updateRequest;
        logger.info("updating part source for " + ur.pathname);
        var pathName = rc.runtime.findFileForUrlPathname(ur.pathname);
        if (!rc.runtime.isProjectPath(pathName)) {
            logger.error("Refusing to write outside of project" + pathName);
            return false;
        }
        var content = ur.content;
        logger.info("Writing to " + pathName);
        rc.runtime.writeFile(pathName, content);
        return true;
    };
    var body = '';
    rc.request.on('data', function (data) {
        body += data;
        // Too much data
        if (body.length > 1e6) {
            rc.request.connection.destroy();
        }
    });
    rc.request.on('end', function () {
        var contentUpdateReq = JSON.parse(body);
        logger.info("SAVE REQ = ", contentUpdateReq);
        if (saveSourceUpdateToFile(contentUpdateReq, rc.request, rc.response)) {
            utils.writeResponse(rc.response, 200, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"ok"}');
        } else {
            utils.writeResponse(rc.response, 406, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"fail"}');
        }
    });
};
module.exports = handleSavePartSourceUpdate;