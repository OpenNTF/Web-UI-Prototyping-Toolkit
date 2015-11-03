"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var compileLessCssFile = function (rc) {
    var parsedUrl = url.parse(request.url, true);
    var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
    var file = runtime.readFile(requestedFilePath);
    serversideLessCompiler.handleCompileLessCss(requestedFilePath, file, response);
};
module.exports = compileLessCssFile;