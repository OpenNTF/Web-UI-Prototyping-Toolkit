var  screenies = require("./screenies"),
    portalThemeImporter = require("./portalThemeImporter"),
    url = require("url"),
    mime = require('mime'),
    fs = require("fs"),
    jqueryRunner = require("./jqueryRunner"),
    utils = require("./utils"),
    markdownHelper = require("./markdownHelper");


var logger = utils.createLogger({sourceFilePath : __filename});

var writeBinaryResponse = function (response, status, headers, binaryContent) {
    response.writeHead(status, headers);
    response.write(binaryContent, "binary");
    response.end();
};

var writeResponse = function (response, status, headers, content) {
    response.writeHead(status, headers);
    response.write(content);
    response.end();
};

function createHandlers(args){

    var composer = args.composer;
    var sslc = args.sslc;
    var runtime = args.runtime;
    var project = args.project;
    var projectCommands= args.projectCommands;
    var allowedThemeReqs = args.allowedThemeReqs;

    var postProcessComposed = function (markup, done) {
        if(markup.content.trim().length > 0){
            var doneF = function (result, errors) {
                var args = {};
                done(result, errors, args);
            };
            logger.debug("Running postProcessComposed for : ", markup);
            jqueryRunner.runJQuery(markup.content, function ($) {
                var metadata = markup.metadata;
                jqueryRunner.validateBootstrapGrid($);
                jqueryRunner.assignUniqueIdsToEditables($, metadata);
                jqueryRunner.processProtostarAttributes($, function(attrName, attrVal){
                    return runtime.determineProtostarAttributeValue(attrName, attrVal);
                });
                jqueryRunner.insertPlaceholderResources($, metadata);
                jqueryRunner.ensureViewScriptsPresent($);
                var processedHtml = $.html();
                if(processedHtml.indexOf('<html') >= 0 && processedHtml.trim().indexOf('<!') !== 0){
                    processedHtml = '<!doctype html>\n' + processedHtml;
                }
                return processedHtml;//$("html")[0].outerHTML;
            }, doneF);
        }else{
            done(markup.content);
        }
    };

    var handlers = {
        transparantLessCss: function(request, response){
        var findLessInfo = function(requestedFilePath){
            var lessPath = false;
            var map = false;
            if(utils.endsWith(requestedFilePath, '.css.map')){
                lessPath = requestedFilePath.substring(0, requestedFilePath.length - '.css.map'.length) + ".less";
                map = true;
            }else if (utils.endsWith(requestedFilePath, '.css')){
                lessPath = requestedFilePath.substring(0, requestedFilePath.length - '.css'.length) + ".less";
            }
            var out = false;
            if(lessPath && runtime.isExistingFilePath(lessPath)){
                out = {
                    requestedFilePath : requestedFilePath,
                    lessFilePath : lessPath,
                    outputFormat : map ? "cssmap" : "css"
                };
            }
            return out;
        };
        var parsedUrl = url.parse(request.url, true);
        var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
        var lessInfo = findLessInfo(requestedFilePath);
        if(lessInfo){
            if(lessInfo.outputFormat === 'cssmap'){
                sslc.handleCompileLessCssMap(lessInfo.lessFilePath, runtime.readFile(lessInfo.lessFilePath), response);
            }else{
                sslc.handleCompileLessCss(lessInfo.lessFilePath, runtime.readFile(lessInfo.lessFilePath), response);
            }
        }else{
            handlers.handleCantResolveNonExistingFileRequest(request, response);
        }
    },

    serveHEAD: function(request, response){
        var urlParts = url.parse(request.url, true);
        var urlPathName = urlParts.pathname;
        var filename = runtime.findFileForUrlPathname(urlPathName);
        fs.exists(filename, function (exists) {
            if (!exists) {
                var cssMapSuffix = '.css.map';
                var cssSuffix = '.css';
                var endsWith = function (str, postfix) {
                    return str.length >= postfix.length && str.substring(str.length - postfix.length) === postfix;
                };
                var lessPath = false;
                var map = false;
                if (endsWith(filename, cssMapSuffix)) {
                    lessPath = filename.substring(0, filename.length - cssMapSuffix.length) + ".less";
                    map = true;
                } else if (endsWith(filename, cssSuffix)) {
                    lessPath = filename.substring(0, filename.length - cssSuffix.length) + ".less";
                }
                var handledAsLess = false;
                if (lessPath) {
                    if (runtime.isExistingFilePath(lessPath)) {
                        handledAsLess = true;
                        response.writeHead(200, {
                            "Content-Type": "text/css; charset=utf-8", "Server": "protostar"
                        });
                        response.end();
                    }
                }
                if (!handledAsLess) {
                    logger.error("Non existing path while resolving for HEAD " + urlPathName + " : " + filename);
                    handlers.unknownRequest(request, response);
                }
            } else {
                fs.stat(filename, function (err, stat) {
                    if (err) {
                        logger.error("STAT ERROR", err);
                        console.trace(err);
                        handlers.unknownRequest(request, response);
                    } else {
                        if (stat.isDirectory()) {
                            response.writeHead(404, {Server:"protostar"});
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
                    }
                });
            }
        });
    },
    unknownRequest: function (request, response) {
            var parsedUrl = url.parse(request.url, true);
            logger.info("Unknown " + request.method + " request: " + parsedUrl.pathname, parsedUrl.query);
            response.end();
    },
    prepareThemeRequest: function(request, response){
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
        handleSaveInlineContentUpdate: function (request, response) {
            var saveContentUpdateToFile = function (updateRequest, request, response) {
                var ur = updateRequest;
                logger.info("updating part content for " + ur.partname +":", ur);
                var partPath = runtime.findFileForUrlPathname("/" + ur.partname + ".html");
                var partContents = composer.prepareEditableRefs(partPath, runtime.readFile(partPath));
                var storeFileContentUpdate = function ($) {
                    jqueryRunner.assignUniqueIdsToEditables($);
                    var origId = ur.id;
                    var sel = $("#" + origId);
                    sel.html(ur.content);
                    if(origId.indexOf("psGen") === 0){
                        logger.info("Removing editable attrs");
                        sel = $("#" + origId);
                        sel.removeAttr("id");
                        sel.removeAttr("contenteditable");
                        sel.removeAttr("data-editable");
                        sel.attr('data-editable','');
                    }
                    var out = $("body").html();
                    project.writeFile(partPath, out);
                    logger.info("Updated part " + partPath + " with contents : " + out);
                    return out;
                };
                var done = function (result, errors, window) {};
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
        handleSavePartSourceUpdate: function(request, response) {

            var saveSourceUpdateToFile = function (updateRequest, request, response) {
                var ur = updateRequest;
                logger.info("updating part source for " + ur.pathname);
                var pathName = runtime.findFileForUrlPathname(ur.pathname);
                if(!runtime.isProjectPath(pathName)){
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
            if(saveSourceUpdateToFile(contentUpdateReq, request, response)){
                writeResponse(response, 200, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"ok"}');
            }else{
                writeResponse(response, 406, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"fail"}');
            }
        });
    },
        compileLessCssFile: function(request, response){
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            var file = utils.readTextFileSync(requestedFilePath);
            sslc.handleCompileLessCss(requestedFilePath, file, response);
        },
        handleCantResolveNonExistingFileRequest : function(request, response){
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            logger.error("Non existing path while resolving " + parsedUrl.pathname + " : " + requestedFilePath);
            var responseHeaders = {"Content-Type": "text/html; charset=utf-8"};
            var statusCode = 404;
            if(parsedUrl.pathname.indexOf(".html") >0){
                var responseContent = "<div><p>404 Not Found : nothing here yet</p><h1>Would you like to create " + requestedFilePath + "?</h1></div>\n";
                var templatePaths = project.listAllTemplatePaths();
                responseContent += "<ul>";
                templatePaths.forEach(function (tp) {
                    var name = runtime.createTemplateReferenceFromFullPath(tp);
                    responseContent += '<li><a href="' + url.parse(request.url).pathname + '?command=create&templatePath=' + name + '">Copy ' + name + '</a></li>';
                });
                responseContent += "</ul></div>";
                writeResponse(response, statusCode, responseHeaders, responseContent + project.readViewScriptsMarkup());
            }else{
                writeResponse(response, statusCode, responseHeaders, "<div><p>404 Nothing here for "+parsedUrl.pathname+"</p></div>\n" + project.readViewScriptsMarkup());
            }
        },

        handleViewCompiledTemplate: function(request, response) {
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            //var file = utils.readTextFileSync(requestedFilePath);
            var file = runtime.readFile(requestedFilePath);
            var pathName = parsedUrl.pathname;
            var ts = new Date().getTime();
            var composed = composer.composeTemplateCached(requestedFilePath, file);
            postProcessComposed(composed, function (postProcessed) {
                project.updateDynamic();
                var pc = postProcessed.toString();
                writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, pc);
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

        handleViewCompiledMarkdownRequest: function(request, response) {
            var parsedUrl = url.parse(request.url, true);
            writeResponse(response, 200, {
                "Content-Type": "text/html; charset=utf-8"
            }, markdownHelper.compileMarkdown(runtime.readFile(runtime.findFileForUrlPathname(parsedUrl.pathname))));
        },
        handleShowScreenshot: function(request, response) {
            var parsedUrl = url.parse(request.url, true);
            var imageFilename = "screenshot_" + new Date().getTime() + "." + runtime.readUserConfig().runtime.screenshots.streamType;
            var screeniePath = project.resolveProjectFile("screenshots/" + imageFilename);
            utils.ensureParentDirExists(screeniePath);
            screenies.createScreenshotAdvanced("http://localhost:" + runtime.getPort() + parsedUrl.pathname, screeniePath, 320, 'all', function (imagePath) {
                logger.info("Saved to " + imagePath);
                logger.info("Redirecting to image: " + project.toRelativePath(imagePath));
                response.writeHead(302, {
                    Location: "http://" + request.headers.host + "/" + project.toRelativePath(imagePath)
                });
                response.end();
            });
        },

        handleViewCompiledTemplateSourceCleaned: function(request, response) {

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
            var file = utils.readTextFileSync(requestedFilePath);
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
        handleViewCompiledTemplateSource: function(request, response) {
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            var file = utils.readTextFileSync(requestedFilePath);
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
        handleViewRawSourceRequest: function(request, response) {
            function createRawPageMarkup(markup) {
                var preWrapped = '<!doctype html><html><head><title>HTML Sources</title><link rel="stylesheet" href="/ps/ext/highlightjs/styles/default.css"><script src="/ps/ext/highlightjs/highlight.pack.js"></script><script>hljs.initHighlightingOnLoad();</script></head><body><div class="html"><pre><code>';
                var postWrapped = '</code></pre></div></body></html>';
                var comp = markup.toString().trim();
                comp = utils.beautifyHtml(comp);
                return preWrapped + comp + postWrapped;
            }

            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            var file = utils.readTextFileSync(requestedFilePath);
            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, createRawPageMarkup(file));
        },
        handleEditTemplateSource: function(request, response) {

            function listAceThemes(){
                var entries = runtime.listDir(runtime.findFileForUrlPathname('/ps/ext/ace-builds/src'));
                logger.info("ACE THEMES : ", entries);
                var themes = [];
                var themePrefix = 'theme-';
                entries.forEach(function(name){
                    var f = name.trim();
                    logger.debug("Processing :: ",f);
                    var ti = f.indexOf(themePrefix);
                    if(ti === 0 && f.indexOf(".js") > 0){
                        themes.push(f.substring(ti + themePrefix.length,f.length-3));
                    }
                });
                logger.info("Read "+themes.length+" theme names");
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
        handleUnknownFileType: function(request, response){
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
            var parsedUrl = url.parse(request.url, true);
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            var stat = fs.statSync(requestedFilePath);
            var fileMime = mime.lookup(requestedFilePath);
            if (fileMime && (fileMime.indexOf("text/") === 0 || fileMime.indexOf('application/json') === 0 || fileMime.indexOf('application/javascript') === 0)) {
                writeResponse(response, 200, {
                    "Content-Type": fileMime,
                    "Content-Length": stat.size
                }, runtime.readFile(requestedFilePath));
            } else {
                writeBinaryResponse(response, 200, {
                    "Content-Type": fileMime,
                    "Content-Length": stat.size
                }, utils.readBinaryFileSync(requestedFilePath));
            }
        },
        serveExistingCssFile: function (request, response) {
            var parsedUrl = url.parse(request.url, true).pathname;
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            var file = utils.readTextFileSync(requestedFilePath);
            writeResponse(response, 200, {
                "Content-Type": "text/css; charset=utf-8"
            }, file);
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
            logger.info("HANDLING EDIT DATA " + urlParts.query.path);
            var urlQuery = urlParts.query;
            var filename = runtime.findFileForUrlPathname(urlQuery.path);
            logger.info("For filename: " + filename);
            var content = "" + runtime.readFile(filename);
            var data = {
                pathname: urlQuery.path, content: content
            };
            logger.info("For filename: " + filename, data);
            writeResponse(response, 200, {
                "Content-Type": "application/json; charset=utf-8"
            }, JSON.stringify(data));
            logger.info("Wrote edit data:", data);
        }, handleImageListing: function (request, response) {

            var listImages = function (imagesDir, dirReplacement, folderName) {
                var fileNames = runtime.listDir(imagesDir);
                var imageFiles = [];
                var baseName = folderName;
                var ie = runtime.readUserConfig().imageExtensions;
                var extMap = {};
                ie.forEach(function(e){
                    extMap[e] = 1;
                });
                fileNames.forEach(function (fileName) {
                    var extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
                    if (extMap.hasOwnProperty(extension)) {
                        var imagePath = dirReplacement + "/" + fileName;
                        imageFiles.push({image: imagePath, thumb: imagePath, folder: baseName, name: fileName});
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
            dropPoints.forEach(function (dp) {
                helpContent = composer.replacePartContents(helpContent, dp, '<pre><code>' + utils.encodeHtmlEntities(dp.tag)) + '</code></pre>';
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
        }
    };
    return handlers;
}

module.exports = {
    createHandlers : createHandlers,
    writeResponse: writeResponse,
    writeBinaryResponse: writeBinaryResponse
};