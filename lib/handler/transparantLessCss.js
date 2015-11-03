"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var transparantLessCss = function (rc) {
    var parsedUrl = url.parse(request.url, true);
    var urlPathname = decodeURIComponent(parsedUrl.pathname);
    var requestedFilePath = runtime.findFileForUrlPathname(urlPathname);
    var lessInfo = utils.findCssPreProcessorInfo(requestedFilePath, ".less");
    logger.debug("Less Info = ", lessInfo);
    if (lessInfo) {
        var sourceFilePathRef = lessInfo.sourceFilePath;
        if(/-splitIE[0-9]*\.css$/.test(requestedFilePath)){
            sourceFilePathRef = path.resolve(path.dirname(sourceFilePathRef), path.basename(requestedFilePath));
        }
        if (lessInfo.outputFormat === 'map') {
            serversideLessCompiler.handleCompileLessCssMap(sourceFilePathRef, runtime.readFile(lessInfo.sourceFilePath), response);
        } else {
            if(parsedUrl.query.hasOwnProperty("onlyUsed") && request.headers.hasOwnProperty("referer")){
                var pageUrl =request.headers['referer'];
                if(pageUrl.indexOf('?')> 0){
                    pageUrl = pageUrl.substring(0, pageUrl.indexOf('?'));
                }
                console.log("page url = " + pageUrl);
                var pageUrlPathname = pageUrl.replace(/^http.+:[0-9]{2,5}/, '');
                var pageFile = runtime.findFileForUrlPathname(pageUrlPathname);
                var filetype = "html";
                if (fs.existsSync(pageFile)) {
                    filetype = "html";
                } else {
                    pageFile = pageFile.substring(0, pageFile.lastIndexOf('.')) + '.jade';
                }
                if (fs.existsSync(pageFile)) {
                    filetype = "jade";
                } else {
                    pageFile = pageFile.substring(0, pageFile.lastIndexOf('.')) + '.hbs';
                }
                if (fs.existsSync(pageFile)) {
                    filetype = "hbs";
                } else {
                    throw new Error("Cannot locate source file for " + pageUrl + " for " + urlPathname);
                }
                var contents = fs.readFileSync(pageFile, 'utf8');
                switch (filetype){
                    case 'jade':
                        contents = jadeUtils.compileJade(pageFile, contents);
                        break;
                    case 'hbs':
                        console.log("hbs file : " + pageFile);
                        var pcfg = runtime.readProjectConfig();
                        if(pcfg.hasOwnProperty("hbs")){
                            contents = hbsUtils.convertPartialsToFileIncludes(contents, pcfg.hbs.partialsDir);
                            if(project.isLibraryDirPresent()){
                                var libDir = project.getLibraryDirPath();
                                console.log("found libdir = " + libDir);
                                var libDirPath = runtime.constructProjectPath(libDir);
                                if(pageFile.indexOf(libDirPath) !== 0){
                                    console.log("injecting into body")
                                    contents = hbsUtils.injectHbsLayoutBodyContent(runtime.constructProjectPath(pcfg.hbs.layout), contents);
                                }
                            }
                        }

                        break;
                }
                var compiled = composer.composeTemplate(pageFile, contents, 100);
                var locationsProducerFn = function () {
                    var c = compiled.content;
                    var $ = cheerio.load(c);
                    $('link').remove();
                    $('script').remove();
                    return $.html();
                };
                serversideLessCompiler.handleCompileLessCssUsedOnly(sourceFilePathRef, runtime.readFile(lessInfo.sourceFilePath), locationsProducerFn, [urlPathname], runtime.projectDirPath, response);
            }else{
                serversideLessCompiler.handleCompileLessCss(sourceFilePathRef, runtime.readFile(lessInfo.sourceFilePath), response);
            }
        }
    } else {
        throw new Error("Cannot handle " + urlPathname + " => " + requestedFilePath);
    }
};
module.exports = transparantLessCss;