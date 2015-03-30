var url = require("url");
var fs = require("fs");
var utils = require("./utils");
var path = require("path");

var logger = utils.createLogger({sourceFilePath : __filename});

function createResolver(args){

    var lessCssRequestParameterPrefix = args.lessCssRequestParameterPrefix;
    var allowedThemeReqs = args.allowedThemeReqs;
    var backendViewUrls = args.backendViewUrls;
    var project = args.project;
    var runtime = args.runtime;
    var nonResourceExt = args.nonResourceExt;


    var isDynamicUrlPathName = function (pathName) {
        return pathName.indexOf("/ps/dynamic") === 0;
    };
    var isCommandRequest = function(parsedUrl){
        return parsedUrl.query.hasOwnProperty("command") && typeof parsedUrl.query.command === 'string' && parsedUrl.query.command.length > 0;
    };
    var isBackendViewUrl = function(request, response, parsedUrl){
        return backendViewUrls.hasOwnProperty(parsedUrl.pathname);
    };

    var isDynamicDataUrl = function(request, response, parsedUrl){
        return parsedUrl.pathname.indexOf('/ps/dynamic/') === 0;
    };

    function isTemplateCompilationEnabledForActiveProject() {
        var projectConfig = runtime.readProjectConfig();
        var compilationEnabled = true;
        if (utils.nestedPathExists(projectConfig, "compilation", "enabled") && utils.hasPropertyOfType(projectConfig.compilation, "enabled", "Boolean")) {
            compilationEnabled = projectConfig.compilation.enabled;
        }
        return compilationEnabled;
    }
    function interceptLessCssRequestParameters(request, response) {
        var parsedUrl = url.parse(request.url, true);
        var lessVars = {};
        var lessVarCount = 0;
        for (var varname in parsedUrl.query) {
            if (parsedUrl.query.hasOwnProperty(varname) && varname.indexOf(lessCssRequestParameterPrefix) === 0) {
                lessVarCount += 1;
                lessVars[varname.substring(lessCssRequestParameterPrefix.length)] = parsedUrl.query[varname];
            }
        }
        if (lessVarCount > 0) {
            console.log("FOUND LESS VARS = ", lessVars);
            project.lessParserAdditionalArgs.globalVars = lessVars;
            project.lessParserAdditionalArgs.modifyVars = lessVars;
        }
    }

    var resolveRequestHandler = function(request, response){
        var handlerName = "unknownRequest";
        var urlParts = url.parse(request.url, true);
        var urlPathname = urlParts.pathname;
        switch (request.method) {
            case 'GET':
                if (isCommandRequest(urlParts)) {
                    handlerName = "commandRequest";
                } else if(isBackendViewUrl(request, response, urlParts)){
                    if(urlPathname === '/projectConfig'){
                        handlerName = "viewProjectConfig";
                    }else if(urlPathname === '/pshelp'){
                        handlerName = "viewHelp";
                    }else if(urlPathname === '/newPortalTheme'){
                        handlerName = "viewCreateNewPortalThemeMavenProjectForm";
                    }
                } else if(isDynamicDataUrl(request, response, urlParts)){
                    if(urlPathname.indexOf("/ps/dynamic/deps/page/direct") === 0 && urlParts.query.hasOwnProperty("page")){
                        handlerName = "showDirectTemplateDependencies";
                    }else if(urlPathname.indexOf("/ps/dynamic/deps/page/deep") === 0){
                        handlerName = "showDeepTemplateDependencies";
                    }else if (urlPathname.indexOf("/ps/dynamic/images") === 0) {
                        handlerName = "handleImageListing";
                    }else if(urlPathname.indexOf("/ps/dynamic/editdata") === 0){
                        handlerName = "handleEditData";
                    }else if(urlPathname.indexOf("/ps/dynamic/commandNames") === 0){
                        handlerName = "commandNamesJSON";
                    }else{
                        handlerName = "unknownDynamicDataRequest";
                    }
                }else if(urlPathname.indexOf("/ps/buildTheme") === 0 && urlParts.query.hasOwnProperty("auth") && allowedThemeReqs.hasOwnProperty(urlParts.query.auth)){
                    handlerName = "handleCreateNewPortalMavenProjectZip";
                } else {
                    var requestedFilePath = runtime.findFileForUrlPathname(urlPathname);
                    if (fs.existsSync(requestedFilePath)) {
                        interceptLessCssRequestParameters(request, response);
                        var stat = fs.statSync(requestedFilePath);
                        if (stat.isDirectory()) {
                            logger.debug("Deemed dir for redirect: pathName=" + urlPathname + " filename=" + requestedFilePath);
                            handlerName = "handleRedirectToDirectoryIndex";
                            return handlerName;
                        }else{
                            if (stat.isFile()) {

                                if (utils.endsWith(urlPathname, '.less')){
                                    if(urlParts.query.hasOwnProperty("compile")){
                                        handlerName = "compileLessCssFile";
                                    }else{
                                        handlerName = "serveExistingCssFile";
                                    }
                                }else if(!nonResourceExt.hasOwnProperty(path.extname(requestedFilePath))){
                                    handlerName = "serveExistingFile";
                                }else if(urlParts.query.hasOwnProperty("edit")){
                                    handlerName = "handleEditTemplateSource";
                                }else if (urlParts.query.hasOwnProperty("raw")) {
                                    handlerName = "handleViewRawSourceRequest";
                                } else if (urlParts.query.hasOwnProperty("source")) {
                                    handlerName = "handleViewCompiledTemplateSource";
                                } else if (urlParts.query.hasOwnProperty("sourceClean")) {
                                    handlerName = "handleViewCompiledTemplateSourceCleaned";
                                } else if (urlParts.query.hasOwnProperty("cheese")) {
                                    handlerName = "handleShowScreenshot";
                                } else if(urlPathname.length >= 5 && (urlPathname.toLowerCase().indexOf(".md") === urlPathname.length-3)){
                                    handlerName = "handleViewCompiledMarkdownRequest";
                                }else{
                                    if (isTemplateCompilationEnabledForActiveProject()) {
                                        var jadeFilePath = requestedFilePath.substring(0, requestedFilePath.lastIndexOf(".")) + ".jade";
                                        if(fs.existsSync(jadeFilePath)){
                                            handlerName = "handleViewCompiledJadeTemplate";
                                        }else{
                                            handlerName = "handleViewCompiledTemplate";
                                        }
                                    } else {
                                        handlerName = "serveExistingFile";
                                    }
                                }
                            } else {
                                handlerName = "handleUnknownFileType";
                            }
                        }
                    } else {
                        var urlPathWithoutSlash = urlPathname.substring(1);
                        var urlPathFilenamePart = path.basename(urlPathWithoutSlash);
                        var urlPathExtname = path.extname(urlPathFilenamePart);
                        console.log("filename="+urlPathFilenamePart);
                        console.log("ext="+urlPathExtname);
                        if(urlPathExtname === '.html' || !urlPathExtname){
                            var jadeUrlPathname = "";
                            if(urlPathExtname === '.html'){
                                jadeUrlPathname = urlPathname.substring(0, urlPathname.lastIndexOf('.')) + ".jade";
                            }else if(!urlPathExtname){
                                jadeUrlPathname = urlPathname + ".jade";
                            }else{
                                throw new Error("Cannot handle " + urlPathname);
                            }
                            var jadeFilePath = runtime.findFileForUrlPathname(jadeUrlPathname);
                            if(fs.existsSync(jadeFilePath)){
                                interceptLessCssRequestParameters(request, response);
                                handlerName = "handleViewCompiledJadeTemplate";
                            }else{
                                handlerName = "transparantLessCss";
                            }
                        }else{
                            handlerName = "transparantLessCss";
                        }
                    }
                }
                break;
            case 'POST':
                if(urlPathname.indexOf("/ps/buildTheme") === 0){
                    handlerName = "prepareThemeRequest";
                }else{
                    handlerName = "unknownRequest";
                }
                break;
            case 'PUT':
                if (urlPathname.indexOf("/ps/update/partsource") === 0) {
                    handlerName = "handleSavePartSourceUpdate";
                }else if (urlPathname.indexOf("/ps/update/part") === 0) {
                    handlerName = "handleSaveInlineContentUpdate";
                } else {
                    handlerName = "unknownRequest";
                }
                break;
            case 'DELETE':
                handlerName = "unknownRequest";
                break;
            case 'HEAD':
                logger.warn("HEAD request method: " + request.method + " " + request.url);
                var urlQuery = urlParts.query;
                if (!urlQuery.hasOwnProperty("command") && urlPathname !== '/pshelp' && !isDynamicUrlPathName(urlPathname)) {
                    handlerName = "serveHEAD";
                } else {
                    handlerName = "unknownRequest";
                }
                break;
            default:
                handlerName = "unknownRequest";
                break;
        }
        return handlerName;
    };
    return resolveRequestHandler;
}


module.exports = {
    createResolver : createResolver
};