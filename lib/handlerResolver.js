var url = require("url");
var fs = require("./filesystem");
var utils = require("./utils");
var path = require("path");
var deferred = require("deferred");


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
            logger.debug("Found less vars being injected into compilation process: ", lessVars);
            project.lessParserAdditionalArgs.globalVars = lessVars;
            project.lessParserAdditionalArgs.modifyVars = lessVars;
        }
    }

    var resolveRequestHandler = function(request, response){
        return (function(request, response){
            var def = deferred();

            var handlerName = "unknownRequest";
            var urlParts = url.parse(request.url, true);
            var urlPathname = decodeURIComponent(urlParts.pathname);
            logger.debug("" + request.method + " " + urlPathname, request.headers);

            if(urlPathname.indexOf("/ps/rest/") === 0){
                handlerName = "handleRestData";
            }else{
                switch (request.method) {
                    case 'GET':
                        if(typeof urlParts.query.uri === 'string'){
                            handlerName = "redirectToUri";
                        }else if (isCommandRequest(urlParts)) {
                            handlerName = "commandRequest";
                        } else if(isBackendViewUrl(request, response, urlParts)){
                            if(urlPathname === '/projectConfig'){
                                handlerName = "viewProjectConfig";
                            }else if(urlPathname === '/pshelp'){
                                handlerName = "viewHelp";
                            }else if(urlPathname === '/newPortalTheme'){
                                handlerName = "viewCreateNewPortalThemeMavenProjectForm";
                            }
                        }else if(isDynamicDataUrl(request, response, urlParts)){
                            if(urlPathname.indexOf("/ps/dynamic/portalAngularThemeNavigation.json") === 0){
                                handlerName = "portalAngularThemeNavigation";
                            }else if(urlPathname.indexOf("/ps/dynamic/deps/page/direct") === 0 && urlParts.query.hasOwnProperty("page")){
                                handlerName = "showDirectTemplateDependencies";
                            }else if(urlPathname.indexOf("/ps/dynamic/deps/page/deep") === 0){
                                handlerName = "showDeepTemplateDependencies";
                            }else if (urlPathname.indexOf("/ps/dynamic/images") === 0) {
                                handlerName = "handleImageListing";
                            }
                            else if(urlPathname.indexOf("/ps/dynamic/editdata") === 0){
                                handlerName = "handleEditData";
                            }
                            else if(urlPathname.indexOf("/ps/dynamic/wcmMarkupInfo") === 0){
                                handlerName = "handleServeWcmMarkupInfo";
                            }
                            else if(urlPathname.indexOf("/ps/dynamic/commandNames") === 0){
                                handlerName = "commandNamesJSON";
                            }else{
                                handlerName = "unknownDynamicDataRequest";
                            }
                        }else if(urlPathname.indexOf("/ps/buildTheme") === 0 && urlParts.query.hasOwnProperty("auth") && allowedThemeReqs.hasOwnProperty(urlParts.query.auth)){
                            handlerName = "handleCreateNewPortalMavenProjectZip";
                        } else {
                            var requestedFilePath = runtime.findFileForUrlPathname(urlPathname);
                            fs.stat(requestedFilePath).done(function(stat){
                                var handlerNameGET = false;
                                interceptLessCssRequestParameters(request, response);
                                //var stat = fs.statSync(requestedFilePath);
                                if (stat.isDirectory()) {
                                    logger.debug("Deemed dir for redirect: pathName=" + urlPathname + " filename=" + requestedFilePath);
                                    handlerNameGET = "handleRedirectToDirectoryIndex";
                                    def.resolve(handlerNameGET);
                                    return def.promise;
                                }else if (stat.isFile()) {
                                    if (utils.endsWith(urlPathname, '.less')){
                                        if(urlParts.query.hasOwnProperty("compile")){
                                            handlerNameGET = "compileLessCssFile";
                                        }else{
                                            handlerNameGET = "serveExistingCssFile";
                                        }
                                    }else if(!nonResourceExt.hasOwnProperty(path.extname(requestedFilePath))){
                                        handlerNameGET = "serveExistingFile";
                                    }else if(urlParts.query.hasOwnProperty("edit")){
                                        handlerNameGET = "handleEditTemplateSource";
                                    }else if (urlParts.query.hasOwnProperty("raw")) {
                                        handlerNameGET = "handleViewRawSourceRequest";
                                    } else if (urlParts.query.hasOwnProperty("source")) {
                                        handlerNameGET = "handleViewCompiledTemplateSource";
                                    } else if (urlParts.query.hasOwnProperty("sourceClean")) {
                                        handlerNameGET = "handleViewCompiledTemplateSourceCleaned";
                                    } else if (urlParts.query.hasOwnProperty("cheese")) {
                                        handlerNameGET = "handleShowScreenshot";
                                    } else if(urlPathname.length >= 5 && (urlPathname.toLowerCase().indexOf(".md") === urlPathname.length-3)){
                                        handlerNameGET = "handleViewCompiledMarkdownRequest";
                                    }else{
                                        if (isTemplateCompilationEnabledForActiveProject()) {
                                            var jadeFilePath = requestedFilePath.substring(0, requestedFilePath.lastIndexOf(".")) + ".jade";
                                            fs.stat(jadeFilePath).done(function(stat){
                                                var h;
                                                if(stat.isFile()){
                                                    h = "handleViewCompiledJadeTemplate";
                                                }else{
                                                    h = "handleViewCompiledTemplate";
                                                }
                                                def.resolve(h);
                                            }, function(noJadePathErr){
                                                def.resolve("handleViewCompiledTemplate");
                                            });
                                            handlerNameGET = false;
                                        } else {
                                            handlerNameGET = "serveExistingFile";
                                        }
                                    }
                                } else {
                                    handlerNameGET = "handleUnknownFileType";
                                }
                                if(handlerNameGET){
                                    def.resolve(handlerNameGET);
                                }
                            }, function(reqFpDoesntExistErr){
                                var handlerNameGET = false;
                                var urlPathWithoutSlash = urlPathname.substring(1);
                                var urlPathFilenamePart = path.basename(urlPathWithoutSlash);
                                var urlPathExtname = path.extname(urlPathFilenamePart);
                                if(urlPathExtname === '.html' || !urlPathExtname){
                                    var jadeUrlPathname = "";
                                    if(urlPathExtname === '.html'){
                                        jadeUrlPathname = urlPathname.substring(0, urlPathname.lastIndexOf('.')) + ".jade";
                                    }else if(!urlPathExtname){
                                        jadeUrlPathname = urlPathname + ".jade";
                                    }else{
                                        throw new Error("Cannot handle " + urlPathname);
                                    }
                                    fs.stat(runtime.findFileForUrlPathname(jadeUrlPathname)).done(function(stat){
                                        if(stat.isFile()){
                                            interceptLessCssRequestParameters(request, response);
                                            def.resolve("handleViewCompiledJadeTemplate");
                                        }else{
                                            def.resolve("handleCantResolveNonExistingFileRequest")
                                        }
                                    }, function(nothingAtJadePathErr){
                                        def.resolve("handleCantResolveNonExistingFileRequest")
                                    });
                                    handlerNameGET = false;
                                }else{
                                    var u = urlPathname;
                                    if(utils.endsWith(urlPathname, '.css.map')){
                                        u = u.substring(0, u.lastIndexOf('.'));
                                    }
                                    var lessFp = runtime.findFileForUrlPathname(u.substring(0, u.lastIndexOf('.')) + ".less");
                                    logger.debug("lessfp = " + lessFp);
                                    var scssFp = runtime.findFileForUrlPathname(u.substring(0, u.lastIndexOf('.')) + ".scss");
                                    logger.debug("scssfp = " + scssFp);
                                    fs.stat(lessFp).done(function(stat){
                                        if(stat.isFile()){
                                            def.resolve("transparantLessCss");
                                        }else{
                                            def.resolve("handleCantResolveNonExistingFileRequest");

                                        }
                                    }, function(noLessPathErr){
                                        fs.stat(scssFp).done(function(stat){
                                            var h;
                                            if(stat.isFile()){
                                                h = "transparantSassyCss";
                                            }else{
                                                h = "handleCantResolveNonExistingFileRequest";
                                            }
                                            def.resolve(h);
                                        }, function(noScssPathErr){
                                            def.resolve("handleCantResolveNonExistingFileRequest");
                                        });
                                    });
                                    handlerNameGET = false;
                                }
                                if(handlerNameGET){
                                    def.resolve(handlerNameGET);
                                }
                            });
                            handlerName = false;
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
            }
            if(!runtime.lenient && handlerName === "handleCantResolveNonExistingFileRequest"){
                throw new Error("Cannot handle " + urlPathname);
            }
            if(handlerName){
                def.resolve(handlerName);
            }
            return def.promise;
        }(request, response));
    };
    return resolveRequestHandler;
}


module.exports = {
    createResolver : createResolver
};