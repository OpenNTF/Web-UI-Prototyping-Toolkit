"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleViewCompiledMarkdownRequest = function (rc) {
    var parsedUrl = url.parse(request.url, true);
    writeResponse(response, 200, {
        "Content-Type": "text/html; charset=utf-8"
    }, markdownHelper.compileMarkdown(runtime.readFile(runtime.findFileForUrlPathname(parsedUrl.pathname))));
};
module.exports = handleViewCompiledMarkdownRequest;