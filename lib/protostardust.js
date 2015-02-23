/**
 * Copyright 2014 IBM Corp.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

"use strict";
var appName = "ProtoStar";
var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),

    mime = require('mime'),

    wrench = require("wrench"),

    templateComposer = require("./templateComposer"),
    lessCompiler = require("./lessCompiler"),
    jqueryRunner = require("./jqueryRunner"),
    projectFactory = require('./protostarProject'),
    projectCommandsFactory = require('./projectCommands'),
    utils = require("./utils"),
    builder = require("./protostarBuilder"),
    screenies = require("./screenies"),
    markdownHelper = require("./markdownHelper");

var logger = utils.createLogger({sourceFilePath : __filename});

function ProtoStarServer(args) {

    var lessCssRequestParameterPrefix="less.";


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

    var nonResourceExt = {
        '.html':1,
        '.md':1
    };

    var handleCommandRequest = function (request, response, parsedUrl) {
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
    };

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
                return '<!doctype html>\n' + $.html();//$("html")[0].outerHTML;
            }, doneF);
        }else{
            done(markup.content);
        }
    };

    this.postProcessComposed = postProcessComposed;

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

    function handleRedirectToDirectoryIndex(pathName, request, response) {
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
    }

    function handleViewCompiledTemplate(request, response, parsedUrl, requestedFilePath, file) {
        var pathName = parsedUrl.pathname;
        var ts = new Date().getTime();
        var composed = composer.composeTemplate(requestedFilePath, file);
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
    }

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

    function createRawPageMarkup(markup) {
        var preWrapped = '<!doctype html><html><head><title>HTML Sources</title><link rel="stylesheet" href="/ps/ext/highlightjs/styles/default.css"><script src="/ps/ext/highlightjs/highlight.pack.js"></script><script>hljs.initHighlightingOnLoad();</script></head><body><div class="html"><pre><code>';
        var postWrapped = '</code></pre></div></body></html>';
        var comp = markup.toString().trim();
        comp = utils.beautifyHtml(comp);
        return preWrapped + comp + postWrapped;
    }

    function listAceThemes(){
        var entries = runtime.listDir(runtime.findFileForUrlPathname('/ps/ext/ace-builds/src'));
        logger.info("ACE THEMES : ", entries);
        var themes = [];
        var themePrefix = 'theme-';
        entries.forEach(function(name){
            var f = name.trim();
            logger.info("Processing :: ",f);
            var ti = f.indexOf(themePrefix);
            if(ti === 0 && f.indexOf(".js") > 0){
                themes.push(f.substring(ti + themePrefix.length,f.length-3));
            }
        });
        logger.info("Read theme names:", themes);
        return themes;
    }

    function handleEditTemplateSource(request, response, parsedUrl, filename, file) {
        var pathName = parsedUrl.pathname;
        var editSources = "" + runtime.readFile(runtime.constructAppPath(["core", "assets", "edit.html"]));
        var crit = '___EDIT_PATH___';
        var out = utils.replaceTextFragment(editSources, crit, pathName);
        var themes = listAceThemes();
        var themesString = themes.join(',');
        out = utils.replaceTextFragment(out, '___THEMES_PLACEHOLDER___', themesString);
        writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, out);
    }

    function handleViewCompiledTemplateSource(request, response, parsedUrl, requestedFilePath, file) {
        var pathName = parsedUrl.pathname;
        var ts = new Date().getTime();
        var composed = composer.composeTemplate(requestedFilePath, file);
        postProcessComposed(composed, function (postProcessed) {
            project.updateDynamic();
            var sourceResponse = createSourcePageMarkup(postProcessed);
            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, sourceResponse);
            var te = new Date().getTime();
            var taken = te - ts;
            logger.info("Served " + pathName + " using " + requestedFilePath + " in " + taken + "ms");
        });
    }

    function handleViewCompiledTemplateSourceCleaned(request, response, parsedUrl, requestedFilePath, file) {
        var pathName = parsedUrl.pathname;
        var ts = new Date().getTime();
        var composed = composer.composeTemplate(filename, file);
        postProcessComposed(composed, function (postProcessed) {
            project.updateDynamic();
            var sourceResponse = createCleanSourcePageMarkup(postProcessed);
            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, sourceResponse);
            var te = new Date().getTime();
            var taken = te - ts;
            logger.info("Served " + pathName + " using " + filename + " in " + taken + "ms");
        });
    }

    function handleSaveInlineContentUpdate(request, response) {
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
    }

    function handleSavePartSourceUpdate(request, response) {
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
    }

    function handleEditData(request, response) {
        var urlParts = url.parse(request.url, true);
        logger.info("HANDLING EDIT DATA " + urlParts.query.path);
        var urlQuery = urlParts.query;
        var filename = runtime.findFileForUrlPathname(urlQuery.path);
        logger.info("For filename: " + filename);
        var content =  "" + runtime.readFile(filename);
        var data = {
            pathname: urlQuery.path,
            content: content
        };
        logger.info("For filename: " + filename, data);
        writeResponse(response, 200, {
            "Content-Type": "application/json; charset=utf-8"
        }, JSON.stringify(data));
        logger.info("Wrote edit data:", data);
    }

    function handleImageListing(response) {
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
    }

    this.buildPrototype = function (targetDir, callBack) {
        var projectBuilder = builder.createBuilder({
            project: project,
            runtime:runtime,
            composer: composer
        });
        projectBuilder.buildPrototype(callBack);
    };

    var isDynamicUrlPathName = function (pathName) {
        return pathName.indexOf("/ps/dynamic") === 0;
    };

    function handleLessCssRequestParameters(parsedUrl) {
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

    var isCommandRequest = function(parsedUrl){
        return parsedUrl.query.hasOwnProperty("command") && typeof parsedUrl.query.command === 'string' && parsedUrl.query.command.length > 0;
    };

    var backendViewUrls = {
        '/projectConfig':'projectConfig',
        '/pshelp' : 'help'
    };

    var isBackendViewUrl = function(request, response, parsedUrl){
        return backendViewUrls.hasOwnProperty(parsedUrl.pathname);
    };

    var isDynamicDataUrl = function(request, response, parsedUrl){
        return parsedUrl.pathname.indexOf('/ps/dynamic/') === 0;
        //return backendViewUrls.hasOwnProperty(parsedUrl.pathname);
    };

    var handleBackendViewRequest = function(request, response, parsedUrl){
        if(parsedUrl.pathname === '/projectConfig'){
            var wrapper = '<!-- wrap:/ps/backend/layout-help -->\n';
            var editConfigView = runtime.constructAppPath(["core","backend","projectConfigCompiled.html"]);
            var editConfigContent = runtime.readFile(runtime.constructAppPath(["core","assets","projectConfig.html"]));
            helpContent = wrapper + editConfigContent;
            runtime.writeFile(editConfigView, helpContent);
            var composed = composer.composeTemplate(editConfigView, helpContent);
            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
        }else if(parsedUrl.pathname === '/pshelp'){
            var mdPath = runtime.constructAppPath("README.md");
            var mdContents = markdownHelper.createTableOfContents(runtime.readFile(mdPath) + "");
            var mdMarkup = markdownHelper.compileMarkdown(mdContents);
            var wrapper = '<!-- wrap:/ps/backend/layout-help -->\n';
            var helpPath = runtime.constructAppPath(["core","backend","help.html"]);
            runtime.writeFile(helpPath, mdMarkup);
            var dropPoints = composer.findAllDropPoints(helpPath, mdMarkup, runtime.userConfig.dropPointTypes);
            dropPoints.sort(function (a, b) {
                return -1 * (a.start - b.start);
            });
            var helpContent = mdMarkup;
            dropPoints.forEach(function(dp){
                helpContent = composer.replacePartContents(helpContent, dp, '<pre><code>'+utils.encodeHtmlEntities(dp.tag))+'</code></pre>';
            });
            helpContent = wrapper + helpContent;
            runtime.writeFile(helpPath, helpContent);
            var composed = composer.composeTemplate(helpPath, helpContent);

            writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);

        }
    };

    var handleDynamicDataRequest = function(request, response, parsedUrl){
        if (parsedUrl.pathname.indexOf("/ps/dynamic/images") === 0) {
            handleImageListing(response);
        }else if(parsedUrl.pathname.indexOf("/ps/dynamic/editdata") === 0){
            handleEditData(request, response);
        }else if(parsedUrl.pathname.indexOf("/ps/dynamic/commandNames") === 0){
            var cmdNames = projectCommands.getCommandNames();
            writeResponse(response, 200, {
                'Content-Type':'application/json'
            }, JSON.stringify(cmdNames))
        }else{
            logger.info("Unknown path " + parsedUrl.pathname, parsedUrl.query);
            response.end();
        }
    };

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

    var handleCantResolveNonExistingFileRequest = function(request, response, parsedUrl, requestedFilePath){
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
    };

    var handleNonExistingFileRequest = function(request, response, parsedUrl, requestedFilePath){
        var lessInfo = findLessInfo(requestedFilePath);
        if(lessInfo){
            if(lessInfo.outputFormat === 'cssmap'){
                sslc.handleCompileLessCssMap(lessInfo.lessFilePath, runtime.readFile(lessInfo.lessFilePath), response);
            }else{
                sslc.handleCompileLessCss(lessInfo.lessFilePath, runtime.readFile(lessInfo.lessFilePath), response);
            }
        }else{
            handleCantResolveNonExistingFileRequest(request, response, parsedUrl, requestedFilePath);
        }
    };

    function handleViewRawSourceRequest(request, response, parsedUrl, requestedFilePath, file) {
        writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, createRawPageMarkup("" + file));
    }

    function handleShowScreenshot(request, response, parsedUrl, requestedFilePath, file) {
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
    }

    function handleViewCompiledMarkdownRequest(request, response, parsedUrl, requestedFilePath, file) {
        writeResponse(response, 200, {
            "Content-Type": "text/html; charset=utf-8"
        }, markdownHelper.compileMarkdown(runtime.readFile(runtime.findFileForUrlPathname(parsedUrl.pathname))));
    }

    function isTemplateCompilationEnabledForActiveProject() {
        var projectConfig = runtime.readProjectConfig();
        var compilationEnabled = true;
        if (utils.nestedPathExists(projectConfig, "compilation", "enabled") && utils.hasPropertyOfType(projectConfig.compilation, "enabled", "Boolean")) {
            compilationEnabled = projectConfig.compilation.enabled;
        }
        return compilationEnabled;
    }

    var handleExistingFileRequest = function(request, response, parsedUrl, requestedFilePath){
        fs.stat(requestedFilePath, function (err, stat) {
            if (err) {
                logger.error("Could not stat requested path " + requestedFilePath, err);
                console.trace(err);
                response.writeHead(500, {});
                response.end();
                return;
            }
            if (stat.isDirectory()) {
                logger.info("Deemed dir for redirect: pathName=" + parsedUrl.pathname + " filename=" + requestedFilePath);
                handleRedirectToDirectoryIndex(parsedUrl.pathname, request, response);
                return;
            }
            if (stat.isFile()) {
                fs.readFile(requestedFilePath, function (err, file) {
                    if(err){
                        console.error("Error while reading file " + requestedFilePath, err);
                        console.trace(err);
                        response.writeHead(500);
                        response.end();
                        return;
                    }
                    if (utils.endsWith(parsedUrl.pathname, '.less')){
                        if(parsedUrl.query.hasOwnProperty("compile")){
                            sslc.handleCompileLessCss(requestedFilePath, file, response);
                        }else{
                            writeResponse(response, 200, {
                                "Content-Type": "text/css; charset=utf-8"
                            }, file);
                        }
                        return;
                    }
                    if(!nonResourceExt.hasOwnProperty(path.extname(requestedFilePath))){
                        var fileMime = mime.lookup(requestedFilePath);
                        if(fileMime && (fileMime.indexOf("text/") === 0 || fileMime.indexOf('application/json')===0 || fileMime.indexOf('application/javascript')===0)){
                            writeResponse(response, 200, {
                                "Content-Type": fileMime
                            }, file);

                        }else{
                            writeBinaryResponse(response, 200, {
                                "Content-Type": fileMime
                            }, file);
                        }
                        return;
                    }

                    if(parsedUrl.query.hasOwnProperty("edit")){
                        handleEditTemplateSource(request, response, parsedUrl, requestedFilePath, file);
                    }else if (parsedUrl.query.hasOwnProperty("raw")) {
                        handleViewRawSourceRequest(request, response, parsedUrl, requestedFilePath, file);
                    } else if (parsedUrl.query.hasOwnProperty("source")) {
                        handleViewCompiledTemplateSource(request, response, parsedUrl, requestedFilePath, file);
                    } else if (parsedUrl.query.hasOwnProperty("sourceClean")) {
                        handleViewCompiledTemplateSourceCleaned(request, response, parsedUrl, requestedFilePath, file);
                    } else if (parsedUrl.query.hasOwnProperty("cheese")) {
                        handleShowScreenshot(request, response, parsedUrl, requestedFilePath, file);
                    } else if(parsedUrl.pathname.length >= 5 && (parsedUrl.pathname.toLowerCase().indexOf(".md") === parsedUrl.pathname.length-3)){
                        handleViewCompiledMarkdownRequest(request, response, parsedUrl, requestedFilePath, file);
                    }else{
                        if (isTemplateCompilationEnabledForActiveProject()) {
                            handleViewCompiledTemplate(request, response, parsedUrl, requestedFilePath, file);
                        } else {
                            writeResponse(response, 200, {
                                "Content-Type": mime.lookup(requestedFilePath)
                            }, file);
                        }
                    }

                });
            } else {
                logger.error("Unknown file type while resolving " + parsedUrl.pathname + " : " + requestedFilePath);
                //handleUnknownFiletype(response, filename);
                var responseHeaders = {"Content-Type": "text/plain; charset=utf-8"};
                var statusCode = 500;
                var responseContent = "500 Unknown filetype  : " + requestedFilePath + "\n";
                writeResponse(response, statusCode, responseHeaders, responseContent);
            }


        });
    };

    var requestHandleGET = function (request, response) {
        var parsedUrl = url.parse(request.url, true);
        if (isCommandRequest(parsedUrl)) {
            handleCommandRequest(request, response, parsedUrl);
        } else if(isBackendViewUrl(request, response, parsedUrl)){
            handleBackendViewRequest(request, response, parsedUrl);
        } else if(isDynamicDataUrl(request, response, parsedUrl)){
            handleDynamicDataRequest(request, response, parsedUrl);
        } else {
            var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
            fs.exists(requestedFilePath, function (exists) {
                if (!exists) {
                    handleNonExistingFileRequest(request, response, parsedUrl, requestedFilePath);
                } else {
                    handleLessCssRequestParameters(parsedUrl);
                    handleExistingFileRequest(request, response, parsedUrl, requestedFilePath);
                }
            });
        }

    };
    var requestHandlePOST = function (request, response) {
        logger.warn("Unhandled request method: " + request.method + " " + request.url);
        response.end();
    };
    var requestHandlePUT = function (request, response) {
        var urlParts = url.parse(request.url, true);
        if (urlParts.pathname.indexOf("/ps/update/partsource") === 0) {
            handleSavePartSourceUpdate(request, response);
        }else if (urlParts.pathname.indexOf("/ps/update/part") === 0) {
            handleSaveInlineContentUpdate(request, response);
        } else {
            logger.warn("Ignoring unknown PUT request: ", urlParts);
            response.end();
        }
    };
    var requestHandleDELETE = function (request, response) {
        logger.warn("Unhandled request method: " + request.method + " " + request.url);
        response.end();
    };
    var requestHandleHEAD = function (request, response) {
        logger.warn("HEAD request method: " + request.method + " " + request.url);
        var urlParts = url.parse(request.url, true);
        var urlPathName = urlParts.pathname;
        var urlQuery = urlParts.query;
        if (!urlQuery.hasOwnProperty("command") && urlPathName !== '/pshelp') {
            if (!isDynamicUrlPathName(urlPathName)) {
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
                            response.writeHead(404, {Server:"protostar"});
                            response.end();
                        }
                    } else {
                        fs.stat(filename, function (err, stat) {
                            if (err) {
                                logger.error("STAT ERROR", err);
                                console.trace(err);
                                response.writeHead(404, {Server:"protostar"});
                                response.end();
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
                                    response.writeHead(404, {Server:"protostar"});
                                    response.end();
                                }
                            }
                        });
                    }
                });
            }
        } else {
            console.error("head not supported for command reqs");
            response.writeHead(404, {
                "Server": "protostar"
            });
            response.end();
        }
    };

    var requestHandler = function (request, response) {
        switch (request.method) {
            case 'GET':
                requestHandleGET(request, response);
                break;
            case 'POST':
                requestHandlePOST(request, response);
                break;
            case 'PUT':
                requestHandlePUT(request, response);
                break;
            case 'DELETE':
                requestHandleDELETE(request, response);
                break;
            case 'HEAD':
                requestHandleHEAD(request, response);
                break;
            default:
                var errorMsg = "Unhandled request method: " + request.method + " " + request.url;
                logger.error(errorMsg);
                response.writeHead(404, {
                    Accept: "text/plain"
                });
                response.write(errorMsg);
                response.end();
                break;
        }
    };

    function startServer() {
        try {
            server.listen(runtime.getPort());
        } catch (ServerLaunchError) {
            logger.error("Could not launch due to error, maybe port " + runtime.getPort() + " is in use?");
            console.trace(ServerLaunchError);
        }
        server.on("listening", function () {
            startedListening = true;
        });
        logger.info("Server listening on http://localhost:" + runtime.getPort() + "/");
    }

    function createServer() {
        if (typeof server === 'object') {
            destroyServer();
        }
        composer = templateComposer.createTemplateComposer({
            runtime: runtime
        });
        project = projectFactory.createProject({
            composer: composer,
            runtime: runtime
        });
        projectCommands = projectCommandsFactory.createProjectCommandHandler({
            project: project,
            runtime: runtime,
            composer: composer
        });
        server = http.createServer(requestHandler);
        sslc = lessCompiler.createServerSideLessCompiler(runtime.constructProjectPath(""), function(){return project.lessParserAdditionalArgs;});
    }

    function destroyServer() {
        if (typeof server === 'object') {
            if (startedListening) {
                server.close();
            }
            server = undefined;
            composer = undefined;
            startedListening = false;
            projectCommands = undefined;
            logger.info("Server closed");
        }
    }

    this.stop = function () {
        destroyServer();
    };
    this.start = function () {
        logger.info("Starting Protostar v0.9.1");
        createServer();
        startServer();
        var options = {
            host: (process.env.VCAP_APP_HOST || 'localhost'),
            port: (process.env.VCAP_APP_PORT || 8888),
            path: '/index.html'
        };

        var callback = function(response) {
            var str = '';
            response.on('data', function (chunk) {
                str += chunk;
            });
            response.on('end', function () {
                if(runtime.isDebug()){
                    logger.info(str);
                }
            });
        };
        http.request(options, callback).end();
    };

    this.createProject = function(){
        var newProjPath = runtime.projectDirPath;
        if(runtime.isExistingDirPath(newProjPath)){
            throw new Error("Cannot create new project at existing path: " + newProjPath);
        }
        var templatepath = runtime.constructAppPath(['core', 'templates', 'project', runtime.projectTemplate]);
        logger.info('Copying ' + templatepath + ' to ' + newProjPath);
        wrench.copyDirSyncRecursive(templatepath, newProjPath);
        logger.info("Created new project based on the '" + runtime.projectTemplate + "' at directory path " + newProjPath);
    };

    var runtime,
        project,
        server,
        composer,
        projectCommands,
        startedListening = false, sslc;

    runtime = args.runtime;
    createServer();
}

module.exports = {
    createServer: function (config) {
        return new ProtoStarServer(config);
    }
};