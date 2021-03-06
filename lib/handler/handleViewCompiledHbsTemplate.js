"use strict";
var utils = require("../utils");
var url = require("url");
var path = require("path");
var fs = require("fs");
var hbsUtils = require("../hbsUtils");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var handleViewCompiledHbsTemplate = function (rc) {
    var ts = new Date().getTime();
    var parsedUrl = url.parse(rc.request.url, true);
    var urlPathname = parsedUrl.pathname;
    logger.info("Rendering HBS for " + urlPathname);
    var urlPathWithoutSlash = urlPathname.substring(1);
    var urlPathFilenamePart = path.basename(urlPathWithoutSlash);
    var urlPathExtname = path.extname(urlPathFilenamePart);
    var hbsUrlPathname;
    if (urlPathExtname === '.html') {
        hbsUrlPathname = urlPathname.substring(0, urlPathname.lastIndexOf('.')) + ".hbs";
    } else if (!urlPathExtname) {
        hbsUrlPathname = urlPathname + ".hbs";
    } else if(urlPathExtname !== '.hbs' ){
        throw new Error("Cannot handle " + urlPathname);
    }else{
        hbsUrlPathname = urlPathname;
    }

    logger.debug("Looking for file for " + hbsUrlPathname);
    var hbsFilePath = rc.runtime.findFileForUrlPathname(hbsUrlPathname);
    logger.debug("reading hbs path : ", hbsFilePath);
    var hbsSrc = fs.readFileSync(hbsFilePath, 'utf8');

    var pcfg = rc.runtime.readProjectConfig();

    hbsSrc = hbsUtils.convertPartialsToFileIncludes(hbsSrc, pcfg.hbs.partialsDir);
    hbsSrc = hbsUtils.injectHbsLayoutBodyContent(rc.runtime.constructProjectPath(pcfg.hbs.layout), hbsSrc);
    var composed;
    if (rc.runtime.cachingEnabled) {
        composed = rc.composer.composeTemplateCached(hbsFilePath, hbsSrc);
    } else {
        composed = rc.composer.composeTemplate(hbsFilePath, hbsSrc);
    }

    rc.composer.postProcessComposed(composed, rc.runtime, function (postProcessed) {
        rc.project.updateDynamic();
        var pc = postProcessed.toString();
        utils.writeResponse(rc.response, 200, {"Content-Type": "text/html; charset=utf-8"}, pc);
        var te = new Date().getTime();
        var taken = te - ts;
        logger.info("Served " + urlPathname + " using " + hbsFilePath + " in " + taken + "ms");
        if (rc.runtime.readUserConfig().writeResponsesToFiles) {
            var responseFileName = hbsFilePath.substring(0, hbsFilePath.length - 5) + "-compiled.html";
            rc.runtime.writeFile(responseFileName, postProcessed, function () {
                logger.info("Wrote compiled version to " + responseFileName);
            });
        }
    });
};
module.exports = handleViewCompiledHbsTemplate;