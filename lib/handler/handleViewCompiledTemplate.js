"use strict";
var templateComposer = require("../templateComposer");
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleViewCompiledTemplate = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(decodeURIComponent(parsedUrl.pathname));
    var pathName = parsedUrl.pathname;
    var ts = new Date().getTime();
    var composed;
    if (rc.runtime.cachingEnabled) {
        composed = rc.composer.composeTemplateCached(requestedFilePath);
    } else {
        composed = rc.composer.composeTemplate(requestedFilePath);
    }
    templateComposer.postProcessComposed(composed, rc.runtime, function (postProcessed) {
        rc.project.updateDynamic();
        var pc = postProcessed.toString();
        utils.writeResponse(rc.response, 200, {"Content-Type": "text/html; charset=utf-8"}, pc);
        rc.response.end();
        var te = new Date().getTime();
        var taken = te - ts;
        logger.info("Served " + pathName + " using " + requestedFilePath + " in " + taken + "ms");
        if (rc.runtime.readUserConfig().writeResponsesToFiles) {
            var responseFileName = requestedFilePath.substring(0, requestedFilePath.length - 5) + "-compiled.html";
            rc.runtime.writeFile(responseFileName, postProcessed, function () {
                logger.info("Wrote compiled version to " + responseFileName);
            });
        }
    });
};

module.exports = handleViewCompiledTemplate;