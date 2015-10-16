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
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.ru
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

    copier = require("./copier"),
    bowerUtils= require("./bowerUtils"),
    fs = require("./filesystem"),
    templateComposer = require("./templateComposer"),
    lessCompiler = require("./lessCompiler"),
    jadeUtils = require("./jadeUtils"),
    projectFactory = require('./protostarProject'),
    projectCommandsFactory = require('./projectCommands'),
    utils = require("./utils"),
    builder = require("./protostarBuilder"),
    requestHandlers = require("./requestHandlers"),
    handlerResolver = require("./handlerResolver");

var opn = require('opn');

var logger = utils.createLogger({sourceFilePath : __filename});

var minResponseDelay = 0;

var maxResponseDelay = 0;

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
        function handle(){
            resolveHandler(request, response).done(function(handlerName){
                logger.debug("handler="+handlerName);
                var handlerFn = handlers[handlerName];

                handlerFn(request, response);
            }, function(err){
                logger.error("Could not reqsolve handler", err);
                utils.writeResponse(response, 500, {"Content-Type": "text/plain; charset=utf-8"}, "Could not determine handler for request");
            });
        }

        if(minResponseDelay >= 0 && maxResponseDelay >= 0 && (maxResponseDelay - minResponseDelay) > 0){
            var responseDelay = minResponseDelay + Math.floor(Math.random()*(maxResponseDelay - minResponseDelay));
            setTimeout(handle, responseDelay);
        }else{
            handle();
        }

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
                host: (process.env["VCAP_APP_HOST"] || 'localhost'),
                port: (process.env["VCAP_APP_PORT"] || 8888),
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
                    if(!process.env.hasOwnProperty("WCAP_APP_HOST")){
                        var userCfg = runtime.readUserConfig();
                        if(userCfg.hasOwnProperty("openInBrowser") && userCfg["openInBrowser"]){
                            if(!userCfg.hasOwnProperty("defaultBrowser") || !(userCfg["defaultBrowser"])){
                                opn('http://localhost:' + runtime.getPort());
                            }else{
                                opn('http://localhost:' + runtime.getPort(), { app: userCfg["defaultBrowser"]});
                            }
                        }else{
                            logger.info("Not opening in browser (config has openInBrowser=" + userCfg["openInBrowser"]);
                        }
                    }else{
                        logger.info("Not opening in browser on bluemix.");
                    }

                });
            };
            http.request(options, callback).end();
        }
        var jtp = project.listProjectJadeTemplatePaths();
        var deleted = jadeUtils.deleteCompiledFilesForTemplates(jtp);
        if(deleted && deleted.length >0){
            logger.info("Deleted " + deleted.length + " compiled JADE html files");
        }

        var curProj = runtime.constructProjectPath(".");
        if(runtime.isExistingProjectFilePath(["bower.json"])){
            logger.info("Found bower.json inside active project");
            var bowerExec = runtime.constructAppPath(["node_modules", "bower", "bin", "bower"]);

            var bu = new bowerUtils.BowerUtils(curProj);
            bu.runBower(bowerExec, runtime.getNodeCommandPath()).done(function(){
                startListening();
            }, function(err){
                logger.error("Bower check error", err);
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
        sslc = lessCompiler.createServerSideLessCompiler(runtime.constructProjectPath(""), function(){return project["lessParserAdditionalArgs"];});
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
        logger.info("Starting Protostar " + JSON.parse(runtime.readFile(runtime.constructAppPath("package.json"))).version + " ...");
        //createServer();
        startServer();
    };

    this.createProject = function(){
        var newProjPath = runtime.projectDirPath;

        if(runtime.isExistingDirPath(newProjPath)){
            throw new Error("Cannot create new project at existing path: " + newProjPath);
        }
        var templatepath = runtime.constructAppPath(['core', 'templates', 'project', runtime.projectTemplate]);
        logger.info('Copying ' + templatepath + ' to ' + newProjPath);
        copier.copy(templatepath, newProjPath);
        //wrench.copyDirSyncRecursive(templatepath, newProjPath);
        logger.info("Created new project based on the '" + runtime.projectTemplate + "' at directory path " + newProjPath);
    };

    var allowedThemeReqs = {};
    /**
     * @type {ProtostarRuntime}
     */
    var runtime;
    /**
     * @type {protostarProject.Project}
     */
    var project;
    /**
     * @type {ProtoStarServer}
     */
    var server;
    /**
     * @type {TemplateComposer}
     */
    var composer;
    var projectCommands;
    var startedListening = false;
    var sslc;
    var handlers;
    var resolveHandler;

    runtime = args.runtime;
    createServer();
}

module.exports = {
    /**
     *
     * @param config
     * @return {ProtoStarServer}
     */
    createServer: function (config) {
        return new ProtoStarServer(config);
    },
    ProtoStarServer:ProtoStarServer
};
