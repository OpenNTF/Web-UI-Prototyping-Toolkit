"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleViewCompiledHbsTemplate = function (rc) {
    var ts = new Date().getTime();
    var parsedUrl = url.parse(request.url, true);
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
    var hbsFilePath = runtime.findFileForUrlPathname(hbsUrlPathname);
    logger.debug("reading hbs path : ", hbsFilePath);
    var hbsSrc = fs.readFileSync(hbsFilePath, 'utf8');

    var pcfg = runtime.readProjectConfig();



    //hbsSrc = hbsUtils.prepareHbsSource(hbsSrc, pcfg.hbs.partialsDir, pcfg.hbs.layout);
    hbsSrc = hbsUtils.convertPartialsToFileIncludes(hbsSrc, pcfg.hbs.partialsDir);
    hbsSrc = hbsUtils.injectHbsLayoutBodyContent(runtime.constructProjectPath(pcfg.hbs.layout), hbsSrc);
    var composed;
    if (runtime.cachingEnabled) {
        composed = composer.composeTemplateCached(hbsFilePath, hbsSrc);
    } else {
        composed = composer.composeTemplate(hbsFilePath, hbsSrc);
    }
    templateComposer.postProcessComposed(composed, runtime, function (postProcessed) {
        project.updateDynamic();
        var pc = postProcessed.toString();
        writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, pc);
        var te = new Date().getTime();
        var taken = te - ts;
        logger.info("Served " + urlPathname + " using " + hbsFilePath + " in " + taken + "ms");
        if (runtime.readUserConfig().writeResponsesToFiles) {
            var responseFileName = hbsFilePath.substring(0, hbsFilePath.length - 5) + "-compiled.html";
            runtime.writeFile(responseFileName, postProcessed, function () {
                logger.info("Wrote compiled version to " + responseFileName);
            });
        }
    });
};
module.exports = handleViewCompiledHbsTemplate;