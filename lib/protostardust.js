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
    deferred = require("deferred"),

    exec = require("child_process").exec,
    os = require("os"),
    mime = require('mime'),

    wrench = require("wrench"),

    fs = require("./filesystem"),
    templateComposer = require("./templateComposer"),
    lessCompiler = require("./lessCompiler"),
    projectFactory = require('./protostarProject'),
    projectCommandsFactory = require('./projectCommands'),
    utils = require("./utils"),
    builder = require("./protostarBuilder"),
    requestHandlers = require("./requestHandlers"),
    handlerResolver = require("./handlerResolver");

var logger = utils.createLogger({sourceFilePath : __filename});

function ProtoStarServer(args) {

    var lessCssRequestParameterPrefix="less.";

    var nonResourceExt = {
        '.html':1,
        '.md':1
    };

    var backendViewUrls = {
        '/projectConfig':'projectConfig',
        '/pshelp' : 'help',
        '/newPortalTheme': 'newPortalTheme'
    };

    this.buildPrototype = function (targetDir, callBack) {
        var projectBuilder = builder.createBuilder({
            project: project,
            runtime:runtime,
            composer: composer
        });
        projectBuilder.buildPrototype(callBack);
    };

    var requestHandler = function (request, response) {
        var handlerName = resolveHandler(request, response);
        (handlers[handlerName])(request, response);
    };

    var isBowerInstallNecessary= function(){
        return (function(){
            var def = deferred();
            var bowerJson = runtime.constructProjectPath("bower.json");
            var bowerRC = runtime.constructProjectPath(".bowerrc");

            function compareJsonDepsWithInstalled(bdn){
                var bowerDir = runtime.constructProjectPath(bdn);
                console.log("Bower dir = " + bowerDir);
                fs.readdir(bowerDir).done(function(filenames){
                    var fns = {};
                    console.log("Found installed deps in " + bdn + " : ", filenames);
                    filenames.forEach(function(fn){
                        fns[fn] = 1;
                    });
                    fs.readTextFile(bowerJson).done(function(bowerTxt){
                        var parsedBower = JSON.parse(bowerTxt);
                        var needed = false;
                        var firstLevelDeps = [];
                        console.log("Inspecting deps of " +parsedBower.name + " : ", parsedBower.dependencies);
                        console.log("Installed deps : ", fns);
                        for(var dep in parsedBower.dependencies){
                            firstLevelDeps.push(dep);
                            if(!fns.hasOwnProperty(dep)){
                                console.log("Missing bower dependency " + dep + "#" + parsedBower.dependencies[dep] + " => bower install needed");
                                needed = true;
                            }
                        }
                        if(!needed){
                            console.log("All deps installed, bower install not needed...");

                            deferred.map(firstLevelDeps, function(depName){
                                console.log("Reading bower.json for " + depName);
                                var rel = bdn + path.sep + depName + path.sep + "bower.json";
                                var pjp = runtime.constructProjectPath(rel);
                                console.log("Reading bower.json at " + pjp);
                                return fs.readTextFile(pjp);
                            })(function(depsPackageJsons){
                                console.log("Finished reading bower.jsons : ", depsPackageJsons);
                                depsPackageJsons.forEach(function(pj){
                                    var parsed = JSON.parse(pj);
                                    console.log("Inspecting dependencies of " + parsed.name);
                                    for(var dep in parsed.dependencies){
                                        if(!fns.hasOwnProperty(dep)){
                                            console.log("Missing bower dependency " + dep + "#" + parsedBower.dependencies[dep] + " => bower install needed");
                                            needed = true;
                                        }
                                    }
                                });
                                def.resolve(needed);
                            }).done();
                        }else{
                            def.resolve(needed);
                        }

                    }, function(err){
                        console.error(err.stack);
                        def.reject(err);
                    });
                }, function(err){
                    console.error("Error reading dir " + bowerDir, err.stack);
                    def.reject(err);
                });
            }
            console.log("checking for bower.json");
            fs.exists(bowerJson).done(function(jsonExists){
                if(jsonExists){
                    console.log("json exists");
                    fs.exists(bowerRC).done(function(rcExists){
                        var bdn = "bower_components";
                        if(rcExists){
                            console.log("rc exists");
                            fs.readTextFile(bowerRC).done(function(rcText){
                                console.log("Read " + bowerRC)
                                var parsed = JSON.parse(rcText);
                                if(parsed && parsed.hasOwnProperty("directory") && typeof parsed.directory === "string"){
                                    bdn = parsed.directory;
                                    compareJsonDepsWithInstalled(bdn);
                                }
                            }, function(err){
                                console.error(err.stack);
                                def.reject(err);
                            });
                        }else{
                            compareJsonDepsWithInstalled(bdn);
                        }
                    }, function(err){
                        console.error(err.stack);
                        def.reject(err);
                    });
                }else{
                    def.resolve(false);
                }
            }, function(err){
                console.error("error checkign exists " + bowerJson, err);
                def.reject(err);
            });
            return def.promise;
        })();

    };

    var runBowerForProject = function(callback){

        isBowerInstallNecessary().done(function(needed){
            if(needed){
                var bowerExec = runtime.constructAppPath(["node_modules", "bower", "bin", "bower"]);
                var curProj = runtime.constructProjectPath(".");
                logger.debug("Running bower for " + curProj + " : " + bowerExec);
                var cmd = runtime.getNodeCommandPath() + " " + bowerExec+" install";
                logger.debug("cmd = " + cmd);
                logger.info("Running bower ...");
                exec("pwd && " + cmd, {
                    cwd: curProj
                }, function(error, stdout, stderr){
                    callback(error, stdout, stderr);
                });
            }else{
                callback();
            }
        }, function(error){
            console.error("Error checking bower",error.stack);
            callback();
        });


    };

    function startServer() {
        function startListening(){
            try {
                server.listen(runtime.getPort());
            } catch (ServerLaunchError) {
                logger.error("Could not launch due to error, maybe port " + runtime.getPort() + " is in use?", ServerLaunchError.stack);
                //console.trace(ServerLaunchError);
            }
            server.on("listening", function () {
                startedListening = true;
            });
            logger.info("Server listening on http://localhost:" + runtime.getPort() + "/");
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
        }

        if(runtime.isExistingProjectFilePath(["bower.json"])){
            logger.info("Found bower.json inside active project");

            runBowerForProject(function(error, stdout, stderr){
                if(error){
                    logger.error("bower raised an error ", error);
                    console.trace(error);
                    if(stdout)logger.error("bower stdout: ", stdout);
                    if(stderr)logger.error("bower stderr: ", stderr);
                    throw new Error("bower raised an error");
                }else{
                    //logger.info("bower ran successfullly!");
                    if(stdout && stdout.trim()){
                        logger.info("bower stdout: ", stdout.trim());
                    }
                    if(stderr && stderr.trim()){
                        logger.info("bower stderr: ", stderr.trim());
                    }
                }
                startListening();
            });
        }else{
            startListening();
        }
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
        handlers = requestHandlers.createHandlers({
            runtime: runtime,
            project: project,
            projectCommands: projectCommands,
            sslc: sslc,
            composer: composer,
            allowedThemeReqs: allowedThemeReqs
        });

        resolveHandler = handlerResolver.createResolver({
                lessCssRequestParameterPrefix : lessCssRequestParameterPrefix,
                allowedThemeReqs : allowedThemeReqs,
                backendViewUrls : backendViewUrls,
                project : project,
                runtime : runtime,
                nonResourceExt : nonResourceExt
        });
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
        logger.info("Starting Protostar v0.9.4");
        createServer();
        startServer();
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

    var allowedThemeReqs = {};
    var runtime,
        project,
        server,
        composer,
        projectCommands,
        startedListening = false, sslc, handlers, resolveHandler;

    runtime = args.runtime;
    createServer();
}

module.exports = {
    createServer: function (config) {
        return new ProtoStarServer(config);
    }
};