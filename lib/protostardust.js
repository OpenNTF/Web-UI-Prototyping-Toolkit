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
    connect = require('connect'),
    q = require("q"),
    wrench = require("wrench"),
    marked = require('marked'),

    templateComposer = require("./templateComposer"),
    lessCompiler = require("./lessCompiler"),
    jqueryRunner = require("./jqueryRunner"),
    projectFactory = require('./protostarProject'),
    projectCommandsFactory = require('./projectCommands'),
    utils = require("./utils"),
    builder = require("./protostarBuilder"),
    screenies = require("./screenies");

var logger = utils.createLogger({sourceFilePath : __filename});



function ProtoStarServer(args) {

    var parseArgs = function (args) {
        runtime = args.runtime;
        logger.info("Parsed args");
    };

    var writeBinaryResponse = function (response, status, headers, content) {
        response.writeHead(status, headers);
        response.write(content, "binary");
        response.end();
    };

    var writeResponse = function (response, status, headers, content) {
        response.writeHead(status, headers);
        response.write(content);
        response.end();
    };

    var handleFileDoesntExist = function (request, response, filename) {
        var urlParts = url.parse(request.url, true);
        var urlPathName = urlParts.pathname;
        var responseHeaders = {"Content-Type": "text/html"};
        var statusCode = 404;
        if(urlPathName.indexOf(".html") >0){
            var responseContent = "<div><p>404 Not Found : nothing here yet</p><h1>Would you like to create " + filename + "?</h1></div>\n";
            var templatePaths = project.listAllTemplatePaths();
            responseContent += "<ul>";
            templatePaths.forEach(function (tp) {
                var name = runtime.createTemplateReferenceFromFullPath(tp);
                responseContent += '<li><a href="' + url.parse(request.url).pathname + '?command=create&templatePath=' + name + '">Copy ' + name + '</a></li>';
            });
            responseContent += "</ul></div>";
            writeResponse(response, statusCode, responseHeaders, responseContent + project.readViewScriptsMarkup());
        }else{
            writeResponse(response, statusCode, responseHeaders, "<div><p>404 Nothing here for "+urlPathName+"</p></div>\n" + project.readViewScriptsMarkup());
        }

    };
    var handleUnknownFiletype = function (response, filename) {
        var responseHeaders = {"Content-Type": "text/plain"};
        var statusCode = 404;
        var responseContent = "404 Not Found : illegal filetype  : " + filename + "\n";
        writeResponse(response, statusCode, responseHeaders, responseContent);
    };

    var nonResourceExt = {
        '.html':1,
        '.md':1
    };

    var isResourceUri = function (uri) {

        return uri.length < 4 || !nonResourceExt.hasOwnProperty(path.extname(uri));
    };

    var sortString = function (a, b) {
        if (a < b) {
            return -1;
        } else if (a > b) {
            return 1;
        } else {
            return 0;
        }
    };
    var sortPathNames = function (paths) {
        paths.sort(function (a, b) {
            var ps = sortString(a.path, b.path);
            if (ps === 0) {
                ps = sortString(a.name, b.name);
            }
            return ps;
        });
    };

    var writeCommandResponse = function (command, responseData, response) {
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

    var handleCommandRequest = function (command, request, response) {
        logger.info("Running command " + command);
        var responseData = projectCommands.handleCommandRequest(command, request, response);
        writeCommandResponse(command, responseData, response);
    };

    var postProcessComposed = function (markup, done) {
        if(markup.content.trim().length > 0){
            var doneF = function (result, errors, window) {
                var args = {};
                if (window && typeof window.args === 'object') {
                    args = window.args;
                }
                done(result, errors, args);
            };
            console.log("Running postProcessComposed for : ", markup);
            jqueryRunner.runJQuery(markup.content, function ($) {

                var metadata = markup.metadata;

                function validateBootstrapGrid($){
                    var gridVariants = ['xs','sm','md','lg'];

                    $(".row").each(function(){
                        var containerFound = false;
                        $(this).parents().each(function(){
                            if(!containerFound && $(this).hasClass("container") || $(this).hasClass("container-fluid")){
                                containerFound = true;
                            }
                        });
                        if(!containerFound){
                            var parentEls = $(this).parents()
                                .map(function() {
                                    return this.tagName;
                                })
                                .get()
                                .join( " " );
                            logger.error("bootstrap .row without .container or .container-fluid as parent! Location: " + parentEls);
                        }
                    });
                    gridVariants.forEach(function(gv){
                        for(var x = 1; x <= 12 ; x+=1){
                            var selector = '.col-'+gv+'-'+x;
                            $(selector).each(function(){
                                var rowFound = false;
                                $(this).parents().each(function(){
                                    if(!rowFound && $(this).hasClass("row")){
                                        rowFound = true;
                                    }
                                });
                                if(!rowFound){
                                    var parentEls = $(this).parents()
                                        .map(function() {
                                            return this.tagName;
                                        })
                                        .get()
                                        .join( " " );
                                    logger.error("bootstrap "+selector+" without .row as parent! Location: " + parentEls);
                                }
                            });
                        }
                    });
                }
                validateBootstrapGrid($);
                jqueryRunner.assignUniqueIdsToEditables($, metadata);
                jqueryRunner.processProtostarAttributes($, function(attrName, attrVal){
                    return runtime.determineProtostarAttributeValue(attrName, attrVal);
                });
                jqueryRunner.insertPlaceholderResources($, metadata);
                jqueryRunner.ensureViewScriptsPresent($);
                return '<!doctype html>\n' + $("html")[0].outerHTML;
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
        var storeFileContentUpdate = function ($, window) {
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
        var done = function (result, errors, window) {

        };
        jqueryRunner.runJQuery(partContents, storeFileContentUpdate, done);
    };

    var saveSourceUpdateToFile = function (updateRequest, request, response) {
        var ur = updateRequest;
        logger.info("updating part source for " + ur.pathname);
        var pathName = runtime.findFileForUrlPathname(ur.pathname);//project.readFile(ur.partname + ".html");
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
        sortPathNames(imageFiles);
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

    var lessFilePathsBeingCompiled = {};

    var nextCallIdx = 1;

    function CssWriter(idx, filename, response, mode){
        this.mode = 'css';
        if(typeof mode === 'string'){
            this.mode = mode;
        };
        this.idx = idx;
        this.filename = filename;
        this.response = response;
        this.done = false;
        this.css = undefined;
        this.cssMap = undefined;
        this.dependencies = undefined;
        this.acceptCss = function(css, cssmap, deps){
            this.css = css;
            this.cssMap = cssmap;
            this.dependencies = deps;
            this.done = true;
        };
        this.writeCss = function(){
            if(this.mode === 'css'){
                this.response.writeHead(200, {"Content-Type": "text/css"});
                this.response.write("" + this.css);
                this.response.end();
            }else if(this.mode === 'cssmap'){
                this.writeCssMap();
            }else if(this.mode === 'deps'){
                this.writeDependencies();
            }

        };
        this.writeCssMap = function(){
            this.response.writeHead(200, {"Content-Type": "text/css"});
            this.response.write("" + this.cssMap);
            this.response.end();
        };
        this.writeDependencies= function(){
            this.response.writeHead(200, {"Content-Type": "application/json"});
            this.response.write(JSON.stringify(this.dependencies));
            this.response.end();
        };
    }


    function handleCompileLessCss(filename, file, response) {
        var callIdx = nextCallIdx;
        nextCallIdx +=1;


        var finishedCompilingCss = function (css, sourceMap, deps) {
            var callbacks = lessFilePathsBeingCompiled[filename];
            delete lessFilePathsBeingCompiled[filename];
            var cbc = callbacks.length;
            while(callbacks.length > 0){
                var cb = callbacks[0];
                callbacks.splice(0,1);
                cb.acceptCss(css, sourceMap, deps);
                cb.writeCss();
            }
            logger.info("Served " + cbc + " requests for " + filename);
        };
        if(lessFilePathsBeingCompiled.hasOwnProperty(filename)){
            var callbacks = lessFilePathsBeingCompiled[filename];
            callbacks.push(new CssWriter(callIdx, filename, response, 'css'));
        }else{
            lessFilePathsBeingCompiled[filename] = [];
            lessFilePathsBeingCompiled[filename].push(new CssWriter(callIdx, filename, response, 'css'));

            lessCompiler.compile(filename, [path.join(filename, "../")], '' + file, runtime.constructProjectPath(""), finishedCompilingCss, undefined, project.lessParserAdditionalArgs);
        }
    }

    function handleCompileLessCssMap(filename, file, response) {
        var callIdx = nextCallIdx;
        nextCallIdx +=1;

        var finishedCompilingCssMap = function (css, sourceMap, deps) {
            var callbacks = lessFilePathsBeingCompiled[filename];
            delete lessFilePathsBeingCompiled[filename];
            var cbc = callbacks.length;
            while(callbacks.length > 0){
                var cb = callbacks[0];
                callbacks.splice(0,1);
                cb.acceptCss(css, sourceMap, deps);
                cb.writeCss();
            }
            logger.info("Served " + cbc + " requests for " + filename);
        };
        if(lessFilePathsBeingCompiled.hasOwnProperty(filename)){
            var callbacks = lessFilePathsBeingCompiled[filename];
            callbacks.push(new CssWriter(callIdx, filename, response, 'cssmap'));
        }else{
            lessFilePathsBeingCompiled[filename] = [];
            lessFilePathsBeingCompiled[filename].push(new CssWriter(callIdx, filename, response, 'cssmap'));
            lessCompiler.compile(filename, [path.join(filename, "../")], '' + file, runtime.constructProjectPath(""), finishedCompilingCssMap);
        }
    }



    function handleComposeTemplate(pathName, filename, file, response) {
        var ts = new Date().getTime();
        var composed = composer.composeTemplate(filename, file);
        postProcessComposed(composed, function (postProcessed) {
            project.updateDynamic();
            var pc = postProcessed.toString();
            writeResponse(response, 200, {"Content-Type": "text/html"}, pc);
            var te = new Date().getTime();
            var taken = te - ts;
            logger.info("Served " + pathName + " using " + filename + " in " + taken + "ms");
            if (runtime.readUserConfig().writeResponsesToFiles) {
                var responseFileName = filename.substring(0, filename.length - 5) + "-compiled.html";
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
        comp = utils.quoteRegexpLiteral(comp);
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


    function replaceTextFragment(content, fragment, replacement, startIdx){
        var start = 0;
        if(typeof startIdx === 'number'){
            start = startIdx;
        }
        var crit = fragment;
        var idx = content.indexOf(crit, start);
        var preEdit = content.substring(0, idx);
        var postEdit = content.substring(idx+crit.length);
        return preEdit + replacement + postEdit;
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

    function handleEditTemplateSource(pathName, filename, file, response) {
        var editSources = "" + runtime.readFile(runtime.constructAppPath(["core", "assets", "edit.html"]));
        var crit = '___EDIT_PATH___';
        var out = replaceTextFragment(editSources, crit, pathName);
        var themes = listAceThemes();
        var themesString = themes.join(',');
        out = replaceTextFragment(out, '___THEMES_PLACEHOLDER___', themesString);
        writeResponse(response, 200, {"Content-Type": "text/html"}, out);
    }


    function handleComposeTemplateSource(pathName, filename, file, response) {
        var ts = new Date().getTime();
        var composed = composer.composeTemplate(filename, file);
        postProcessComposed(composed, function (postProcessed) {
            project.updateDynamic();
            var sourceResponse = createSourcePageMarkup(postProcessed);
            writeResponse(response, 200, {"Content-Type": "text/html"}, sourceResponse);
            var te = new Date().getTime();
            var taken = te - ts;
            logger.info("Served " + pathName + " using " + filename + " in " + taken + "ms");
        });
    }

    function handleComposeTemplateSourceClean(pathName, filename, file, response) {
        var ts = new Date().getTime();
        var composed = composer.composeTemplate(filename, file);
        postProcessComposed(composed, function (postProcessed) {
            project.updateDynamic();
            var sourceResponse = createCleanSourcePageMarkup(postProcessed);
            writeResponse(response, 200, {"Content-Type": "text/html"}, sourceResponse);
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
            writeResponse(response, 200, {"Content-Type": "application/json"}, '{"status":"ok"}');
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
                writeResponse(response, 200, {"Content-Type": "application/json"}, '{"status":"ok"}');
            }else{
                writeResponse(response, 406, {"Content-Type": "application/json"}, '{"status":"fail"}');
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
            "Content-Type": "application/json"
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
            "Content-Type": "application/json"
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

    var createMarkDownTableOfContents = function(markdown){
        var FOUR_SPACES = "    ";
        var leftIndents = [""];
        for(var i = 1; i < 10; i++) {
            leftIndents.push(leftIndents[i-1] + FOUR_SPACES);
        }
        function processData(data) {
            var lines = data.split('\n');
            var titles = [];
            var depths = [];
            var minDepth = 1000000;
            for(var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var m = line.match(/^\s*(#+)(.*)$/);
                if (!m) continue;
                minDepth = Math.min(minDepth, m[1].length);
                depths.push(m[1].length);
                titles.push(m[2]);
            }
            for(var i = 0; i < depths.length; i++) {
                depths[i] -= minDepth;
            }
            var toc = createTOC(depths, titles).join('\n');
            var tocRegexp = /^\s*@@TOC@@\s*$/;
            for(var i = 0; i <lines.length; i++) {
                var line = lines[i];
                if (tocRegexp.test(line)) {
                    lines[i] = toc;
                }
            }
            return lines.join('\n');
        }

        function createTOC(depths, titles) {
            var ans = [];
            for(var i = 0; i < depths.length; i++) {
                ans.push(tocLine(depths[i], titles[i]));
            }
            return ans;
        }

        function titleToUrl(title) {
            return title.trim().toLowerCase().replace(/\s/g, '-').replace(/[^-0-9a-z]/g, '');
        }

        function tocLine(depth, title) {
            return leftIndents[depth] + "- [" + title.trim() + "](#" + titleToUrl(title) + ")";
        }
        return processData(markdown);
    };

    var requestHandleGET = function (request, response) {
        var urlParts = url.parse(request.url, true);
        var urlPathName = urlParts.pathname;
        var urlQuery = urlParts.query;
        var lessVars = {};
        var lessVarCount = 0;
        for(var varname in urlQuery){
            if(urlQuery.hasOwnProperty(varname) && varname.indexOf('less.')=== 0){
                lessVarCount+=1;
                lessVars[varname.substring(5)] = urlQuery[varname];
            }
        }
        if(lessVarCount > 0){
            project.lessParserAdditionalArgs.globalVars = lessVars;
            project.lessParserAdditionalArgs.modifyVars= lessVars;
        }

        if (urlQuery.hasOwnProperty("command")) {
            var command = urlQuery.command;
            handleCommandRequest(command, request, response);
        } else {
            if(urlPathName === '/pshelp'){
                var mdPath = runtime.constructAppPath("README.md");
                var mdContents = createMarkDownTableOfContents(runtime.readFile(mdPath) + "");
                var mdMarkup = marked(mdContents);
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

                writeResponse(response, 200, {"Content-Type": "text/html"}, composed.content);

            }else if (isDynamicUrlPathName(urlPathName)) {
                if (urlPathName.indexOf("/ps/dynamic/images") === 0) {
                    handleImageListing(response);
                }else if(urlPathName.indexOf("/ps/dynamic/editdata") === 0){
                    handleEditData(request, response);
                }else if(urlPathName.indexOf("/ps/dynamic/commandNames") === 0){
                    var cmdNames = projectCommands.getCommandNames();
                    writeResponse(response, 200, {
                        'Content-Type':'application/json'
                    }, JSON.stringify(cmdNames))
                }else{
                    logger.info("Unknown path " + urlPathName, urlQuery);
                    response.end();
                }
            } else {
                var filename = runtime.findFileForUrlPathname(urlPathName);
                fs.exists(filename, function (exists) {
                    if (!exists) {
                        var cssMapSuffix = '.css.map';
                        var cssSuffix = '.css';
                        var endsWith = function(str, postfix){
                            return str.length >= postfix.length && str.substring(str.length-postfix.length) === postfix;
                        };
                        var lessPath = false;
                        var map = false;
                        if(endsWith(filename, cssMapSuffix)){
                            lessPath = filename.substring(0, filename.length - cssMapSuffix.length) + ".less";
                            map = true;
                        }else if (endsWith(filename, cssSuffix)){
                            lessPath = filename.substring(0, filename.length - cssSuffix.length) + ".less";
                        }
                        var handledAsLess = false;
                        if(lessPath){
                            if(runtime.isExistingFilePath(lessPath)){
                                if(map){
                                    handleCompileLessCssMap(lessPath, runtime.readFile(lessPath), response);
                                }else{
                                    handleCompileLessCss(lessPath, runtime.readFile(lessPath), response);
                                }
                                handledAsLess = true;
                            }
                        }
                        if(!handledAsLess){
                            logger.error("Non existing path while resolving " + urlPathName + " : " + filename);

                            handleFileDoesntExist(request, response, filename);
                        }
                    } else {
                        fs.stat(filename, function (err, stat) {
                            if (err) {
                                logger.error("STAT ERROR", err);
                                console.trace(err);
                            } else {
                                if (stat.isDirectory()) {
                                    logger.info("Deemed dir for redirect: pathName=" + urlPathName + " filename=" + filename);
                                    handleRedirectToDirectoryIndex(urlPathName, request, response);
                                } else if (stat.isFile()) {
                                    fs.readFile(filename, undefined, function (err, file) {
                                        if (isResourceUri(urlPathName)) {
                                            if (urlPathName.lastIndexOf(".less") > 0 && urlQuery.hasOwnProperty("compile")) {
                                                handleCompileLessCss(filename, file, response);
                                            } else {
                                                writeBinaryResponse(response, 200, {
                                                    "Content-Type": mime.lookup(filename)
                                                }, file);
                                            }
                                        } else {
                                            if(urlQuery.hasOwnProperty("edit")){
                                                handleEditTemplateSource(urlPathName, filename, file, response);
                                            }else if (urlQuery.hasOwnProperty("raw")) {
                                                writeResponse(response, 200, {"Content-Type": "text/html"}, createRawPageMarkup("" + file));
                                            } else if (urlQuery.hasOwnProperty("source")) {
                                                handleComposeTemplateSource(urlPathName, filename, file, response);
                                            } else if (urlQuery.hasOwnProperty("sourceClean")) {
                                                handleComposeTemplateSourceClean(urlPathName, filename, file, response);
                                            } else if (urlQuery.hasOwnProperty("cheese")) {
                                                var imageFilename = "screenshot_" + new Date().getTime() + "." + runtime.readUserConfig().runtime.screenshots.streamType;
                                                var screeniePath = project.resolveProjectFile("screenshots/" + imageFilename);
                                                utils.ensureParentDirExists(screeniePath);
                                                screenies.createScreenshotAdvanced("http://localhost:" + runtime.getPort() + urlPathName, screeniePath, 320, 'all', function (imagePath) {
                                                    logger.info("Saved to " + imagePath);
                                                    logger.info("Redirecting to image: " + project.toRelativePath(imagePath));
                                                    response.writeHead(302, {
                                                        Location: "http://" + request.headers.host + "/" + project.toRelativePath(imagePath)
                                                    });
                                                    response.end();
                                                });
                                            } else if(urlPathName.length >= 5 && (urlPathName.toLowerCase().indexOf(".md") === urlPathName.length-3)){
                                                writeResponse(response, 200, {
                                                    "Content-Type": "text/html"
                                                },marked(runtime.readFile(runtime.findFileForUrlPathname(urlPathName))));
                                            }else{
                                                var projectConfig = runtime.readProjectConfig();
                                                var compilationEnabled = true;
                                                if(utils.nestedPathExists(projectConfig, "compilation", "enabled") && utils.hasPropertyOfType(projectConfig.compilation, "enabled", "Boolean")){
                                                    compilationEnabled = projectConfig.compilation.enabled;
                                                }
                                                var angularMode = !compilationEnabled;
                                                if(angularMode){
                                                    writeResponse(response, 200, {}, file);
                                                }else{
                                                    handleComposeTemplate(urlPathName, filename, file, response);
                                                }
                                            }
                                        }
                                    });
                                } else {
                                    logger.error("Unknown file type while resolving " + urlPathName + " : " + filename);
                                    handleUnknownFiletype(response, filename);
                                }
                            }
                        });
                    }
                })
            }
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
                                    "Content-Type": "text/css", "Server": "protostar"
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
        console.log("Processing method: " + request.method);
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
                logger.warn("Unhandled request method: " + request.method + " " + request.url);
                response.writeHead(404, {});
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
        startedListening = false;

    parseArgs(args);
    createServer();
}

module.exports = {
    createServer: function (config) {
        return new ProtoStarServer(config);
    }
};