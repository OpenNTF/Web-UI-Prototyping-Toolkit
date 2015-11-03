"use strict";
var utils = require("../utils");
var url = require("url");
var jadeUtils = require("../jadeUtils");
var templateComposer = require("../templateComposer");
var path = require("path");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleViewCompiledJadeTemplate = function (rc) {
    var ts = new Date().getTime();
    var parsedUrl = url.parse(rc.request.url, true);
    var urlPathname = parsedUrl.pathname;
    logger.info("Rendering JADE for " + urlPathname);
    var urlPathWithoutSlash = urlPathname.substring(1);
    var urlPathFilenamePart = path.basename(urlPathWithoutSlash);
    var urlPathExtname = path.extname(urlPathFilenamePart);
    var jadeUrlPathname = "";
    if (urlPathExtname === '.html') {
        jadeUrlPathname = urlPathname.substring(0, urlPathname.lastIndexOf('.')) + ".jade";
    } else if (!urlPathExtname) {
        jadeUrlPathname = urlPathname + ".jade";
    } else {
        throw new Error("Cannot handle " + urlPathname);
    }
    var jadeFilePath = rc.runtime.findFileForUrlPathname(jadeUrlPathname);
    var html = jadeUtils.compileJadeFile(jadeFilePath);
    var composed;
    if (rc.runtime.cachingEnabled) {
        composed = rc.composer.composeTemplateCached(jadeFilePath, html);
    } else {
        composed = rc.composer.composeTemplate(jadeFilePath, html);
    }
    templateComposer.postProcessComposed(composed, rc.runtime, function (postProcessed) {
        rc.project.updateDynamic();
        var pc = postProcessed.toString();
        utils.writeResponse(rc.response, 200, {"Content-Type": "text/html; charset=utf-8"}, pc);
        var te = new Date().getTime();
        var taken = te - ts;
        logger.info("Served " + urlPathname + " using " + jadeFilePath + " in " + taken + "ms");
        if (rc.runtime.readUserConfig().writeResponsesToFiles) {
            var responseFileName = jadeFilePath.substring(0, jadeFilePath.length - 5) + "-compiled.html";
            rc.runtime.writeFile(responseFileName, postProcessed, function () {
                logger.info("Wrote compiled version to " + responseFileName);
            });
        }
    });
};
module.exports = handleViewCompiledJadeTemplate;