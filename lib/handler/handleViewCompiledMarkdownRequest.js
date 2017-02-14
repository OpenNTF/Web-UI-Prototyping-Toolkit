"use strict";
var utils = require("../utils");
var url = require("url");
var markdownHelper = require("../markdownHelper");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var handleViewCompiledMarkdownRequest = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    utils.writeResponse(rc.response, 200, {
        "Content-Type": "text/html; charset=utf-8"
    }, markdownHelper.compileMarkdown(rc.runtime.readFile(rc.runtime.findFileForUrlPathname(parsedUrl.pathname))));
};
module.exports = handleViewCompiledMarkdownRequest;