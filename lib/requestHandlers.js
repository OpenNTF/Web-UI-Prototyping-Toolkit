var screenies = require("./screenies");
var portalThemeImporter = require("./portalThemeImporter");
var url = require("url");
var os = require("os");
var path = require("path");
var mime = require('mime');
var fsops = require("fsops");
var fs = require("./filesystem");
var _fs = require("fs");
var jqueryRunner = require("./jqueryRunner");
var utils = require("./utils");
var cheerio = require("cheerio");
var copier = require("./copier");
var markdownHelper = require("./markdownHelper");
var sassCompiler = require("./sassCompiler");
var portalNavGen = require("./portalNavigationProducer");
var jadeUtils = require("./jadeUtils");
var wcmTagParser = require("./wcmTagParser");
var logger = utils.createLogger({sourceFilePath: __filename});
var writeBinaryResponse = utils.writeBinaryResponse;
var writeResponse = utils.writeResponse;
var enableFileCaching = false;
var http = require("http");
var hbsUtils = require("./hbsUtils");
var stream = require("stream");
var zlib = require("zlib");
function createHandlers(args) {
    /**
     * @type {templateComposer.TemplateComposer}
     */
    var composer = args.composer;
    var serversideLessCompiler = args.sslc;
    /**
     * @type {ProtostarRuntime}
     */
    var runtime = args.runtime;
    /**
     * @type {Project}
     */
    var project = args.project;
    var projectCommands = args.projectCommands;
    var allowedThemeReqs = args.allowedThemeReqs;

    var postProcessComposed = function (markup, callback) {
        if (markup.content.trim().length > 0) {
            var pcfg = runtime.readProjectConfig();
            var addViewScripts = true;
            if (pcfg && utils.nestedPathExists(pcfg, "runtime", "addRuntimeScripts")) {
                if (pcfg.runtime["addRuntimeScripts"] === false) {
                    addViewScripts = false;
                }
            }
            var addDoctypeIfMissing = false;
            var metadata = markup.metadata;
            var cnt = markup.content;


            var insertPlaceholderResources = function(markup, metadata){
                var newHeadTags = [];
                var newBodyTags = [];
                if (metadata.include.style.length > 0) {
                    metadata.include.style.forEach(function (s) {
                        newHeadTags.push('<link rel="stylesheet" type="text/css" href="' + s + '"></script>');
                    });
                }
                if (metadata.include.headScript.length > 0) {
                    metadata.include.headScript.forEach(function (s) {
                        newHeadTags.push('<script src="' + s + '"></script>');
                    });
                }
                if (metadata.include.script.length > 0) {
                    metadata.include.script.forEach(function (s) {
                        newBodyTags.push('<script src="' + s + '"></script>');
                    });
                }
                var out= markup;
                var olc = out.toLowerCase();
                var closeHeadIdx = olc.indexOf('</head>');
                var closeBodyIdx = olc.indexOf('</body>');
                if(newHeadTags.length >0 && closeHeadIdx > 0){
                    var preCloseMarkup = out.substring(0, closeHeadIdx);
                    var postCloseMarkup = out.substring(closeHeadIdx);
                    var newOut= preCloseMarkup;
                    newHeadTags.forEach(function(t){
                        newOut += t + '\n';
                    });
                    newOut += postCloseMarkup;
                    out = newOut;
                }
                if(newBodyTags.length > 0 && closeBodyIdx > 0){
                    var preBodyCloseMarkup = out.substring(0, closeBodyIdx);
                    var postBodyCloseMarkup = out.substring(closeBodyIdx);
                    var newBodyOut= preBodyCloseMarkup;
                    newBodyTags.forEach(function(t){
                        newBodyOut += t + '\n';
                    });
                    newBodyOut += postBodyCloseMarkup;
                    out = newBodyOut;
                }
                return out;
            };

            cnt = insertPlaceholderResources(cnt, metadata);

            var ensureViewScriptsPresent = function(markup){
                var out = markup;
                var mlc = markup.toLowerCase();
                var closeIdx = mlc.indexOf('</body>');
                if(closeIdx > 0){



                    //var jq=markup.indexOf('jquery.js"') > 0 || markup.indexOf('jquery.min.js"') > 0;
                    var kp = markup.indexOf('keypress.js"') > 0 || markup.indexOf('keypress-2.0.3.min.js"') > 0;
                    var uf = markup.indexOf('/assets/uxFrame.js"') > 0;

                    //var ck = markup.indexOf('ckeditor.js"') > 0 || markup.indexOf('ckeditor.min.js"') > 0;
                    //var vw = markup.indexOf('/ps/assets/views.js"') > 0;

                    var toAdd = [];
                    //if(!jq){
                    //
                    //    toAdd.push('<script src="/ps/ext/jquery/dist/jquery.js" data-backend-only></script>')
                    //}
                    if(!kp){
                        toAdd.push('<script src="/ps/ext/Keypress/keypress.js" data-backend-only></script>')
                    }
                    if(!uf){
                        toAdd.push('<script src="/ps/assets/uxFrame.js" data-backend-only></script>')
                    }

                    //if(!ck){
                    //    toAdd.push('<script src="/ps/ext/ckeditor/ckeditor.js" data-backend-only></script>')
                    //}
                    //if(!vw){
                    //    toAdd.push('<script src="/ps/assets/runtimeActions.js" data-backend-only></script>');
                    //    toAdd.push('<script src="/ps/assets/runtimeShortcuts.js" data-backend-only></script>');
                    //    toAdd.push('<script src="/ps/assets/views.js" data-backend-only></script>')
                    //}

                    if(toAdd.length > 0){
                        var newOut = out.substring(0, closeIdx);
                        toAdd.forEach(function(u){
                            newOut += u + '\n';
                        });
                        newOut += out.substring(closeIdx);
                        out = newOut;
                    }
                }
                return out;

            };

            if (addViewScripts){
                cnt = ensureViewScriptsPresent(cnt);
            }

            var processedHtml = cnt;//$.html();
            if (addDoctypeIfMissing) {
                if (processedHtml.toLowerCase().indexOf('<html') >= 0 && processedHtml.trim().indexOf('<!') !== 0) {
                    processedHtml = '<!doctype html>\n' + processedHtml;
                }
            }
            if(false && processedHtml.indexOf('<body') > 0){
                var bodyHtml = processedHtml.substring(processedHtml.indexOf('<body'), processedHtml.indexOf('</body>'));
                var sourceOpenIdx = bodyHtml.indexOf('src="');
                var sources = [];
                var allJs = '';
                while(sourceOpenIdx >0){
                    var srcStartIdx = sourceOpenIdx+5;
                    var closeQuoteIdx = bodyHtml.indexOf('"', srcStartIdx+1);
                    var source = bodyHtml.substring(srcStartIdx, closeQuoteIdx);
                    if(path.extname(source) === '.js' && source.indexOf('http:') < 0 && source.indexOf('https:') < 0 && source.indexOf('//') < 0 && source.indexOf('/ps/') !== 0 && source.indexOf('/lib/') !== 0){
                        sources.push(source);
                        var filePath = runtime.resolveUrlPathnameToProjectFile(source);
                        var contents = runtime.readFile(filePath);
                        allJs += "\n\n// Contents from " + filePath + " \n\n" + contents;
                    }
                    sourceOpenIdx = bodyHtml.indexOf('src="', closeQuoteIdx + 2);
                }
                logger.debug("SCRIPT REFS == ", sources);
                if(allJs.length > 0){
                    var firstSrcIdx = bodyHtml.indexOf('src="' + sources[0]);
                    var firstScriptOpenIdx = bodyHtml.lastIndexOf('<script', firstSrcIdx);
                    var afterFirstScriptCloseIdx = bodyHtml.indexOf('</script>', firstSrcIdx)+9;
                    var reversedSources = ([].concat(sources)).reverse();
                    var modHtml = bodyHtml;
                    reversedSources.forEach(function(source){
                        var srcStartIdx = bodyHtml.indexOf('src="' + sources[0]);
                        var scriptOpenIdx = bodyHtml.lastIndexOf('<script', srcStartIdx);
                        var afterScriptIdx = bodyHtml.indexOf('</script>', srcStartIdx)+9;
                        modHtml = modHtml.substring(0, scriptOpenIdx) + "\n" + modHtml.substring(afterScriptIdx);
                    });
                    var scriptTag = '<script type="text/javascript">\n'+allJs+'\n</script>\n';
                    modHtml = modHtml.substring(0, firstScriptOpenIdx) + scriptTag + modHtml.substring(firstScriptOpenIdx);
                    bodyHtml = modHtml;
                    processedHtml = processedHtml.substring(0, processedHtml.indexOf('</head>')) + '</head>' + bodyHtml + '</html>';
                }

            }




            var psBaseId = "psGenId_" + new Date().getTime() + "_";
            var idxes = utils.findAllIndexesOf(' data-editable=', processedHtml);
            idxes.sort();
            idxes.reverse();
            idxes.forEach(function(i, cidx){
                var before = processedHtml.substring(0, i);
                var after = processedHtml.substring(i + ' data-editable='.length);
                var newText = ' id="'+psBaseId + '_' + (cidx+1) + '" data-editable=';
                processedHtml = before + newText + after;

            });

            if(processedHtml.indexOf('class="component-control id-') > 0){
                var parts = processedHtml.split('class="component-control id-');
                var partsWithPortletIdsAssigned = [];
                parts.forEach(function(p, idx){
                    if(idx < 1){
                        partsWithPortletIdsAssigned.push(p);
                    }else{
                        var rnd = Math.floor(Math.random() * 100000) + "_" + (new Date().getTime());
                        var portletId = "portletId_" + rnd;
                        var portletNamespace = "nsPortlet_" + rnd + "_";
                        /*
                         "namespace": "[Plugin:Portlet key='namespace' compute='once']",
                         "portletWindowID": "[Plugin:Portlet key='windowID']",
                         "portletMode" : "[Plugin:Portlet key='portletMode']",
                         "windowState" : "[Plugin:Portlet key='windowState']",
                         "serverTime" : "[plugin:getDate format='dd/MM/yyyy HH:mm:ss']"
                         */
                        var spaceIdx = p.indexOf(' ');
                        var quoteIdx = p.indexOf('"');
                        var firstIdx = Math.min(spaceIdx, quoteIdx);
                        var newPart = portletId + p.substring(firstIdx);
                        newPart = newPart.replace(/__SPNS__/g, portletNamespace);
                        newPart = newPart.replace(/\[Plugin:Portlet key=.namespace. compute=.once.]/g, portletNamespace);
                        newPart = newPart.replace(/\[Plugin:Portlet key=.windowID.]/g, portletId);
                        newPart = newPart.replace(/\[Plugin:Portlet key=.portletMode.]/g, 'view');
                        newPart = newPart.replace(/\[Plugin:Portlet key=.windowState.]/g, 'normal');
                        newPart = newPart.replace(/\[Plugin:Portlet key=.getDate. [^\]]+]/g, new Date().toISOString());
                        partsWithPortletIdsAssigned.push(newPart);
                    }
                });
                processedHtml = partsWithPortletIdsAssigned.join('class="component-control id-');
            }

            callback(processedHtml);


            //jqueryRunner.runJQuery(markup.content, function ($) {
            //    var metadata = markup.metadata;
            //    //jqueryRunner.validateBootstrapGrid($);
            //    if(markup.content.indexOf('data-editable') > 0)
            //        jqueryRunner.assignUniqueIdsToEditables($, metadata);
            //
            //
            //    jqueryRunner.processProtostarAttributes($, function (attrName, attrVal) {
            //        return runtime.determineProtostarAttributeValue(attrName, attrVal);
            //    });
            //
            //    jqueryRunner.insertPlaceholderResources($, metadata);
            //    if (addViewScripts)
            //        jqueryRunner.ensureViewScriptsPresent($);
            //    var processedHtml = $.html();
            //    if (addDoctypeIfMissing) {
            //        if (processedHtml.toLowerCase().indexOf('<html') >= 0 && processedHtml.trim().indexOf('<!') !== 0) {
            //            processedHtml = '<!doctype html>\n' + processedHtml;
            //        }
            //    }
            //    return processedHtml;
            //}, doneF);
        } else {
            callback(markup.content);
        }
    };
    var handlers = {
        transparantLessCss: function (request, response) {
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
        },
        portalAngularThemeNavigation: function (request, response) {
            var nav = portalNavGen.generateNavigation(project);
            writeResponse(response, 200, {
                "Content-Type": "application/json; charset=utf-8"
            }, JSON.stringify(nav));
        },
        redirectToUri: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            var uri = parsedUrl.query.uri;
            var newLoc = "http://" + request.headers.host + uri;
            var params = '';
            var found = false;
            for (var qk in parsedUrl.query) {
                var v = parsedUrl.query[qk];
                if (typeof v === 'string' && qk !== 'uri') {
                    if (found) {
                        params += '&';
                    }
                    found = true;
                    params += qk + '=' + v;
                }
            }
            if (found) {
                params = '?' + params;
            }
            newLoc += params;
            logger.debug("new loc =" + newLoc);
            response.writeHead(302, {
                Location: newLoc
            });
            response.end();
        },
        transparantSassyCss: function (request, response) {
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
        },
        serveHEAD: function (request, response) {
            var urlParts = url.parse(request.url, true);
            var urlPathName = decodeURIComponent(urlParts.pathname);
            var filename = runtime.findFileForUrlPathname(urlPathName);
            logger.info("Serving head for " + urlPathName + " => " + filename);
            fs.stat(filename).done(function (stat) {
                if (stat.isDirectory()) {
                    response.writeHead(301, {
                        Location: "http://" + request.headers.host + urlPathName + "/index.html"
                    });
                    response.end();
                } else if (stat.isFile()) {
                    response.writeHead(200, {
                        "Content-Type": mime.lookup(filename),
                        "Server": "protostar",
                        "Last-Modified": new Date(stat.mtime).toString(),
                        "Content-Length": stat.size
                    });
                    response.end();
                } else {
                    logger.error("Unknown file type while resolving " + urlPathName + " : " + filename);
                    handlers.unknownRequest(request, response);
                }
            }, function (errNoSuchFile) {
                var cssMapSuffix = '.css.map';
                var cssSuffix = '.css';
                var endsWith = function (str, postfix) {
                    return str.length >= postfix.length && str.substring(str.length - postfix.length) === postfix;
                };
                var lessPath = false;
                var sassPath = false;
                var map = false;
                if (endsWith(filename, cssMapSuffix)) {
                    lessPath = filename.substring(0, filename.length - cssMapSuffix.length) + ".less";
                    sassPath = filename.substring(0, filename.length - cssMapSuffix.length) + ".scss";
                    map = true;
                } else if (endsWith(filename, cssSuffix)) {
                    lessPath = filename.substring(0, filename.length - cssSuffix.length) + ".less";
                    sassPath = filename.substring(0, filename.length - cssSuffix.length) + ".scss";
                }
                logger.info("lessPath = " + lessPath);
                logger.info("sassPath = " + sassPath);
                if (lessPath && runtime.isExistingFilePath(lessPath)) {
                    response.writeHead(200, {
                        "Content-Type": "text/css; charset=utf-8",
                        "Server": "protostar"
                    });
                    response.end();
                } else if (sassPath && runtime.isExistingFilePath(sassPath)) {
                    response.writeHead(200, {
                        "Content-Type": "text/css; charset=utf-8",
                        "Server": "protostar"
                    });
                    response.end();
                } else {
                    if (!runtime.lenient) {
                        throw new Error("Non existing path while resolving for HEAD " + urlPathName + " : " + filename);
                    }
                    logger.error("Non existing path while resolving for HEAD " + urlPathName + " : " + filename);
                    handlers.unknownRequest(request, response);
                }
            });
        },
        unknownRequest: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            logger.info("Unknown " + request.method + " request: " + parsedUrl.pathname, parsedUrl.query);
            response.writeHead(404);
            response.end();
        },
        prepareThemeRequest: function (request, response) {
            var firstThemeReqData = '';
            request.on('data', function (data) {
                firstThemeReqData += data;
                // Too much data
                if (firstThemeReqData.length > 1e6)
                    request.connection.destroy();
            });
            request.on('end', function () {
                var initData = JSON.parse(firstThemeReqData);
                var auth = "ok_" + new Date().getTime();
                allowedThemeReqs[auth] = initData;
                writeResponse(response, 200, {"Content-Type": "application/json; charset=utf-8"}, JSON.stringify({auth: auth}));
            });
        },
        grabPageImages: function (req, resp) {
            var imageUrlsData = '';
            req.on('data', function (data) {
                imageUrlsData += data;
                // Too much data
                if (imageUrlsData.length > 1e6)
                    req.connection.destroy();
            });
            req.on('end', function () {
                var imageUrls = JSON.parse(imageUrlsData);
                var download = function(uri, filename, callback){
                    if(uri.indexOf('flickr.com')>0 && uri.indexOf('_m.jpg') >0){
                        uri = uri.replace('_m.jpg', '_b.jpg');
                    }
                    if(typeof filename !== 'string'){
                        var imagesDir = runtime.constructProjectPath("images");
                        if(!runtime.isExistingDirPath(imagesDir)){
                            copier.mkdirsSync(imagesDir);
                        }
                        filename = path.resolve(imagesDir, "image_downloaded_" + (new Date().getTime()) + path.extname(uri));
                    }

                    var file = _fs.createWriteStream(filename);
                    var request = http.get(uri, function(response) {
                        response.pipe(file);
                        logger.info('Saved ' + uri + " to " + filename);
                    });


                };
                imageUrls.forEach(function(iu){
                    download(iu, undefined, function(filename){
                        logger.info('Saved ' + iu + " to " + filename);
                    });
                });
                resp.end();
            });
        },
        handleSaveInlineContentUpdate: function (request, response) {
            var saveContentUpdateToFile = function (updateRequest, request, response) {
                var ur = updateRequest;
                logger.info("updating part content for " + ur.partname + ":", ur);
                var partPath = runtime.findFileForUrlPathname("/" + ur.partname + ".html");
                var partContents = composer.prepareEditableRefs(partPath, runtime.readFile(partPath));
                var writtenData = '';
                var storeFileContentUpdate = function ($) {
                    var origId = ur.id;
                    var sel = $('[data-editable="' + ur.partname +'"]');
                    sel.html(ur.content);
                    if (origId.indexOf("psGen") === 0) {
                        logger.info("Removing editable attrs");
                        sel.removeAttr("id");
                        sel.removeAttr("data-editable");
                        sel.attr('data-editable', '');
                    }
                    var out = utils.beautifyHtml($.html());
                    out = out.replace(/data-editable=""/g,'data-editable');
                    project.writeFile(partPath, out);
                    writtenData = out;
                    logger.info("Updated part " + partPath + " with contents : " + out);
                    return out;
                };
                var done = function (result, errors, window) {
                    logger.info("Wrote to " + partPath + " : " + writtenData);
                };
                jqueryRunner.runJQuery(partContents, storeFileContentUpdate, done);
            };
            var body = '';
            request.on('data', function (data) {
                body += data;
                // Too much data
                if (body.length > 1e6)
                    request.connection.destroy();
            });
            request.on('end', function () {
                var contentUpdateReq = JSON.parse(body);
                saveContentUpdateToFile(contentUpdateReq, request, response);
                writeResponse(response, 200, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"ok"}');
            });
        },
        handleSavePartSourceUpdate: function (request, response) {
            var saveSourceUpdateToFile = function (updateRequest, request, response) {
                var ur = updateRequest;
                logger.info("updating part source for " + ur.pathname);
                var pathName = runtime.findFileForUrlPathname(ur.pathname);
                if (!runtime.isProjectPath(pathName)) {
                    logger.error("Refusing to write outside of project" + pathName);
                    return false;
                }
                var content = ur.content;
                logger.info("Writing to " + pathName);
                runtime.writeFile(pathName, content);
                return true;
            };
            var body = '';
            request.on('data', function (data) {
                body += data;
                // Too much data
                if (body.length > 1e6)
                    request.connection.destroy();
            });
            request.on('end', function () {
                var contentUpdateReq = JSON.parse(body);
                logger.info("SAVE REQ = ", contentUpdateReq);
                if (saveSourceUpdateToFile(contentUpdateReq, request, response)) {
                    writeResponse(response, 200, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"ok"}');
                } else {
                    writeResponse(response, 406, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"fail"}');
                }
            });
        },
        compileLessCssFile: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            var file = runtime.readFile(requestedFilePath);
            serversideLessCompiler.handleCompileLessCss(requestedFilePath, file, response);
        },
        handleServeWcmMarkupInfo: function(request, response){
            var htmlFiles = fsops.listRecursively(runtime.constructProjectPath('')).filter(function(p){
                return path.extname(p) === '.html';
            });
            var wcmMarkupFilesInfo = {};
            htmlFiles.forEach(function (tp) {
                var link = runtime.createUrlPathForFile(tp);
                var htmlFile = runtime.readFile(tp);
                if(wcmTagParser.isWcmMarkup(htmlFile)){
                    wcmMarkupFilesInfo[link] = wcmTagParser.createIbmWcmMarkupFragmentInfo(link, htmlFile);
                }
            });

            var wcmMarkupInfoJsonString = JSON.stringify(wcmMarkupFilesInfo);

            writeResponse(response, 200, {"Content-Type": "application/json"}, wcmMarkupInfoJsonString);

        },
        handleCantResolveNonExistingFileRequest: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            logger.error("Non existing path while resolving http request for  " + parsedUrl.pathname + " : " + requestedFilePath);
            if(!runtime.lenient){
                throw new Error("Non existing path while resolving " + parsedUrl.pathname + " : " + requestedFilePath);
            }
            var responseHeaders = {"Content-Type": "text/html; charset=utf-8"};
            var statusCode = 404;
            if (parsedUrl.pathname.indexOf(".html") > 0) {
                var responseContent = "<div><p>404 Not Found : nothing here yet</p><h1>Would you like to create " + requestedFilePath + "?</h1></div>\n";
                var templateList = "";
                var createList = "";
                var templatePaths = project.listAllTemplatePaths();

                var gotoTemplatesList = "";

                templatePaths.forEach(function(tp){
                    var name = runtime.createTemplateReferenceFromFullPath(tp);
                    createList += '<li><a href="' + url.parse(request.url).pathname + '?command=create&templatePath=' + name + '">Copy ' + name + '</a></li>';
                    gotoTemplatesList += '<li><a href="' + url.parse(request.url).pathname + '">' + name + '</a></li>';
                });

                var htmlFiles = fsops.listRecursively(runtime.constructProjectPath('')).filter(function(p){
                    return path.extname(p) === '.html';
                });

                htmlFiles.forEach(function (tp) {
                    var name = runtime.createTemplateReferenceFromFullPath(tp);
                    var link = runtime.createUrlPathForFile(tp);
                    templateList += '<li><a href="' + link + '">' + name + '</a></li>';
                });

                project.logWcmMarkupFilesInProjectInfo();

                responseContent += '<h3>Existing children:</h3><ul>'+gotoTemplatesList+'</ul><h4>Or create new based on:</h4><ul>'+createList+'</ul></div>';
                writeResponse(response, statusCode, responseHeaders, responseContent + project.readViewScriptsMarkup());
            } else {
                if (!runtime.lenient) {
                    var ignoredUrlPaths = {
                        "/favicon.ico": 1
                    };
                    if (!ignoredUrlPaths.hasOwnProperty(parsedUrl.pathname)) {
                        throw new Error("Non existing path while resolving " + parsedUrl.pathname + " : " + requestedFilePath)
                    }
                }
                writeResponse(response, statusCode, responseHeaders, "<div><p>404 Nothing here for " + parsedUrl.pathname + "</p></div>\n" + project.readViewScriptsMarkup());
            }
        },
        handleViewCompiledTemplate: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(decodeURIComponent(parsedUrl.pathname));
            var pathName = parsedUrl.pathname;
            var ts = new Date().getTime();
            var composed;
            if (runtime.cachingEnabled) {
                composed = composer.composeTemplateCached(requestedFilePath);
            } else {
                composed = composer.composeTemplate(requestedFilePath);
            }
            //console.log("COMPILED " + pathName + " in " + (new Date().getTime()- ts) + "ms");
            postProcessComposed(composed, function (postProcessed) {
                //console.log("POSTPROCESSED " + pathName + " in " + (new Date().getTime()- ts) + "ms");

                project.updateDynamic();
                //console.log("UPDATED DYNAMIC " + pathName + " in " + (new Date().getTime()- ts) + "ms");
                var pc = postProcessed.toString();
                writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, pc);

                response.end();
                var te = new Date().getTime();
                var taken = te - ts;
                logger.info("Served " + pathName + " using " + requestedFilePath + " in " + taken + "ms");
                if (runtime.readUserConfig().writeResponsesToFiles) {
                    var responseFileName = requestedFilePath.substring(0, requestedFilePath.length - 5) + "-compiled.html";
                    runtime.writeFile(responseFileName, postProcessed, function () {
                        logger.info("Wrote compiled version to " + responseFileName);
                    });
                }
            });
        },
        handleViewCompiledHbsTemplate: function (request, response) {
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
            postProcessComposed(composed, function (postProcessed) {
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
        },
        handleViewCompiledJadeTemplate: function (request, response) {
            var ts = new Date().getTime();
            var parsedUrl = url.parse(request.url, true);
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
            var jadeFilePath = runtime.findFileForUrlPathname(jadeUrlPathname);
            var html = jadeUtils.compileJadeFile(jadeFilePath);
            var composed;
            if (runtime.cachingEnabled) {
                composed = composer.composeTemplateCached(jadeFilePath, html);
            } else {
                composed = composer.composeTemplate(jadeFilePath, html);
            }
            postProcessComposed(composed, function (postProcessed) {
                project.updateDynamic();
                var pc = postProcessed.toString();
                writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, pc);
                var te = new Date().getTime();
                var taken = te - ts;
                logger.info("Served " + urlPathname + " using " + jadeFilePath + " in " + taken + "ms");
                if (runtime.readUserConfig().writeResponsesToFiles) {
                    var responseFileName = jadeFilePath.substring(0, jadeFilePath.length - 5) + "-compiled.html";
                    runtime.writeFile(responseFileName, postProcessed, function () {
                        logger.info("Wrote compiled version to " + responseFileName);
                    });
                }
            });
        },
        handleViewCompiledMarkdownRequest: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            writeResponse(response, 200, {
                "Content-Type": "text/html; charset=utf-8"
            }, markdownHelper.compileMarkdown(runtime.readFile(runtime.findFileForUrlPathname(parsedUrl.pathname))));
        },
        handleShowScreenshot: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            var imageFilename = "screenshot_" + new Date().getTime() + "." + runtime.readUserConfig().runtime["screenshots"].streamType;
            var screeniePath = project.resolveProjectFile("screenshots/" + imageFilename);
            copier.ensureParentDirExists(screeniePath);
            screenies.createScreenshotAdvanced("http://localhost:" + runtime.getPort() + parsedUrl.pathname, screeniePath, 320, 'all', function (imagePath) {
                logger.info("Saved to " + imagePath);
                logger.info("Redirecting to image: " + project.toRelativePath(imagePath));
                response.writeHead(302, {
                    Location: "http://" + request.headers.host + "/" + project.toRelativePath(imagePath)
                });
                response.end();
            });
        },
        handleViewCompiledTemplateSourceCleaned: function (request, response) {
            function createCleanSourcePageMarkup(markup) {
                var preWrapped = '<!doctype html><html><head><title>HTML Sources</title><link rel="stylesheet" href="/ps/ext/highlightjs/styles/default.css"><script src="/ps/ext/highlightjs/highlight.pack.js"></script><script>hljs.initHighlightingOnLoad();</script></head><body><div class="html"><pre><code>';
                var postWrapped = '</code></pre></div></body></html>';
                var comp = markup.toString().trim();
                comp = utils.removeAllHtmlComments(comp);
                comp = utils.beautifyHtml(comp);
                comp = utils.removeBlankLines(comp);
                comp = utils.encodeHtmlEntities(comp);
                return preWrapped + comp + postWrapped;
            }

            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            var file = runtime.readFile(requestedFilePath);
            var pathName = parsedUrl.pathname;
            var ts = new Date().getTime();
            var composed = composer.composeTemplate(requestedFilePath, file);
            postProcessComposed(composed, function (postProcessed) {
                project.updateDynamic();
                var sourceResponse = createCleanSourcePageMarkup(postProcessed);
                writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, sourceResponse);
                var te = new Date().getTime();
                var taken = te - ts;
                logger.info("Served " + pathName + " using " + requestedFilePath + " in " + taken + "ms");
            });
        },
        handleViewCompiledTemplateSource: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            var file = runtime.readFile(requestedFilePath);
            var pathName = parsedUrl.pathname;
            var ts = new Date().getTime();
            var composed = composer.composeTemplate(requestedFilePath, file);

            function createSourcePageMarkup(markup) {
                var preWrapped = '<!doctype html><html><head><title>HTML Sources</title><link rel="stylesheet" href="/ps/ext/highlightjs/styles/default.css"><script src="/ps/ext/highlightjs/highlight.pack.js"></script><script>hljs.initHighlightingOnLoad();</script></head><body><div class="html"><pre><code>';
                var postWrapped = '</code></pre></div></body></html>';
                var comp = markup.toString().trim();
                var quoteSourceMarkupLiteral = function (str) {
                    return (str + '').replace(/([?*+^$\\(){}|])/g, "\\$1");
                };
                comp = quoteSourceMarkupLiteral(comp);
                comp = utils.encodeHtmlEntities(comp);
                return preWrapped + comp + postWrapped;
            }

            postProcessComposed(composed, function (postProcessed) {
                project.updateDynamic();
                var sourceResponse = createSourcePageMarkup(postProcessed);
                writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, sourceResponse);
                var te = new Date().getTime();
                var taken = te - ts;
                logger.info("Served " + pathName + " using " + requestedFilePath + " in " + taken + "ms");
            });
        },
        handleViewRawSourceRequest: function (request, response) {
            function createRawPageMarkup(markup) {
                var preWrapped = '<!doctype html><html><head><title>HTML Sources</title><link rel="stylesheet" href="/ps/ext/highlightjs/styles/default.css"><script src="/ps/ext/highlightjs/highlight.pack.js"></script><script>hljs.initHighlightingOnLoad();</script></head><body><div class="html"><pre><code>';
                var postWrapped = '</code></pre></div></body></html>';
                var comp = markup.toString().trim();
                comp = utils.beautifyHtml(comp);
                return preWrapped + comp + postWrapped;
            }

            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            var file = runtime.readFile(requestedFilePath);
            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, createRawPageMarkup(file));
        },
        handleEditTemplateSource: function (request, response) {
            function listAceThemes() {
                var entries = runtime.listDir(runtime.findFileForUrlPathname('/ps/ext/ace-builds/src'));
                logger.info("ACE THEMES : ", entries);
                var themes = [];
                var themePrefix = 'theme-';
                entries.forEach(function (name) {
                    var f = name.trim();
                    logger.debug("Processing :: ", f);
                    var ti = f.indexOf(themePrefix);
                    if (ti === 0 && f.indexOf(".js") > 0) {
                        themes.push(f.substring(ti + themePrefix.length, f.length - 3));
                    }
                });
                logger.info("Read " + themes.length + " theme names");
                return themes;
            }

            var parsedUrl = url.parse(request.url, true);
            var pathName = parsedUrl.pathname;
            var editSources = "" + runtime.readFile(runtime.constructAppPath(["core", "assets", "edit.html"]));
            var crit = '___EDIT_PATH___';
            var out = utils.replaceTextFragment(editSources, crit, pathName);
            var themes = listAceThemes();
            var themesString = themes.join(',');
            out = utils.replaceTextFragment(out, '___THEMES_PLACEHOLDER___', themesString);
            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, out);
        },
        handleUnknownFileType: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            logger.error("Unknown file type while resolving " + parsedUrl.pathname + " : " + requestedFilePath);
            //handleUnknownFiletype(response, filename);
            var responseHeaders = {"Content-Type": "text/plain; charset=utf-8"};
            var statusCode = 500;
            var responseContent = "500 Unknown filetype  : " + requestedFilePath + "\n";
            writeResponse(response, statusCode, responseHeaders, responseContent);
        },
        serveExistingFile: function (request, response) {
            if(!this.hasOwnProperty("staticCache")){
                this.staticCache = {};
            }

            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(decodeURIComponent(parsedUrl.pathname));

            var t = this;
            fs.stat(requestedFilePath).done(function (stat) {
                var atime = stat.ctime.getTime();
                var cached = false;

                if(enableFileCaching && t.staticCache.hasOwnProperty(requestedFilePath)){
                    cached = t.staticCache[requestedFilePath];
                    if(atime <= cached.lastModified){
                        if(cached.binary){
                            writeBinaryResponse(response, 200, {
                                "Content-Type": cached.mime,
                                "Content-Length": cached.size
                            }, cached.data);
                            logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime)
                        }else{
                            writeResponse(response, 200, {
                                "Content-Type": cached.mime,
                                "Content-Length": cached.size
                            }, cached.data);
                            logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime)
                        }
                    }else{
                        cached = false;
                    }
                }
                if(!cached){
                    var fileMime = mime.lookup(requestedFilePath);
                    if (fileMime && (fileMime.indexOf("text/") === 0 || fileMime.indexOf('application/json') === 0 || fileMime.indexOf('application/javascript') === 0)) {
                        cached = {
                            data: runtime.readFile(requestedFilePath),
                            size : stat.size,
                            mime: fileMime,
                            binary: false,
                            lastModified : atime
                        };

                    } else {
                        cached = {
                            data: utils.readBinaryFileSync(requestedFilePath),
                            size : stat.size,
                            mime: fileMime,
                            binary: true,
                            lastModified : atime
                        };

                    }
                    if(enableFileCaching){
                        t.staticCache[requestedFilePath] = cached;
                    }

                    if(cached.binary){
                        writeBinaryResponse(response, 200, {
                            "Content-Type": cached.mime,
                            "Content-Length": cached.size
                        }, cached.data);
                        logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime)
                    }else{
                        var acceptEncoding = request.headers['accept-encoding'];
                        //console.log("ACCEPT == " + acceptEncoding);
                        if(acceptEncoding){
                            var raw = new stream.Readable();
                            raw._read = function noop() {}; // redundant? see update below
                            raw.push(cached.data);
                            raw.push(null);

                            if (acceptEncoding.indexOf("deflate") >=0) {
                                response.writeHead(200, { 'content-type':cached.mime,'content-encoding': 'deflate' });
                                raw.pipe(zlib.createDeflate()).pipe(response);
                            } else if (acceptEncoding.indexOf("gzip") >=0) {
                                response.writeHead(200, { 'content-type':cached.mime,'content-encoding': 'gzip' });
                                raw.pipe(zlib.createGzip()).pipe(response);
                            } else {
                                writeResponse(response, 200, {
                                    "Content-Type": cached.mime,
                                    "Content-Length": cached.size
                                }, cached.data);
                            }

                        }else{
                            writeResponse(response, 200, {
                                "Content-Type": cached.mime,
                                "Content-Length": cached.size
                            }, cached.data);
                        }



                        logger.debug("200 OK: GET " + parsedUrl.pathname + " " + cached.mime)
                    }
                }
            }, function (err) {
                logger.error("Existing file to serve does not exist: " + requestedFilePath, err.stack);
                writeResponse(response, 404, {
                    "Content-Type": "text/plain; charset=utf-8"
                }, "File could not be found");
            });
        },
        serveExistingCssFile: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(decodeURIComponent(parsedUrl.pathname));
            fs.readFile(requestedFilePath).done(function (file) {
                var fileMime = mime.lookup(requestedFilePath);
                if (fileMime && (fileMime.indexOf("text/") === 0 || fileMime.indexOf('application/json') === 0 || fileMime.indexOf('application/javascript') === 0)) {
                    writeResponse(response, 200, {
                        "Content-Type": fileMime
                    }, file);
                } else {
                    writeBinaryResponse(response, 200, {
                        "Content-Type": fileMime
                    }, file);
                }
            }, function (err) {
                logger.error("Existing css file to serve does not exist: " + requestedFilePath, err.stack);
                writeResponse(response, 404, {
                    "Content-Type": "text/plain; charset=utf-8"
                }, "File could not be found");
            });
        },
        handleRedirectToDirectoryIndex: function (request, response) {
            var pathName = url.parse(request.url, true).pathname;
            var dirFn = pathName;
            if (dirFn.charAt(dirFn.length - 1) === "/") {
                dirFn = dirFn.substring(0, dirFn.length - 1);
            }
            dirFn += runtime.readUserConfig().defaultPageTemplatePath;
            logger.info("Redirecting dir request : " + pathName);
            response.writeHead(302, {
                Location: "http://" + request.headers.host + dirFn
            });
            response.end();
        },
        unknownDynamicDataRequest: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            logger.info("Unknown path " + parsedUrl.pathname, parsedUrl.query);
            response.end();
        },
        commandNamesJSON: function (request, response) {
            var cmdNames = projectCommands.getCommandNames();
            writeResponse(response, 200, {
                'Content-Type': 'application/json'
            }, JSON.stringify(cmdNames));
        },
        handleEditData: function (request, response) {
            var urlParts = url.parse(request.url, true);
            logger.info("Handling edit " + urlParts.query.path);
            var urlQuery = urlParts.query;
            var filename = runtime.findFileForUrlPathname(urlQuery.path);
            logger.info("Found file to edit: " + filename);
            var content = "" + runtime.readFile(filename);
            var data = {
                pathname: urlQuery.path,
                content: content
            };
            writeResponse(response, 200, {
                "Content-Type": "application/json; charset=utf-8"
            }, JSON.stringify(data));
        },
        handleImageListing: function (request, response) {
            var listImages = function (imagesDir, dirReplacement, folderName) {
                var fileNames = runtime.listDir(imagesDir);
                var imageFiles = [];
                var baseName = folderName;
                var ie = runtime.readUserConfig()["imageExtensions"];
                var extMap = {};
                ie.forEach(function (e) {
                    extMap[e] = 1;
                });
                fileNames.forEach(function (fileName) {
                    var extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
                    if (extMap.hasOwnProperty(extension)) {
                        var imagePath = dirReplacement + "/" + fileName;
                        imageFiles.push({
                            image: imagePath,
                            thumb: imagePath,
                            folder: baseName,
                            name: fileName
                        });
                    }
                });
                imageFiles.sort(function (a, b) {
                    var ps = utils.sortString(a.path, b.path);
                    if (ps === 0) {
                        ps = utils.sortString(a.name, b.name);
                    }
                    return ps;
                });
                return imageFiles;
            };
            var psImagesDir = runtime.constructAppPath(["core", "assets"]);
            var psImages = listImages(psImagesDir, "/ps/assets", "Protostar");
            var projImagesDir = runtime.constructProjectPath("images");
            if (runtime.isExistingDirPath(projImagesDir)) {
                var projectImages = listImages(projImagesDir, "/images", "Project");
                projectImages.forEach(function (i) {
                    psImages.push(i);
                });
            }
            writeResponse(response, 200, {
                "Content-Type": "application/json; charset=utf-8"
            }, JSON.stringify(psImages));
            logger.info("Wrote images:", psImages);
        },
        unsupportedRequestMethod: function (request, response) {
            var errorMsg = "Unhandled request method: " + request.method + " " + request.url;
            logger.error(errorMsg);
            response.writeHead(404, {
                Accept: "text/plain"
            });
            response.write(errorMsg);
            response.end();
        },
        handleCreateNewPortalMavenProjectZip: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            //serve up
            var config = allowedThemeReqs[parsedUrl.query.auth];// JSON.parse(authorizedThemeReqData);
            var ti = new portalThemeImporter.ThemeImporter(config);
            ti.createNewThemeProjectZipBuffer(config.projectName, os.tmpdir(), config, function (buffer) {
                response.writeHead(200, {
                    'Expires': 0,
                    'Cache-Control': 'must-revalidate, post-check=0, pre-check=0',
                    'Content-Description': 'File Transfer',
                    'Content-type': 'application/octet-stream',
                    'Content-Disposition': 'attachment; filename=\"' + config.projectName + '.zip\"',
                    'Content-Transfer-Encoding': 'binary',
                    "Content-Length": buffer.length
                });
                response.write(buffer, "binary");
                response.end();
            });
        },
        commandRequest: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            var command = parsedUrl.query.command;
            logger.info("Running command " + command);
            var responseData = projectCommands.handleCommandRequest(command, request, response);
            if (typeof responseData === 'object') {
                if (responseData.status === 302) {
                    response.writeHead(responseData.status, responseData.headers);
                    response.end();
                } else {
                    writeResponse(response, responseData.status, responseData.headers, responseData.content);
                }
            } else {
                logger.info("No response for command " + command);
            }
        },
        viewProjectConfig: function (request, response) {
            var wrapper = '<!-- wrap:/ps/backend/layout-help -->\n';
            var editConfigView = runtime.constructAppPath(["core", "backend", "projectConfigCompiled.html"]);
            var editConfigContent = runtime.readFile(runtime.constructAppPath(["core", "assets", "projectConfig.html"]));
            var helpContent = wrapper + editConfigContent;
            runtime.writeFile(editConfigView, helpContent);
            var composed = composer.composeTemplate(editConfigView, helpContent);
            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
        },
        viewHelp: function (request, response) {
            var mdPath = runtime.constructAppPath("README.md");
            var mdContents = markdownHelper.createTableOfContents(runtime.readFile(mdPath) + "");
            var mdMarkup = markdownHelper.compileMarkdown(mdContents);
            var wrapper = '<!-- wrap:/ps/backend/layout-help -->\n';
            var helpPath = runtime.constructAppPath(["core", "backend", "help.html"]);
            runtime.writeFile(helpPath, mdMarkup);
            var dropPoints = composer.findAllDropPoints(helpPath, mdMarkup, runtime.userConfig.dropPointTypes);
            dropPoints.sort(function (a, b) {
                return -1 * (a.start - b.start);
            });
            var helpContent = mdMarkup;
            dropPoints.forEach(
                /**
                 *
                 * @param {utils.Placeholder} dp
                 */
                function (dp) {
                //noinspection JSUnresolvedFunction
                    helpContent = composer.replacePartContents(helpContent, dp, '<pre><code>' + utils.encodeHtmlEntities(dp.getTag())) + '</code></pre>';
            });
            helpContent = wrapper + helpContent;
            runtime.writeFile(helpPath, helpContent);
            var composed = composer.composeTemplate(helpPath, helpContent);
            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
        },
        viewCreateNewPortalThemeMavenProjectForm: function (request, response) {
            var wrapper = '<!-- wrap:/ps/backend/layout-help -->\n';
            var editConfigView = runtime.constructAppPath(["core", "backend", "newPortalThemeCompiled.html"]);
            var editConfigContent = runtime.readFile(runtime.constructAppPath(["core", "assets", "newPortalTheme.html"]));
            var helpContent = wrapper + editConfigContent;
            runtime.writeFile(editConfigView, helpContent);
            var composed = composer.composeTemplate(editConfigView, helpContent);
            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
        },
        handleRestData: function (request, response) {
            var restPrefix = "/ps/rest/";
            var objPrefix = "object";
            var listPrefix = "list";
            var urlParts = url.parse(request.url, true);
            var urlPathname = decodeURIComponent(urlParts.pathname);
            logger.info("REST " + request.method + " " + urlPathname + " with query:", urlParts.query);
            var modelPath;
            var fs = require("fs");
            var modelTypePrefix;
            var isObjectModel = false;
            if (urlPathname.indexOf(restPrefix + objPrefix) === 0) {
                modelTypePrefix = objPrefix;
                isObjectModel = true;
            } else if (urlPathname.indexOf(restPrefix + listPrefix) === 0) {
                modelTypePrefix = listPrefix;
            } else {
                throw new Error("Unsupported urlpathname: " + urlPathname);
            }
            modelPath = urlPathname.substring((restPrefix + modelTypePrefix).length + 1);
            var modelFilePath = runtime.constructProjectPath(modelPath + ".json");
            logger.info("MODEL PATH=" + modelPath + " => " + modelFilePath);
            function handleObjectModelRequest() {
                switch (request.method) {
                    case 'GET':
                        if (fileExists) {
                            writeResponse(response, 200, {"Content-Type": "application/json; charset=utf-8"}, runtime.readFile(modelFilePath));
                        } else {
                            throw new Error("Dont understand " + request.method + " " + urlPathname + " -> there is no file at " + modelFilePath);
                        }
                        break;
                    case 'POST':
                        if (fileExists) {
                            console.error("File already exists at " + modelFilePath);
                            response.writeHead(404, {
                                "error-message": "File already exists at " + modelFilePath
                            });
                            response.end();
                        } else {
                            var postRequestData = '';
                            request.on('data', function (data) {
                                postRequestData += data;
                                var length = postRequestData.length;
                                if (length > 1e6) {
                                    request.connection.destroy();
                                    throw new Error("File was getting too large ! " + length)
                                }
                            });
                            request.on('end', function () {
                                var postItem = JSON.parse(postRequestData);
                                if (!postItem.hasOwnProperty("id")) {
                                    throw new Error("An id property should be set on the data");
                                }
                                if (postItem.hasOwnProperty("version")) {
                                    postItem.version = 1;
                                }
                                postItem.created = new Date().getTime();
                                postItem.updated = new Date().getTime();
                                fs.writeFileSync(modelFilePath, JSON.stringify(postItem), 'utf8');
                                writeResponse(response, 200, {
                                    "Content-Type": "application/json; charset=utf-8",
                                    "Location": "http://" + request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath
                                }, JSON.stringify(postItem));
                            });
                        }
                        return;
                        break;
                    case 'PUT':
                        if (fileExists) {
                            var putRequestData = '';
                            request.on('data', function (data) {
                                putRequestData += data;
                                var length = putRequestData.length;
                                if (length > 1e6) {
                                    request.connection.destroy();
                                    throw new Error("File was getting too large ! " + length)
                                }
                            });
                            request.on('end', function () {
                                var putItem = JSON.parse(putRequestData);
                                var currentItem = JSON.parse(runtime.readFile(modelFilePath));
                                if (currentItem.hasOwnProperty("version")) {
                                    putItem.version = currentItem.version + 1;
                                }
                                if (currentItem.hasOwnProperty("created") || currentItem.hasOwnProperty("updated")) {
                                    putItem.updated = new Date().getTime();
                                }
                                fs.writeFileSync(modelFilePath, JSON.stringify(putItem), 'utf8');
                                writeResponse(response, 200, {
                                    "Content-Type": "application/json; charset=utf-8",
                                    "Location": "http://" + request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath
                                }, JSON.stringify(putItem));
                            });
                        } else {
                            console.error("Dont understand " + request.method + " " + urlPathname);
                            response.writeHead(404, {
                                "error-message": "Dont understand " + request.method + " " + urlPathname
                            });
                            response.end();
                        }
                        return;
                        break;
                    case 'DELETE':
                        if (!fileExists) {
                            throw new Error("there is no file to delete at path " + modelFilePath);
                        } else {
                            logger.info("DELETE : " + modelFilePath);
                            fs.unlinkSync(modelFilePath);
                            response.writeHead(200);
                            response.end();
                        }
                        return;
                        break;
                    case 'OPTIONS':
                        console.error("No OPTIONS support yet for object mode");
                        response.writeHead(404, {
                            "error-message": "No OPTIONS support yet for object mode"
                        });
                        response.end();
                        return;
                        break;
                    case 'HEAD':
                        if (fileExists) {
                            response.writeHead(200, {
                                "Content-Type": "application/json; charset=utf-8"
                            });
                            response.end();
                        } else {
                            response.writeHead(404);
                            response.end();
                        }
                        return;
                        break;
                    default:
                        console.error("Dont understand " + request.method + " " + urlPathname);
                        response.writeHead(404, {
                            "error-message": "Dont understand " + request.method + " " + urlPathname
                        });
                        response.end();
                        return;
                        break;
                }
            }

            function handleListModelRequest() {
                switch (request.method) {
                    case 'GET':
                        if (fileExists) {
                            writeResponse(response, 200, {"Content-Type": "application/json; charset=utf-8"}, runtime.readFile(modelFilePath));
                        } else if (higherModelFileExists && idPart) {
                            var itemsArray = JSON.parse(runtime.readFile(higherModelFilePath));
                            var itm;
                            itemsArray.forEach(function (i) {
                                if (i.id == idPart) {
                                    itm = i;
                                }
                            });
                            if (itm) {
                                writeResponse(response, 200, {"Content-Type": "application/json; charset=utf-8"}, JSON.stringify(itm));
                            } else {
                                writeResponse(response, 404, {"Content-Type": "application/json; charset=utf-8"});
                            }
                        } else {
                            throw new Error("Dont understand " + request.method + " " + urlPathname);
                        }
                        break;
                    case 'POST':
                        if (fileExists) {
                            var requestData = '';
                            request.on('data', function (data) {
                                requestData += data;
                                // Too much data
                                var length = requestData.length;
                                if (length > 1e6) {
                                    request.connection.destroy();
                                    throw new Error("File was getting too large ! " + length)
                                }
                            });
                            request.on('end', function () {
                                var postedItem = JSON.parse(requestData);
                                var itemsArray = JSON.parse(runtime.readFile(modelFilePath));
                                var maxId = 0;
                                itemsArray.forEach(function (i) {
                                    if (i.id) {
                                        if (typeof i.id === 'number' && i.id > maxId) {
                                            maxId = i.id;
                                        } else if (typeof i.id === 'string' && parseInt(i.id, 10) == i.id) {
                                            var n = parseInt(i.id, 10);
                                            if (n > maxId) {
                                                maxId = n;
                                            }
                                        }
                                    }
                                });
                                var newId = maxId + 1;
                                postedItem.id = newId;
                                postedItem.version = 1;
                                var now = new Date().getTime();
                                postedItem.created = now;
                                postedItem.updated = now;
                                itemsArray.push(postedItem);
                                fs.writeFileSync(modelFilePath, JSON.stringify(itemsArray), 'utf8');
                                writeResponse(response, 201, {
                                    "Content-Type": "application/json; charset=utf-8",
                                    "Location": "http://" + request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath + "/" + newId
                                }, JSON.stringify(postedItem));
                            });
                        } else {
                            throw new Error("Dont understand " + request.method + " " + urlPathname);
                        }
                        return;
                        break;
                    case 'PUT':
                        if (higherModelFileExists) {
                            var putRequestData = '';
                            request.on('data', function (data) {
                                putRequestData += data;
                                var length = putRequestData.length;
                                if (length > 1e6) {
                                    request.connection.destroy();
                                    throw new Error("File was getting too large ! " + length)
                                }
                            });
                            request.on('end', function () {
                                var putItem = JSON.parse(putRequestData);
                                var itemsArray = JSON.parse(runtime.readFile(higherModelFilePath));
                                var itm;
                                var idx = -1;
                                itemsArray.forEach(function (i, dx) {
                                    if (i.id == idPart) {
                                        itm = i;
                                        idx = dx;
                                    }
                                });
                                if (!itm || idx < 0) {
                                    throw new Error("Cant find item at resource " + higherModelPath + " with id " + idPart);
                                }
                                if (!itm.hasOwnProperty("id") || typeof itm.id !== 'number' || !itm.hasOwnProperty("version") || typeof itm.version !== 'number') {
                                    throw new Error("An item should have both id & version set as numbers : " + JSON.stringify(itm));
                                }
                                itemsArray[idx] = putItem;
                                putItem.version = itm.version + 1;
                                putItem.updated = new Date().getTime();
                                fs.writeFileSync(higherModelFilePath, JSON.stringify(itemsArray), 'utf8');
                                writeResponse(response, 200, {
                                    "Content-Type": "application/json; charset=utf-8",
                                    "Location": "http://" + request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath + "/" + putItem.id
                                }, JSON.stringify(putItem));
                            });
                        } else {
                            throw new Error("Dont understand " + request.method + " " + urlPathname);
                        }
                        return;
                        break;
                    case 'DELETE':
                        if (higherModelFileExists) {
                            var putRequestData = '';
                            request.on('data', function (data) {
                                putRequestData += data;
                                var length = putRequestData.length;
                                if (length > 1e6) {
                                    request.connection.destroy();
                                    throw new Error("File was getting too large ! " + length)
                                }
                            });
                            request.on('end', function () {
                                var itemsArray = JSON.parse(runtime.readFile(higherModelFilePath));
                                var itm;
                                var idx = -1;
                                itemsArray.forEach(function (i, dx) {
                                    if (i.id == idPart) {
                                        itm = i;
                                        idx = dx;
                                    }
                                });
                                if (!itm || idx < 0) {
                                    throw new Error("Cant find and thus not delete item at resource " + higherModelPath + " with id " + idPart);
                                }
                                itemsArray.splice(idx, 1);
                                fs.writeFileSync(higherModelFilePath, JSON.stringify(itemsArray), 'utf8');
                                response.writeHead(200);
                                response.end();
                            });
                        } else {
                            throw new Error("Dont understand " + request.method + " " + urlPathname);
                        }
                        return;
                        break;
                    case 'OPTIONS':
                        throw new Error("Dont understand " + request.method + " " + urlPathname);
                        break;
                    case 'HEAD':
                        if (fileExists) {
                            response.writeHead(200, {
                                "Content-Type": "application/json; charset=utf-8"
                            });
                            response.end();
                        } else if (higherModelFileExists) {
                            var itemsArray = JSON.parse(runtime.readFile(higherModelFilePath));
                            var itm;
                            var idx;
                            itemsArray.forEach(function (i, dx) {
                                if (i.id == idPart) {
                                    itm = i;
                                    idx = dx;
                                }
                            });
                            if (!itm) {
                                response.writeHead(404);
                                response.end();
                            } else {
                                response.writeHead(200, {
                                    "Content-Type": "application/json; charset=utf-8"
                                });
                            }
                        } else {
                            response.writeHead(404);
                            response.end();
                        }
                        return;
                        break;
                    default:
                        throw new Error("Dont understand " + request.method + " " + urlPathname);
                        break;
                }
            }

            var fileExists = fs.existsSync(modelFilePath);
            if (request.method.toLowerCase() === 'post' && modelTypePrefix === 'object' && urlParts.query.hasOwnProperty("create") && urlParts.query.create === '') {
                logger.info("Creating new list model at " + modelFilePath);
                if (fileExists) {
                    console.error("List model already exists at " + modelFilePath);
                    response.writeHead(404, {
                        "error-message": "List model already exists at " + modelFilePath
                    });
                    response.end();
                } else {
                    fs.writeFileSync(modelFilePath, '[]', 'utf8');
                    logger.info("Created new list model at " + modelFilePath);
                    writeResponse(response, 201, {
                        "Content-Type": "application/json; charset=utf-8",
                        "Location": "http://" + request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath
                    }, '[]');
                }
                return;
            }
            var data;
            var idPart;
            if (!fileExists) {
                var higherModelPath = modelPath.substring(0, modelPath.lastIndexOf('/'));
                var higherModelFilePath = runtime.constructProjectPath(higherModelPath + ".json");
                var higherModelFileExists = fs.existsSync(higherModelFilePath);
                idPart = modelPath.substring(modelPath.lastIndexOf('/') + 1)
            } else {
                data = runtime.readFile(modelFilePath);
            }
            if (isObjectModel) {
                handleObjectModelRequest();
            } else {
                handleListModelRequest();
            }
        }
    };
    return handlers;
}
module.exports = {
    createHandlers: createHandlers,
    writeResponse: writeResponse,
    writeBinaryResponse: writeBinaryResponse
};