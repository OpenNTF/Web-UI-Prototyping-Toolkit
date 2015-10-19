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
var deferred = require("deferred");
var htmlProducerFactory = require("./htmlProducer");
var url = require("url");
var path = require("path");
var fs = require("./filesystem");
var screenies = require("./screenies");
var utils = require("./utils");
var w3c = require('w3c-validate').createValidator();
var http = require('http');
var jadeUtils = require("./jadeUtils");
var protostarBuilder = require("./protostarBuilder");
var logger = utils.createLogger({sourceFilePath : __filename});
var portalNavGen = require("./portalNavigationProducer");
var lessCompiler = require("./lessCompiler");
var copier = require("./copier");
var portletThemeMerger = require("./portalThemeMerger");
var Promise = require("bluebird");

function ProjectCommands(args) {
    /**
     * @type {templateComposer.TemplateComposer}
     */
    var composer;
    /**
     * @type {Project}
     */
    var project;
    /**
     * @type {ProtostarRuntime}
     */
    var runtime;
    /**
     *
     * @type {boolean}
     */
    var runningScreenshotsGen = false;
    /**
     *
     * @type {boolean}
     */
    var runningValidation = false;

    var createHtmlProducer = function () {
        return htmlProducerFactory.createHtmlProducer({
            runtime:runtime
        });
    };

    var commandFactory = {
        "list-all": function (request, response, project) {
            var files = project.listAllTemplatePaths();
            var hp = createHtmlProducer();
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            composer.renderBackendView(request, response, out, 'cmdListAll.html');
            response.end();
        },
        "list-compiled": function (request, response, project) {
            var files = project.listCompiledTemplatePaths();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            composer.renderBackendView(request, response, out, 'cmdListCompiled.html');
            response.end();
        },
        "download-build-zip": function(request, response, project){
            var ts = new Date().getTime();
            var dirName = path.basename(runtime.constructProjectPath(".")) + "_build_"+ts;
            var targetDir = "/tmp/" + dirName;
            var builder = protostarBuilder.createBuilder({
                runtime : runtime,
                project : project,
                composer :composer,
                targetDir : targetDir,
                ignoreExcludeFromBuild : false //args.ignoreExcludeFromBuild || false
            });
            builder.createZipBuild(function(zip, targetDir, dirName){
                var buffer = zip.toBuffer();
                response.writeHead(200, {
                    'Expires': 0,
                    'Cache-Control': 'must-revalidate, post-check=0, pre-check=0',
                    'Content-Description': 'File Transfer',
                    'Content-type': 'application/octet-stream',
                    'Content-Disposition': 'attachment; filename=\"' + dirName+'.zip\"',
                    'Content-Transfer-Encoding': 'binary',
                    "Content-Length": buffer.length
                });
                response.write(buffer, "binary");
                response.end();
                copier.deleteRecursively(targetDir);
                //wrench.rmdirSyncRecursive(targetDir);
            });
        },
        "generate-compiled-nav": function (request, response, project) {
            var files = project.listCompiledTemplatePaths();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createBareListingEntriesMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8"
                },
                content: out
            };
        },
        "list-referencing": function (request, response, project) {
            var files = project.listPathsWithReferences();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            composer.renderBackendView(request, response, out, 'cmdListReferencing.html');
            response.end();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8"
                },
                content: out
            };
        },
        "list-referencing-bare": function (request, response, project) {
            var files = project.listPathsWithReferences();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createBareListingEntriesMarkup(files) + project.readViewScriptsMarkup();
            return {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8"
                },
                content: out
            };
        },
        "portal-angular-theme-navigation": function (request, response, project) {
            var nav = portalNavGen.generateNavigation(project);
            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                content: JSON.stringify(nav)
            };
        },

        "list-referenced": function (request, response, project) {
            var files = project.listAllReferencedPaths();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            composer.renderBackendView(request, response, out, 'cmdListReferenced.html');
            response.end();
        },
        "list": function (request, response, project) {
            var files = project.listProjectTemplatePaths();
            files.sort();
            var hp = createHtmlProducer(project);
            var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
            composer.renderBackendView(request, response, out, 'cmdList.html');
            response.end();
        },
        "compile_all": function (request, response, project) {
            var projectDir = runtime.constructProjectPath("");
            var files = project.listAllTemplatePaths();
            function shortenPath(p){
                return p.substring(projectDir.length+1);
            }
            function sortObjectKeys(obj){
                var keys = Object.keys(obj).sort();
                var o = {};
                keys.forEach(function(k){
                    o[k] = obj[k];
                    console.log("Adding KEY="+k);
                });
                return o;
            }
            files.forEach(function (filePath) {
                var fileContents = runtime.readFile(filePath);
                var fileName = path.basename(filePath);

                try{
                    var composed = composer.composeTemplate(filePath, fileContents);
                    var baseFilePath = path.dirname(filePath) + "/" + fileName.substring(0, fileName.lastIndexOf('.'));
                    var responsePath = baseFilePath + '-compiled.html';
                    runtime.writeFile(responsePath, composed.content);

                    composed.metadata.include.headScript.sort();
                    composed.metadata.include.script.sort();
                    composed.metadata.include.style.sort();
                    var oldDeps = composed.metadata.deps;
                    composed.metadata.deps = {};
                    composed.metadata.deps = sortObjectKeys(oldDeps);
                    var meta = {
                        templatePath : shortenPath(composed.metadata.templatePath),
                        headScripts: ([].concat(composed.metadata.include.headScript)).map(shortenPath).sort(),
                        styles: ([].concat(composed.metadata.include.headScript)).map(shortenPath).sort(),
                        scripts: ([].concat(composed.metadata.include.headScript)).map(shortenPath).sort(),
                        dependencies: Object.keys(composed.metadata.deps).map(shortenPath).sort()
                    };
                    var metaDataJson = JSON.stringify(meta, null, '\t');
                    runtime.writeFile(baseFilePath+"-meta.json", metaDataJson);
                    logger.info("Wrote compiled version to " + responsePath);
                }catch(CompilationError){
                    logger.error("Could not compile " + fileName + " with contents: " + fileContents, CompilationError.stack);
                    //console.trace(CompilationError);
                    logger.warn("Skipping " + fileName + " from back compilation.");
                }
            });
            var hp = createHtmlProducer(project);
            var out = hp.createCompiledMarkup(files) + project.readViewScriptsMarkup();
            composer.renderBackendView(request, response, out, 'cmdCompileAll.html');
            response.end();
            project.updateDynamic();
            //return {
            //    status: 200,
            //    headers: {
            //        "Content-Type": "text/html; charset=utf-8"
            //    },
            //    content: out
            //};
        },
        "delete_compiled_jade" : function(request, response, project){
            var jtp = project.listProjectJadeTemplatePaths();
            var deleted = jadeUtils.deleteCompiledFilesForTemplates(jtp);
            return {
                status: 302,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Location": "/"
                }
            };
        },
        "delete_compiled_less" : function(request, response, project){
            var projDir = runtime.constructProjectPath("");
            var lessFiles = copier.listDirChildrenFullPathsRecursively(projDir).filter(function(p){
                var suffix = "-compiled.css";
                return p.indexOf(suffix) === (p.length - suffix.length);
            });
            var deleted = lessCompiler.deleteAllCompiledCssFiles(lessFiles);
            console.log("Deleted compiled less files : ", deleted);
            response.writeHead(200, {
                "Content-Type":"text/html; charset=utf8"
            });
            response.write('<p>This is the intentionally blank page after deleting all autogenerated *-compiled.css files if corresponding *.less file exists</p><p>Going <a href="/">Home</a> might trigger recompilation thus recreating the *-compiled.css files :-)</p>');
            response.end();
        },
        "compile_all_jade" : function(request, response, project){
            var jtp = project.listProjectJadeTemplatePaths();
            jadeUtils.compileTemplatesToFiles(jtp);
            return {
                status: 302,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Location": "/"
                }
            };
        },
        "log_all" : function(request, response, project){
            utils.setLoggingLevel("all");
            return {
                status: 302,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Location": "/"
                }
            };
        },
        "log_debug" : function(request, response, project){
            utils.setLoggingLevel("debug");
            return {
                status: 302,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Location": "/"
                }
            };
        },
        "log_default" : function(request, response, project){
            utils.setLoggingLevel("info");
            return {
                status: 302,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Location": "/"
                }
            };
        },
        "delete_compiled": function (request, response, project) {
            var files = project.listCompiledTemplatePaths();
            files.forEach(function (fd) {
                var filePath = fd;
                runtime.deleteFile(filePath);
                logger.info("Deleted compiled file : " + filePath);
                var metaPath = filePath.substring(0, filePath.lastIndexOf('-'))+'-meta.json';
                if(fs.existsSync(metaPath)){
                    runtime.deleteFile(metaPath);
                }

            });
            project.updateDynamic();
            var hp = createHtmlProducer(project);
            var out = hp.createDeletedMarkup(files) + project.readViewScriptsMarkup();
            composer.renderBackendView(request, response, out, 'cmdDeleteCompiled.html');
            response.end();
        },
        "generate-components-page": function (request, response, project) {
            var url_parts = url.parse(request.url, true);
            var componentDirsTxt = url_parts.query["componentDirs"] || false;
            if (!componentDirsTxt) {
                logger.error("No componentDirs argument passed= " + request.url);
                return {
                    status: 406,
                    headers: {
                        "Content-Type": "text/plain"
                    },
                    content: "Missing componentDirs request argument, eg. componentDirs=components,portlets"
                };
            } else {
                var dirs = [componentDirsTxt];
                if (componentDirsTxt.indexOf(',') > 0) {
                    dirs = componentDirsTxt.split(',');
                }
                var paths = [];
                dirs.forEach(function (dir) {
                    var pd = project.resolveProjectFile(dir);
                    var templatePaths = project.listProjectTemplatePaths(pd);
                    templatePaths.forEach(function (tp) {
                        paths.push(tp);
                    });
                });
                paths.sort();
                var parentDivClasses = url_parts.query["parentDivClasses"] || "col-md-6";
                var out = "";
                paths.forEach(function (p) {
                    logger.info("Processing ", p);
                    var composed = composer.composeTemplate(path.basename(p), runtime.readFile(p));
                    out += '<div class="' + parentDivClasses + '">' + composed.content + '</div>';
                });
                project.writeDynamicFile('components-page.html', out);
                return {
                    status: 302,
                    headers: {
                        "Content-Type": "text/html; charset=utf-8",
                        "Location": "/components-generated.html"
                    },
                    content: out
                };
            }
        },
        "exit": function (request, response) {
            logger.info("Handling exit request received by browser!");
            response.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8"
            });
            response.on("finish", function () {
                logger.info("Finished response, exiting protostar.");
                process.exit(0);
            });
            response.write("<div>Protostar is exiting by your command, <strong>bye bye</strong>!</div>");
            response.end();
            return false;
        },
        "validate": function (request, response) {

            if (runningValidation) {
                logger.info("Still running screenshotgen");
                response.writeHead(302, {
                    "Location": "http://" + request.headers.host
                });
                response.end();
                return false;
            }
            runningValidation = true;

            var allTemplatePaths = project.listAllTemplatePaths();

            logger.info("Validating " + allTemplatePaths.length  + " pages...");
            var urlErrors = {};
            function removeWrite(templatePaths) {
                if (templatePaths.length < 1) {
                    logger.info("All are empty");
                    return;
                }
                var templatePath = templatePaths[0];
                templatePaths.splice(0, 1);

                var templateUrlPath = runtime.createUrlPathForFile(templatePath);
                var options = {
                    host: (process.env["VCAP_APP_HOST"] || 'localhost'),
                    port: (process.env["VCAP_APP_PORT"] || 8888),
                    path: templateUrlPath
                };

                var createUrlErrorsMarkup = function(urlErrors){
                    var out = '<h1>W3C Markup validation errors</h1>';

                    Object.keys(urlErrors).forEach(function(url){
                        out += '<div>';
                        out+='<h3><a href="'+url+'">'+url+'</a></h3>';
                        var errors = urlErrors[url];
                        if(errors && utils.getObjectType(errors) === 'Array' && errors.length > 0){
                            out+='<dl>';
                            errors.forEach(function(e){
                                out+='<dd>'+ e.error+'</dd><dt><pre><code>'+ utils.encodeHtmlEntities(e.context)+'</code></pre></dt>';
                            });
                            out+='</dl>';
                        }else{
                            out += '<p>Valid!</p>';
                        }
                        out+= '</div>';

                    });
                    return out;
                };

                var callback = function(valResp) {
                    var str = '';
                    valResp.on('data', function (chunk) {
                        str += chunk;
                    });
                    valResp.on('end', function () {
                        if(runtime.isDebug()){
                            logger.info(str);
                        }
                        w3c.validate(str, function (err) {
                            logger.info("FINISHED VALIDATING " + templateUrlPath, arguments);
                            if (err) {
                                logger.info("Errors for " + templateUrlPath +": ", err);
                                urlErrors[templateUrlPath] = err;
                            } else {
                                logger.info(templateUrlPath + ' is valid!');
                                urlErrors[templateUrlPath] = "ok";
                            }
                            if (allTemplatePaths.length < 1) {
                                runningValidation = false;
                                response.writeHead(200, {
                                    "Content-Type":"text/html; charset=utf-8"
                                });
                                logger.info("FOUND errors: ", urlErrors);
                                var out = createUrlErrorsMarkup(urlErrors);
                                composer.renderBackendView(request, response, out, 'cmdValidate.html');
                                response.end();

                                //response.write(out);
                                //response.end();
                            } else {
                                logger.info("Waiting 1500msec before next ...");
                                setTimeout(function(){
                                    logger.info("Invoking");
                                    removeWrite(allTemplatePaths);
                                }, 2000);

                            }
                        });
                    });
                };
                http.request(options, callback).end();
            }
            removeWrite(allTemplatePaths);
            return false;
        },
        "create": function (request, response, project) {
            var url_parts = url.parse(request.url, true);
            var urlPathname = url_parts.pathname;
            var err = 0;
            var template, templatePath;
            if(!runtime.isExistingProjectFilePath(urlPathname.substring(1))){
                logger.info("pathname doesn't exist : " + urlPathname);
                templatePath = url_parts.query.templatePath;
                logger.info("template path = " + templatePath);
                if (runtime.isProjectFileUrlPathname(templatePath)) {
                    template = runtime.readProjectFile(templatePath);
                    var targetPath = runtime.constructProjectPath(urlPathname.substring(1));
                    project.writeFile(targetPath, template);
                    logger.info("Copied " + templatePath + " to " + targetPath);
                } else {
                    err = "Non existing path " + templatePath;
                }
            }else{
                err = "Refusing to create file at exising path: " + urlPathname;
            }
            var out;
            if (err) {
                out = {
                    status: 406,
                    headers: {
                        "Content-Type": "text/plain"
                    },
                    content: err
                };
            } else {
                out = {
                    status: 302,
                    headers: {
                        "Location": "http://" + request.headers.host + urlPathname
                    }
                };
            }
            return out;
        },
        "screenshot-all": function (request, response, project) {
            if (runningScreenshotsGen) {
                logger.info("Still running screenshotgen");
                response.writeHead(302, {
                    "Location": "http://" + request.headers.host
                });
                response.end();
                return false;
            }
            var cfg = runtime.readUserConfig();

            runningScreenshotsGen = true;
            var sizes = cfg.runtime["screenshotSizes"];

            function listSizeNames() {
                var sizeNames = [];
                for (var sn in sizes) {
                    if (sizes.hasOwnProperty(sn)) {
                        sizeNames.push(sn);
                    }
                }
                return sizeNames;
            }

            var allSizeNames = listSizeNames();
            var allTemplatePaths = project.listAllTemplatePaths();
            logger.info("AllTemplatePaths: ", allTemplatePaths);
            var cmds = [];
            allSizeNames.forEach(function (sn) {
                allTemplatePaths.forEach(function (tp) {
                    cmds.push({
                        sizeName: sn,
                        path: tp
                    });
                })
            });

            function removeWrite(cmds, dirName) {
                if (cmds.length < 1) {
                    logger.info("All are empty");
                    return;
                }
                var cmd = cmds[0];
                cmds.splice(0, 1);
                var tp = cmd.path;
                var sizeName = cmd.sizeName;
                var tpName = runtime.createUrlPathForFile(tp);
                logger.info("Creating screenshot for " + tpName + " in " + dirName + " for size " + sizeName);

                var screenieName = tpName.substring(1, tpName.lastIndexOf('.')).replace(new RegExp("\\/", 'g'), "__");
                var imageFilename = screenieName + ".png";
                var screeniePath = project.resolveProjectFile("screenshots/" + dirName + "/" + sizeName + "/" + imageFilename);
                copier.ensureParentDirExists(screeniePath);

                screenies.createScreenshotAdvanced("http://localhost:" + (process.env["VCAP_APP_PORT"] || 8888) + tpName, screeniePath, sizes[sizeName].width, sizes[sizeName].height, function (imagePath) {
                    logger.info("Saved to " + imagePath);
                    if (cmds.length < 1) {
                        runningScreenshotsGen = false;
                        response.writeHead(302, {
                            "Location": "http://" + request.headers.host
                        });
                        response.end();
                    } else {
                        removeWrite(cmds, dirName);
                    }
                });
            }
            var ts = "" + new Date().getTime();
            var screenshotsDirName = "all_" + ts;
            removeWrite(cmds, screenshotsDirName);
            return false;
        },
        "load-all-template-pages": function (request, response, project) {
            var files = project.listAllTemplatePaths();
            files.sort();
            var menu = "";
            var out = "";
            files.forEach(function(f){
                var urlPath = runtime.createUrlPathForFile(f);
                var urlPathId = ("" + urlPath).replace(new RegExp('[./]', 'g'), '_');
                menu+='<li><a href="#'+urlPathId+'">'+urlPath+'</a></li>';
                out+=
                '<div class="col-md-12"><h2 id="'+urlPathId+'">'+urlPath+'</h2><a href="#generated-menu">Go to menu</a><div class="embed-responsive embed-responsive-4by3"><iframe class="embed-responsive-item" src="'+urlPath+'" ></iframe></div></div>';
            });
            out = '<div class="row">' + out + "</div>" + project.readViewScriptsMarkup();
            var menuMarkup = '<div class="row"><div class="col-md-12"><ul id="generated-menu">'+menu+'</ul></div></div>';
            out = menuMarkup + out;
            composer.renderBackendView(request, response, out, 'cmdList.html');
            response.end();
        },
        "list-scriptportlet-pushable": function(request, response, project){

            var userCfg = runtime.readUserConfig();
            if(!userCfg.hasOwnProperty("scriptPortletPushPath") || !runtime.isExistingFilePath(userCfg["scriptPortletPushPath"])){
                var msg = "Script Portal push : missing property scriptPortletPushPath on " + runtime.configPath + " or does not point to an existing file";
                console.error(msg);

                composer.renderBackendView(request, response, '<strong>'+msg+'</strong>', 'cmdList.html');
                response.end();
                return ;

            }

            var projectDir = runtime.constructProjectPath("");
            var dirsWithSpConfigFiles = copier.listDirChildrenFullPathsRecursively(projectDir).filter(function(p){
                return path.basename(p) === 'sp-config.json';
            }).map(function(p){
                return path.dirname(p).substring(projectDir.length +1);
            });
            dirsWithSpConfigFiles.sort();
            var menu = "";
            dirsWithSpConfigFiles.forEach(function(f){
                menu+='<li><a href="/?command=push-scriptportlet-dir&dir='+f+'">'+f+'</a></li>';
            });
            var out = '<div class="row"><ul>' + menu + "</ul></div>" + project.readViewScriptsMarkup();
            composer.renderBackendView(request, response, out, 'cmdList.html');
            response.end();
        },
        "push-scriptportlet-dir" : function(request, response, project){
            var userCfg = runtime.readUserConfig();
            if(!userCfg.hasOwnProperty("scriptPortletPushPath") || !runtime.isExistingFilePath(userCfg["scriptPortletPushPath"])){
                var msg = "Script Portal push : missing property scriptPortletPushPath on " + runtime.configPath + " or does not point to an existing file";
                console.error(msg);
                composer.renderBackendView(request, response, '<strong>'+msg+'</strong>', 'cmdList.html');
                response.end();
                return ;
            }
            var spCommandPath = runtime.readUserConfig()["scriptPortletPushPath"];
            var start = new Date();
            var url_parts = url.parse(request.url, true);
            var dir = url_parts.query.dir || false;
            if(!dir) throw new Error("missing directory");
            var projectDir = runtime.constructProjectPath("");
            var dirPath = path.resolve(projectDir, dir);
            if(!runtime.isExistingDirPath(dirPath)){
                throw new Error("Not an existing dir path for " + dir + ": " + dirPath);
            }
            var componentFiles = copier.listDirChildrenFullPathsRecursively(dirPath);
            var tmpDir = "/tmp/psComponentPush";
            if(runtime.isExistingDirPath(tmpDir)){
                copier.deleteRecursively(tmpDir);
                copier.mkdirsSync(tmpDir);
            }
            copier.copy(dirPath, tmpDir);
            var htmlFiles = componentFiles.filter(function(p){
                return path.extname(p) === '.html';
            });
            var jadeFiles = componentFiles.filter(function(p){
                return path.extname(p) === '.jade';
            });
            var lessFiles = componentFiles.filter(function(p){
                return path.extname(p) === '.less';
            });
            jadeFiles.forEach(function(f){
               jadeUtils.jadeFileToHtmlFile(f);
            });
            copier.copy(dirPath, tmpDir);
            htmlFiles.forEach(function(f){
                var compiledData = composer.composeTemplate(f, utils.readTextFileSync(f), 100);
                utils.writeFile(path.resolve(tmpDir, f.substring(dirPath.length+1)), compiledData.content);
            });
            function compileLessFile(lp){
                return new Promise(function(resolve, reject){
                    lessCompiler.compilePromise(lp, [path.dirname(lp)], utils.readTextFileSync(lp), path.dirname(lp)).done(function(css){
                        var cssPath = lp.substring(dirPath.length+1);
                        cssPath = cssPath.substring(0, cssPath.lastIndexOf('.'));
                        cssPath += '.css';
                        var thePath = path.resolve(tmpDir, cssPath);
                        utils.writeFile(thePath, css.toString());
                        console.log("Compiled " + lp + " to " + thePath);
                        resolve();
                    }, function(){
                        console.log("Could not compile a component less path " + lp);
                        resolve();
                    })
                });
            }
            var lessPromises = [];
            lessFiles.forEach(function(lp){
                lessPromises.push(compileLessFile(lp));
            });

            Promise.all(lessPromises).then(function(){
                console.log("Finished compiling to " + tmpDir);
                prepareComponentDir(tmpDir);
                var exec = require('child_process').exec;
                var env = process.env;
                env.PATH += ":" + path.dirname(runtime.nodeCommandPath);
                var command = spCommandPath + " push";
                exec(command, {
                    cwd: tmpDir,
                    env: env
                }, function(error, stdout, stderr) {
                    console.log("ran push command : " + command);
                    console.log("stdout: " + stdout);
                    console.log("stderr: " + stderr);
                    var opener;
                    if(error){
                        console.error("Failed! ", error);
                        opener = "Failed to push";
                    }else{
                        console.info("Success: " + stdout);
                        opener = "Successfully pushed";
                    }
                    var out =
                        '<div class="row"><div class="col-md-12">' +
                        '<h1>'+opener+' '+dir+' to portal on '+start+'</h1>' +
                        '<p><a class="btn btn-primary" href="/?command=push-scriptportlet-dir&dir='+dir+'">Push '+dir +' again</a></p>' +
                        '<h3>stdout</h3>'+
                        '<pre><code>'+stdout+'</code></pre>' +
                        '<h3>stderr</h3>'+
                        '<pre><code>'+stderr+'</code></pre>' +
                        '<h3>log</h3>'+
                        '<pre><code>'+utils.readTextFileSync(path.resolve(tmpDir, "sp-cmdln.log"))+'</code></pre>' +
                        '</div></div>';
                    composer.renderBackendView(request, response, out, 'cmdList.html');
                    response.end();
                });

            }, function(){
                console.error("Failed to run less compiles it seems", arguments);
            }).catch(function(){
                console.error("Failed to run less compiles it seems", arguments);
            });

            function relativize(paths, refDirPath){
                var out = [];
                var rdp = refDirPath;

                if(rdp.charAt(rdp.length-1) !== '/'){
                    rdp = rdp + "/";
                }
                paths.forEach(function(p){
                    if(p.indexOf(rdp) === 0){
                        out.push(p.substring(rdp.length));
                    }
                });
                return out;
            }

            function prepareComponentDir(cmpDir){
                var that = this;
                copier.listDirChildrenFullPathsRecursively(cmpDir).forEach(function(p, idx){
                    if(p.indexOf('-') >0 && p.substring(p.lastIndexOf('-')) === '-compiled.css'){
                        fs.unlinkSync(p);
                    }
                });
                var paths = copier.listDirChildrenFullPathsRecursively(cmpDir);
                var removedIdxs = [];
                var toRemove = [];
                var files = {
                    html : [],
                    css: [],
                    js: []
                };
                var lessPaths = [];
                paths.forEach(function(p, idx){
                    var ext = path.extname(p);
                    switch (ext){
                        case '.less':
                            lessPaths.push(p);
                        case '.jade':
                        case '.scss':
                            fs.unlinkSync(p);
                            toRemove.push(p);
                            removedIdxs.push(idx);
                            break;
                        case '.html':
                            files.html.push(p);
                            break;
                        case '.js':
                            files.js.push(p);
                            break;
                        case '.css':
                            files.css.push(p);
                            break;
                        default:
                            break;
                    }
                });
                console.log("Found component files: ", files);
                removedIdxs.reverse();
                removedIdxs.forEach(function(idx){
                    paths.splice(idx, 1)
                });

                var relativeFiles = {
                    html: relativize(files.html, cmpDir),
                    js: relativize(files.js, cmpDir),
                    css: relativize(files.css, cmpDir)
                };
                console.log("Relativized component files: ", relativeFiles);
                var allReferenceables = [].concat(relativeFiles.js).concat(relativeFiles.css);
                console.log("Checking for referenceables : ", allReferenceables);
                files.html.forEach(function(htmlPath){
                    var html = utils.readTextFileSync(htmlPath);
                    allReferenceables.forEach(function(refPath){
                        try {
                            var query = refPath + '"';
                            var endIdx = html.indexOf(query);
                            if (endIdx > 0) {
                                var attrName = path.extname(refPath) === ".js" ? "src" : "href";
                                console.log("HTML " + htmlPath + " contains a ref that needs to be encoded to " + refPath);
                                var firstQuoteIdx = html.lastIndexOf('"', endIdx);
                                var closingQuote = html.indexOf('"', firstQuoteIdx + 1);
                                var toReplace = attrName + "=" + html.substring(firstQuoteIdx, closingQuote + 1);
                                var replacement = attrName + '="' + refPath + '"';
                                var outHtml = "" + html;
                                console.log("Replacing '" + toReplace + "' with '" + replacement + "'");
                                var lastCritIdx = outHtml.lastIndexOf(toReplace);
                                while (lastCritIdx >= 0) {
                                    var before = outHtml.substring(0, lastCritIdx);
                                    var after = outHtml.substring(lastCritIdx + toReplace.length);
                                    outHtml = before + replacement + after;
                                    lastCritIdx = outHtml.lastIndexOf(toReplace);
                                }
                                if (html !== outHtml) {
                                    console.log("Saving modified html to" + htmlPath + " (for " + refPath + ")");
                                    utils.writeFile(htmlPath, outHtml);
                                }
                            }
                        } catch (e) {
                            console.error("Error during processing " + cmpDir, e);
                            throw e;
                        }
                    })
                });
                var easy = relativeFiles.html.length === 1 && relativeFiles.js.length <= 1 && relativeFiles.css.length <= 1;
                if(easy){
                    var htmlPath = files.html[0];
                    var cnt ="";
                    var read = false;
                    var initCnt = "";
                    if(relativeFiles.js.length === 1){
                        cnt = utils.readTextFileSync(htmlPath);
                        initCnt = "" + cnt;
                        read = true;
                        var firstJs = relativeFiles.js[0];
                        if(cnt.indexOf(firstJs + '"') < 0){
                            var src = firstJs;
                            var scriptTag = '\n'+'<script type="text/javascript" src="' + src + '"></script>'+'\n';
                            console.log("Adding script tag to " + htmlPath + " for " + firstJs);
                            cnt = cnt + scriptTag;
                        }
                    }
                    if(relativeFiles.css.length === 1){
                        if(!read){
                            cnt = utils.readTextFileSync(htmlPath);
                            initCnt = "" + cnt;
                        }
                        var firstCss = relativeFiles.css[0];
                        if(cnt.indexOf(firstCss + '"') < 0){
                            var linktag = '<link rel="stylesheet" href="'+firstCss+'"/>';
                            cnt = '\n'+linktag+'\n' + cnt;
                            console.log("Adding css link tag to " + htmlPath + " for " + firstCss);
                        }
                    }
                    if(read && (cnt.length > 0 && (initCnt !== cnt))){
                        utils.writeFile(htmlPath, cnt);
                    }
                    logger.info("Prepared an easy portlet: " + cmpDir);
                }else{
                    logger.info("Not an easy portlet: " + cmpDir + ": ", relativeFiles);
                }
                return easy;
            }
        }
    };

    this.getCommandNames = function(){
        var names = [];
        for(var nm in commandFactory){
            if(commandFactory.hasOwnProperty(nm) && typeof commandFactory[nm] === 'function'){
                names.push(nm);
            }
        }
        names.sort();
        return names;
    };

    var parseArgs = function (args) {
        runtime = args.runtime;
        composer = args.composer;
        project = args.project;
        setupDxSync();
    };
    parseArgs(args);

    function setupDxSync(){
        var userCfg = runtime.readUserConfig();
        var dxsyncConfigured = userCfg.hasOwnProperty("dxSyncPath") && runtime.isExistingFilePath(userCfg["dxSyncPath"]);
        if(dxsyncConfigured && runtime.isProjectConfigPresent()){
            var pcfg = runtime.readProjectConfig();
            if(pcfg.hasOwnProperty("dxSyncDir")){
                var dxSyncDir = path.normalize(pcfg["dxSyncDir"]);
                var dxsCfgPath = path.resolve(dxSyncDir, ".settings");
                var missingFields = [];
                if(runtime.isExistingFilePath(dxsCfgPath)){
                    var dxsCfg = JSON.parse(fs.readFileSync(dxsCfgPath, "utf8"));
                    ["username",
                        "password",
                        "contenthandlerPath",
                        "host",
                        "secure",
                        "port",
                        "theme"].forEach(function(field){
                            if(!dxsCfg.hasOwnProperty(field) || (typeof dxsCfg[field]!== 'string' && typeof dxsCfg[field] !== 'boolean') || dxsCfg[field].length < 1){
                                missingFields.push(field);
                            }

                        });
                    if(missingFields.length > 0){
                        var msg = "DXSync : missing config properties on " + dxsCfgPath + ": " + missingFields.join(", ");
                        console.error(msg);
                    }else{
                        console.info("DXSync integration is enabled.");
                        commandFactory["dxsync-push"] = function(request, response, project){

                            var start = new Date();
                            portletThemeMerger.mergeStatic({
                                targetDir : dxSyncDir,
                                projectPath : runtime.constructProjectPath('.'),
                                runtime:runtime,
                                composer:composer,
                                project:project
                            }).then(function(){
                                console.log("Merged static successfully to " + dxSyncDir);

                                var env = process.env;
                                env.PATH += ":" + path.dirname(runtime.nodeCommandPath);
                                var exec = require('child_process').exec;
                                var command = userCfg["dxSyncPath"] + " push";
                                console.log("Running " + command + " from dir " + dxSyncDir + "...");
                                exec(command, {
                                    cwd: dxSyncDir
                                }, function(error, stdout, stderr) {
                                    console.log("ran push command : " + command);
                                    console.log("stdout: " + stdout);
                                    console.log("stderr: " + stderr);
                                    var opener;
                                    if(error){
                                        console.error("Failed! ", error);
                                        opener = "Failed to push theme files using DXSync using";
                                    }else{
                                        console.info("Success: " + stdout);
                                        opener = "Successfully pushed theme files to webdav using DXSync using";
                                    }

                                    var out = '<div class="row"><div class="col-md-12">' +
                                        '<h1>'+opener+' '+dxSyncDir+' to portal on '+start+'</h1>' +
                                        '<p><a class="btn btn-primary" href="/?command=dxsync-push">Sync DX again</a></p>' +
                                        '<h3>stdout</h3>'+
                                        '<pre><code>'+stdout+'</code></pre>' +
                                        '<h3>stderr</h3>'+
                                        '<pre><code>'+stderr+'</code></pre>' +
                                        '</div></div>';

                                    composer.renderBackendView(request, response, out, 'cmdList.html');
                                    response.end();
                                });


                            }, function(){
                                var msg = "Could not merge static successfully to " + dxSyncDir;
                                console.error(msg, arguments);
                                composer.renderBackendView(request, response, '<strong>'+msg+'</strong>', 'cmdList.html');
                                response.end();
                            }).catch(function(){
                                var msg = "Could not merge static to " + dxSyncDir;
                                console.error(msg, arguments);
                                composer.renderBackendView(request, response, '<strong>'+msg+'</strong>', 'cmdList.html');
                                response.end();
                            });
                        }
                    }

                }else{
                    var msg = "DXSync : property 'dxSyncDir' on prototype.json does not point to an existing directory: " + dxSyncDir;
                    console.error(msg);
                    //composer.renderBackendView(request, response, '<strong>'+msg+'</strong>', 'cmdList.html');
                    //response.end();
                }
            }else{
                var msg = "DXSync : missing project config property 'dxSyncDir' on prototype.json at " + runtime.projectConfigPath;
                console.error(msg);
                //composer.renderBackendView(request, response, '<strong>'+msg+'</strong>', 'cmdList.html');
                //response.end();
            }
        }else{
            var msg = "DXSync is not configured : either missing path to dxsync on " + runtime.configPath + " or no prototype config present at " + runtime.projectConfigPath;
            console.error(msg);
            //composer.renderBackendView(request, response, '<strong>'+msg+'</strong>', 'cmdList.html');
            //response.end();
        }
    }




    this.handleCommandRequest = function (command, request, response) {
        logger.info("Running command " + command);
        var responseObj = (commandFactory[command])(request, response, project);
        if(runtime.isDebug()){
            logger.info("Ran command " + command + ":", responseObj);
        }else{
            logger.info("Ran command " + command);
        }
        return responseObj;
    }
}

module.exports = {
    createProjectCommandHandler: function (args) {
        return new ProjectCommands(args);
    },
    getCommandNames: function(){
        var names = [];
        for(var nm in commandFactory){
            if(commandFactory.hasOwnProperty(nm) && typeof commandFactory[nm] === 'function'){
                names.push(nm);
            }
        }
        names.sort();
        return names;
    }
};

