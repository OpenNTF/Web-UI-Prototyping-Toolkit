"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleRedirectToDirectoryIndex = function (rc) {
    var pathName = url.parse(request.url, true).pathname;
    var dirFn = pathName;
    if (dirFn.charAt(dirFn.length - 1) === "/") {
        dirFn = dirFn.substring(0, dirFn.length - 1);
    }
    dirFn += runtime.readUserConfig().defaultPageTemplatePath;
    logger.info("Redirecting dir request : " + pathName);
    response.writeHead(302, {
        Location: "http://" + request.headers.host + dirFn
    });
    response.end();
};
module.exports = handleRedirectToDirectoryIndex;