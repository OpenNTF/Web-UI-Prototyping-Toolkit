"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var transparantSassyCss = function (rc) {
    var parsedUrl = url.parse(request.url, true);
    var urlPathname = decodeURIComponent(parsedUrl.pathname);
    var requestedFilePath = runtime.findFileForUrlPathname(urlPathname);
    var sassInfo = utils.findCssPreProcessorInfo(requestedFilePath, ".scss");
    if (sassInfo) {
        var sassCode = runtime.readFile(sassInfo.sourceFilePath);
        sassCompiler.renderSass(sassCode, [path.dirname(sassInfo.sourceFilePath)], path.basename(requestedFilePath), function (css, cssmap, stats) {
            if (sassInfo.outputFormat === 'map') {
                logger.debug("writing cssmap");
                response.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
                response.write(JSON.stringify(cssmap));
            } else {
                logger.debug("writing css");
                response.writeHead(200, {"Content-Type": "text/css; charset=utf-8"});
                response.write(css.toString());
            }
            response.end();
        });
    } else {
        throw new Error("Cannot handle " + urlPathname + " => " + requestedFilePath);
        handlers.handleCantResolveNonExistingFileRequest(request, response);
    }
};
module.exports = transparantSassyCss;