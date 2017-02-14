"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var handleRedirectToDirectoryIndex = function (rc) {
    var pathName = url.parse(rc.request.url, true).pathname;
    var dirFn = pathName;
    if (dirFn.charAt(dirFn.length - 1) === "/") {
        dirFn = dirFn.substring(0, dirFn.length - 1);
    }
    dirFn += rc.runtime.readUserConfig().defaultPageTemplatePath;
    logger.info("Redirecting dir request : " + pathName);
    rc.response.writeHead(302, {
        Location: "http://" + rc.request.headers.host + dirFn
    });
    rc.response.end();
};
module.exports = handleRedirectToDirectoryIndex;