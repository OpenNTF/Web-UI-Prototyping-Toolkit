"use strict";
var url = require("url");
var path = require("path");
var utils = require("../utils");
var sassCompiler;

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var transparantSassyCss = function (rc) {
    if(!sassCompiler){
        sassCompiler = require("../sassCompiler");
    }
    var parsedUrl = url.parse(rc.request.url, true);
    var urlPathname = decodeURIComponent(parsedUrl.pathname);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(urlPathname);
    var sassInfo = utils.findCssPreProcessorInfo(requestedFilePath, ".scss");
    if (sassInfo) {
        var sassCode = rc.runtime.readFile(sassInfo.sourceFilePath);
        sassCompiler.renderSass(sassCode, [path.dirname(sassInfo.sourceFilePath)], path.basename(requestedFilePath), function (css, cssmap, stats) {
            if (sassInfo.outputFormat === 'map') {
                logger.debug("writing cssmap");
                rc.response.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
                rc.response.write(JSON.stringify(cssmap));
            } else {
                logger.debug("writing css");
                rc.response.writeHead(200, {"Content-Type": "text/css; charset=utf-8"});
                rc.response.write(css.toString());
            }
            rc.response.end();
        });
    } else {
        throw new Error("Cannot handle " + urlPathname + " => " + requestedFilePath);
        //handlers.handleCantResolveNonExistingFileRequest(rc.request, rc.response);
    }
};
module.exports = transparantSassyCss;