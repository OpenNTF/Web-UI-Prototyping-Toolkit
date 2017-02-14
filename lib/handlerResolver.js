"use strict";
const url = require("url");
const fs = require("./filesystem");
const utils = require("./utils");
const path = require("path");
const deferred = require("deferred");
const RequestUrlWrapper = require("./RequestUrlWrapper");

const logger = utils.createLogger({sourceFilePath: __filename});



function createResolver(args){

    const lessCssRequestParameterPrefix = args.lessCssRequestParameterPrefix;
    const allowedThemeReqs = args.allowedThemeReqs;
    const backendViewUrls = args.backendViewUrls;
    const project = args.project;
    const runtime = args.runtime;
    const nonResourceExt = args.nonResourceExt;


    const isDynamicUrlPathName = function (pathName) {
        return pathName.indexOf("/ps/dynamic") === 0;
    };
    /**
     *
     * @param {RequestUrlWrapper} wrappedRequest
     * @return {boolean}
     */
    const isCommandRequest = function (wrappedRequest) {
        return wrappedRequest.containsQueryParam('command') && typeof wrappedRequest.getQueryParam('command') === 'string';
        // console.log("Parsed url = ", parsedUrl);
        // console.log("typeof query : ", typeof parsedUrl.query)
        // return /*parsedUrl.query.hasOwnProperty("command") && */typeof parsedUrl.query.command === 'string' && parsedUrl.query.command.length > 0;
    };
    /**
     *
     * @param {RequestUrlWrapper} wrappedRequest
     * @return {boolean}
     */
    const isBackendViewUrl = function (wrappedRequest) {
        return backendViewUrls.hasOwnProperty(wrappedRequest.getPathname());
    };
    /**
     *
     * @param {RequestUrlWrapper} wrappedRequest
     * @return {boolean}
     */
    const isDynamicDataUrl = function (wrappedRequest) {
        return wrappedRequest.pathnameStartsWith('/ps/dynamic');
        // return parsedUrl.pathname.indexOf('/ps/dynamic/') === 0;
    };

    function isTemplateCompilationEnabledForActiveProject() {
        const projectConfig = runtime.readProjectConfig();
        let compilationEnabled = true;
        if (utils.nestedPathExists(projectConfig, "compilation", "enabled") && utils.hasPropertyOfType(projectConfig["compilation"], "enabled", "Boolean")) {
            compilationEnabled = projectConfig["compilation"].enabled;
        }
        return compilationEnabled;
    }


    /**
     *
     * @param {RequestUrlWrapper} wrappedRequest
     * @return {Object.<string,string>}
     */
    function collectLesscssRequestParameters(wrappedRequest){
        // var parsedUrl = url.parse(request.url, true);
        const lessVars = {};
        let lessVarCount = 0;
        wrappedRequest.getQueryParamNames().forEach(function(varname){
            if (varname.indexOf(lessCssRequestParameterPrefix) === 0) {
                lessVarCount += 1;
                lessVars[varname.substring(lessCssRequestParameterPrefix.length)] = wrappedRequest.getQueryParam(varname);
            }
        });
        // for (var varname in parsedUrl.query) {
        //
        // }
        return lessVars;
    }

    /**
     *
     * @param {RequestUrlWrapper} wrappedRequest
     * @param {Project} project
     */
    function interceptLessCssRequestParameters(wrappedRequest, project) {
        const lessVars = collectLesscssRequestParameters(wrappedRequest);
        if (Object.keys(lessVars).length > 0) {
            logger.debug("Found less vars being injected into compilation process: ", lessVars);
            project.lessParserAdditionalArgs.globalVars = lessVars;
            project.lessParserAdditionalArgs.modifyVars = lessVars;
        }
    }



    const resolveRequestHandler = function (request, response) {
        return (function (request, response) {
            const def = deferred();

            //noinspection JSUnresolvedVariable
            const defPromise = def.promise;
            //noinspection JSUnresolvedVariable
            const defResolve = def.resolve;
            //noinspection JSUnresolvedVariable
            let defReject = def.reject;

            let handlerName = "unknownRequest";
            const wrappedReq = new RequestUrlWrapper(request);
            // var urlParts = url.parse(request.url, true);
            logger.debug("" + request.method + " " + wrappedReq.getPathname(), request.headers);

            if (wrappedReq.pathnameStartsWith("/ps/rest/")) {
                handlerName = "handleRestData";
            } else {
                switch (wrappedReq.getMethod()) {
                    case 'GET':
                        if (wrappedReq.containsQueryParam('uri')) {
                            handlerName = "redirectToUri";
                        } else if (isCommandRequest(wrappedReq)) {
                            handlerName = "commandRequest";
                        } else if (isBackendViewUrl(wrappedReq)) {
                            if (wrappedReq.pathnameEquals('/projectConfig')) {
                                handlerName = "viewProjectConfig";
                            } else if (wrappedReq.pathnameEquals('/pshelp')) {
                                handlerName = "viewHelp";
                            } else if (wrappedReq.pathnameEquals('/pscmds')) {
                                handlerName = "viewRuntimeCommands";
                            } else if (wrappedReq.pathnameEquals('/newPortalTheme')) {
                                handlerName = "viewCreateNewPortalThemeMavenProjectForm";
                            }
                        } else if (isDynamicDataUrl(wrappedReq)) {
                            if (wrappedReq.pathnameStartsWith("/ps/dynamic/portalAngularThemeNavigation.json")) {
                                handlerName = "portalAngularThemeNavigation";
                            } else if (wrappedReq.pathnameStartsWith("/ps/dynamic/deps/page/direct") && wrappedReq.containsQueryParam("page")) {
                                handlerName = "showDirectTemplateDependencies";
                            } else if (wrappedReq.pathnameStartsWith("/ps/dynamic/deps/page/deep")) {
                                handlerName = "showDeepTemplateDependencies";
                            } else if (wrappedReq.pathnameStartsWith("/ps/dynamic/images")) {
                                handlerName = "handleImageListing";
                            }
                            else if (wrappedReq.pathnameStartsWith("/ps/dynamic/editdata")) {
                                handlerName = "handleEditData";
                            }
                            else if (wrappedReq.pathnameStartsWith("/ps/dynamic/wcmMarkupInfo")) {
                                handlerName = "handleServeWcmMarkupInfo";
                            } else if (wrappedReq.pathnameStartsWith('/ps/dynamic/pageUrls')) {
                                handlerName = "handlePageUrls";
                            }
                            else if (wrappedReq.pathnameStartsWith("/ps/dynamic/commandNames")) {
                                handlerName = "commandNamesJSON";
                            } else {
                                handlerName = "unknownDynamicDataRequest";
                            }
                        } else if (wrappedReq.pathnameStartsWith("/ps/buildTheme") && wrappedReq.containsQueryParam('auth') && allowedThemeReqs.hasOwnProperty(wrappedReq.getQueryParam('auth'))) {
                            handlerName = "handleCreateNewPortalMavenProjectZip";
                        } else {
                            const requestedFilePath = runtime.findFileForUrlPathname(wrappedReq.getPathname());
                            fs.stat(requestedFilePath).done(function (stat) {
                                let handlerNameGET = false;
                                interceptLessCssRequestParameters(wrappedReq, project);
                                //var stat = fs.statSync(requestedFilePath);
                                if (stat.isDirectory()) {
                                    logger.debug("Deemed dir for redirect: pathName=" + wrappedReq.getPathname() + " filename=" + requestedFilePath);
                                    handlerNameGET = "handleRedirectToDirectoryIndex";
                                    defResolve(handlerNameGET);
                                    return defPromise;
                                } else if (stat.isFile()) {
                                    if (utils.endsWith(wrappedReq.getPathname(), '.less')) {
                                        if (wrappedReq.containsQueryParam('compile')) {
                                            handlerNameGET = "compileLessCssFile";
                                        } else {
                                            handlerNameGET = "serveExistingCssFile";
                                        }
                                    } else if (!nonResourceExt.hasOwnProperty(path.extname(requestedFilePath))) {
                                        handlerNameGET = "serveExistingFile";
                                    } else if (wrappedReq.containsQueryParam("edit")) {
                                        handlerNameGET = "handleEditTemplateSource";
                                    } else if (wrappedReq.containsQueryParam("raw")) {
                                        handlerNameGET = "handleViewRawSourceRequest";
                                    } else if (wrappedReq.containsQueryParam("source")) {
                                        handlerNameGET = "handleViewCompiledTemplateSource";
                                    } else if (wrappedReq.containsQueryParam("sourceClean")) {
                                        handlerNameGET = "handleViewCompiledTemplateSourceCleaned";
                                    } else if (wrappedReq.containsQueryParam("cheese")) {
                                        handlerNameGET = "handleShowScreenshot";
                                    } else if (wrappedReq.getPathname().length >= 5 && (wrappedReq.getPathname().toLowerCase().indexOf(".md") === wrappedReq.getPathname().length - 3)) {
                                        handlerNameGET = "handleViewCompiledMarkdownRequest";
                                    } else {
                                        if (isTemplateCompilationEnabledForActiveProject()) {
                                            if (utils.doesEquivalentFilePathExist(requestedFilePath, ".jade")) {
                                                defResolve("handleViewCompiledJadeTemplate");
                                            } else if (utils.doesEquivalentFilePathExist(requestedFilePath, ".hbs")) {
                                                defResolve("handleViewCompiledHbsTemplate");
                                            } else {
                                                defResolve("handleViewCompiledTemplate");
                                            }
                                            handlerNameGET = false;
                                        } else {
                                            handlerNameGET = "serveExistingFile";
                                        }
                                    }
                                } else {
                                    handlerNameGET = "handleUnknownFileType";
                                }
                                if (handlerNameGET) {
                                    defResolve(handlerNameGET);
                                }
                            }, function (reqFpDoesntExistErr) {
                                let handlerNameGET = false;
                                const urlPathWithoutSlash = wrappedReq.getPathname().substring(1);
                                const urlPathFilenamePart = path.basename(urlPathWithoutSlash);
                                let urlPathExtname = path.extname(urlPathFilenamePart);
                                if (urlPathExtname === '.html' || !urlPathExtname) {
                                    let jadeUrlPathname = "";
                                    if (urlPathExtname === '.html') {
                                        jadeUrlPathname = wrappedReq.getPathname().substring(0, wrappedReq.getPathname().lastIndexOf('.')) + ".jade";
                                    } else if (!urlPathExtname) {
                                        jadeUrlPathname = wrappedReq.getPathname() + ".jade";
                                    } else {
                                        throw new Error("Cannot handle " + wrappedReq.getPathname());
                                    }
                                    const jadeFilePath = runtime.findFileForUrlPathname(jadeUrlPathname);
                                    if (fs.existsSync(jadeFilePath) && fs.statSync(jadeFilePath).isFile()) {
                                        interceptLessCssRequestParameters(wrappedReq, project);
                                        defResolve("handleViewCompiledJadeTemplate");
                                        return;
                                    }
                                    const hbsFilePath = jadeFilePath.substring(0, jadeFilePath.lastIndexOf('.')) + ".hbs";
                                    if (fs.existsSync(hbsFilePath) && fs.statSync(hbsFilePath).isFile()) {
                                        interceptLessCssRequestParameters(wrappedReq, project);
                                        defResolve("handleViewCompiledHbsTemplate");
                                        return;
                                    }
                                    defResolve("handleCantResolveNonExistingFileRequest");
                                    handlerNameGET = false;
                                } else {
                                    let u = wrappedReq.getPathname();
                                    if (utils.endsWith(wrappedReq.getPathname(), '.css.map')) {
                                        u = u.substring(0, u.lastIndexOf('.'));
                                    }
                                    let baseCssName = u.substring(0, u.lastIndexOf('.'));
                                    if (/-splitIE[0-9]*$/.test(baseCssName)) {
                                        baseCssName = baseCssName.substring(0, baseCssName.lastIndexOf('-splitIE'));
                                    }
                                    const lessFp = runtime.findFileForUrlPathname(baseCssName + ".less");
                                    logger.debug("lessfp = " + lessFp);
                                    const scssFp = runtime.findFileForUrlPathname(baseCssName + ".scss");
                                    logger.debug("scssfp = " + scssFp);
                                    fs.stat(lessFp).done(function (stat) {
                                        if (stat.isFile()) {
                                            defResolve("transparantLessCss");
                                        } else {
                                            defResolve("handleCantResolveNonExistingFileRequest");

                                        }
                                    }, function (noLessPathErr) {
                                        fs.stat(scssFp).done(function (stat) {
                                            let h;
                                            if (stat.isFile()) {
                                                h = "transparantSassyCss";
                                            } else {
                                                h = "handleCantResolveNonExistingFileRequest";
                                            }
                                            defResolve(h);
                                        }, function (noScssPathErr) {
                                            defResolve("handleCantResolveNonExistingFileRequest");
                                        });
                                    });
                                    handlerNameGET = false;
                                }
                                if (handlerNameGET) {
                                    defResolve(handlerNameGET);
                                }
                            });
                            handlerName = false;
                        }
                        break;
                    case 'POST':
                        if (isCommandRequest(wrappedReq)) {
                            handlerName = "commandRequest";
                        } else if (wrappedReq.getPathname().indexOf('/ps/grabImages') === 0) {
                            handlerName = "grabPageImages";
                        } else if (wrappedReq.getPathname().indexOf("/ps/buildTheme") === 0) {
                            handlerName = "prepareThemeRequest";
                        } else {
                            handlerName = "unknownRequest";
                        }
                        break;
                    case 'PUT':
                        if (isCommandRequest(wrappedReq)) {
                            handlerName = "commandRequest";
                        } else if (wrappedReq.getPathname().indexOf("/ps/update/partsource") === 0) {
                            handlerName = "handleSavePartSourceUpdate";
                        } else if (wrappedReq.getPathname().indexOf("/ps/update/part") === 0) {
                            handlerName = "handleSaveInlineContentUpdate";
                        } else {
                            handlerName = "unknownRequest";
                        }
                        break;
                    case 'DELETE':
                        if (isCommandRequest(wrappedReq)) {
                            handlerName = "commandRequest";
                        } else {
                            handlerName = "unknownRequest";
                        }
                        break;
                    case 'HEAD':
                        logger.warn("HEAD request method: " + wrappedReq.getMethod() + " " + wrappedReq.getUrl());
                        if (!wrappedReq.containsQueryParam('command') && wrappedReq.getPathname() !== '/pshelp' && !isDynamicUrlPathName(wrappedReq.getPathname())) {
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
            if (!runtime.lenient && handlerName === "handleCantResolveNonExistingFileRequest") {
                throw new Error("Cannot handle " + wrappedReq.getPathname());
            }
            if (handlerName) {
                defResolve(handlerName);
            }
            return defPromise;
        }(request, response));
    };
    return resolveRequestHandler;
}


module.exports = {
    createResolver : createResolver
};