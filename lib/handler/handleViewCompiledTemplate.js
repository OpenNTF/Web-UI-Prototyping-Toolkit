"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var handleViewCompiledTemplate = function (rc) {
    var ts = new Date().getTime();
    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(decodeURIComponent(parsedUrl.pathname));
    var pathName = parsedUrl.pathname;

    setImmediate(function(){
        var composed;
        if (rc.runtime.cachingEnabled) {
            composed = rc.composer.composeTemplateCached(requestedFilePath);
        } else {
            composed = rc.composer.composeTemplate(requestedFilePath);
        }

        rc.composer.postProcessComposed(composed, rc.runtime, function (postProcessed) {
            rc.project.updateDynamic();
            var pc = postProcessed.toString();
            utils.writeResponse(rc.response, 200, {"Content-Type": "text/html; charset=utf-8"}, pc);
            rc.response.end();
            var te = new Date().getTime();
            var taken = te - ts;
            logger.info("Served " + pathName + " in " + taken + "ms");
            if (rc.runtime.readUserConfig().writeResponsesToFiles) {
                var responseFileName = requestedFilePath.substring(0, requestedFilePath.length - 5) + "-compiled.html";
                rc.runtime.writeFile(responseFileName, postProcessed, function () {
                    logger.info("Wrote compiled version to " + responseFileName);
                });
            }
        });
    });

};

module.exports = handleViewCompiledTemplate;