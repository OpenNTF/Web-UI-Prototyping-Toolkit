"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var compileLessCssFile = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(parsedUrl.pathname);
    var file = rc.runtime.readFile(requestedFilePath);
    rc.project.sslc.handleCompileLessCss(requestedFilePath, file, rc.response);
};
module.exports = compileLessCssFile;