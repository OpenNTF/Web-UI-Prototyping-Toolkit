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
    handlerResolver = require("./handlerResolver"),
    requestContext = require("./requestContext");

var opn = require('opn');

var logger = utils.createLogger({sourceFilePath : __filename});



function ProtoStarServer(args) {

    /**
     *
     * @type {number}
     */
    this.minResponseDelay = 0;

    /**
     *
     * @type {number}
     */
    this.maxResponseDelay = 0;

    /**
     *
     * @type {String}
     */
    this.lessCssRequestParameterPrefix="less.";

    this.nonResourceExt = {
        '.html':1,
        '.md':1,
        '.hbs':1,
        '.jade':1
    };

    this.backendViewUrls = {
        '/projectConfig':'projectConfig',
        '/pshelp' : 'help',
        '/pscmds' : 'commands',
        '/newPortalTheme': 'newPortalTheme'
    };



    this.allowedThemeReqs = {};
    ///**
    // * @type {ProtostarRuntime}
    // */
    //this.runtime;
    /**
     * @type {protostarProject.Project}
     */
    this.project;
    /**
     * @type {protostardust.ProtoStarServer}
     */
    this.server;
    /**
     * @type {TemplateComposer}
     */
    this.composer;
    this.projectCommands;
    this.startedListening = false;
    this.sslc;
    this.handlers;
    this.resolveHandler;
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = args.runtime;
    this.createServer();
}


ProtoStarServer.prototype.buildPrototype = function (targetDir, callBack) {
    var t = this;
    this.projectBuilder = builder.createBuilder({
        project: t.project,
        runtime: t.runtime,
        composer: t.composer
    });
    this.projectBuilder.buildPrototype(callBack);
};


ProtoStarServer.prototype.startServer = function() {
    var t = this;
    function startListening(){
        try {
            t.server.listen(t.runtime.getPort());
        } catch (ServerLaunchError) {
            logger.error("Could not launch due to error, maybe port " + t.runtime.getPort() + " is in use?", ServerLaunchError.stack);
            //console.trace(ServerLaunchError);
        }
        t.server.on("listening", function () {
            t.startedListening = true;
        });
        t.server.on("error", function(err){
            logger.error("Could not launch due to error, maybe port " + t.runtime.getPort() + " is in use?", err.stack);
        });
        logger.info("Server listening on http://localhost:" + t.runtime.getPort() + "/");
        var options = {
            host: (process.env["VCAP_APP_HOST"] || 'localhost'),
            port: (process.env["VCAP_APP_PORT"] || t.runtime.getPort()),
            path: '/index.html'
        };
        var callback = function(response) {
            var str = '';
            response.on('data', function (chunk) {
                str += chunk;
            });
            response.on('end', function () {
                if(t.runtime.isDebug()){
                    logger.info(str);
                }
                if(!process.env.hasOwnProperty("WCAP_APP_HOST")){
                    var userCfg = t.runtime.readUserConfig();
                    if(userCfg.hasOwnProperty("openInBrowser") && userCfg["openInBrowser"]){
                        if(!userCfg.hasOwnProperty("defaultBrowser") || !(userCfg["defaultBrowser"])){
                            opn('http://localhost:' + t.runtime.getPort());
                        }else{
                            opn('http://localhost:' + t.runtime.getPort(), { app: userCfg["defaultBrowser"]});
                        }
                    }else{
                        logger.info("Not opening in browser (protostar config.json has openInBrowser=" + userCfg["openInBrowser"] + ")");
                    }
                }else{
                    logger.info("Not opening in browser on bluemix.");
                }

            });
        };
        http.request(options, callback).end();
    }
    var jtp = this.project.listProjectJadeTemplatePaths();
    var deleted = jadeUtils.deleteCompiledFilesForTemplates(jtp);
    if(deleted && deleted.length >0){
        logger.info("Deleted " + deleted.length + " compiled JADE html files");
    }

    var curProj = t.runtime.constructProjectPath(".");
    if(t.runtime.isExistingProjectFilePath(["bower.json"])){
        logger.info("Found bower.json inside active project");
        var bowerExec = t.runtime.constructAppPath(["node_modules", "bower", "bin", "bower"]);

        var bu = new bowerUtils.BowerUtils(curProj);
        bu.runBower(bowerExec, t.runtime.getNodeCommandPath()).done(function(){
            startListening();
        }, function(err){
            logger.error("Bower check error", err);
            logger.error("Bower error: ", err.stack);
            startListening();
        });
    }else{
        startListening();
    }
};

ProtoStarServer.prototype.createServer = function() {
    if (typeof this.server === 'object') {
        this.destroyServer();
    }
    var t = this;

    this.composer = new (templateComposer.TemplateComposer)({
        runtime: t.runtime
    });
    this.project = new (projectFactory.Project)({
        composer: t.composer,
        runtime: t.runtime
    });
    this.projectCommands = projectCommandsFactory.createProjectCommandHandler({
        project: t.project,
        runtime: t.runtime,
        composer: t.composer
    });

    this.sslc = lessCompiler.createServerSideLessCompiler(t.runtime.constructProjectPath(""), function(){return t.project["lessParserAdditionalArgs"];});
    this.handlers = requestHandlers.createHandlers({
        runtime: t.runtime,
        project: t.project,
        projectCommands: t.projectCommands,
        sslc: t.sslc,
        composer: t.composer,
        allowedThemeReqs: t.allowedThemeReqs
    });

    this.resolveHandler = handlerResolver.createResolver({
        lessCssRequestParameterPrefix : t.lessCssRequestParameterPrefix,
        allowedThemeReqs : t.allowedThemeReqs,
        backendViewUrls : t.backendViewUrls,
        project : t.project,
        runtime : t.runtime,
        nonResourceExt : t.nonResourceExt
    });

    var requestHandler = function (request, response) {
        //var trt = this;
        var hf = t.resolveHandler;
        function handle(t){
            hf(request, response).done(function(handlerName){
                logger.info("handler="+handlerName);
                if(!t.handlers.hasOwnProperty(handlerName)){
                    t.handlers[handlerName] = require("./handler/" + handlerName);
                    console.log("Loaded handler " + handlerName);
                     //= h;
                }
                var rc = new requestContext.RequestContext(request, response, t.runtime, t.composer, t.project);
                var handlerFn = t.handlers[handlerName];
                try{
                    handlerFn(rc);
                }catch(he){
                    if(t.runtime.lenient){
                        console.error("Error handling request for " + request.method + " " + request.url + " with handler " + handlerName + ": "+ he.message, he.stack);
                        response.writeHead(500);
                        response.end();
                    }else{
                        throw he;
                    }
                }

            }, function(err){
                logger.error("Could not reqsolve handler", err);
                utils.writeResponse(response, 500, {"Content-Type": "text/plain; charset=utf-8"}, "Could not determine handler for request");
            });
        }

        if(t.minResponseDelay >= 0 && t.maxResponseDelay >= 0 && (t.maxResponseDelay - t.minResponseDelay) > 0){
            var responseDelay = t.minResponseDelay + Math.floor(Math.random()*(t.maxResponseDelay - t.minResponseDelay));
            setTimeout(function(){
                console.info("LAUNCH WITH TIMEOUT");
                handle(t);
            }, responseDelay);
        }else{
            handle(t);
            //t.resolveHandler(request, response).done(function(handlerName){
            //    logger.info("handler="+handlerName);
            //    if(!t.handlers.hasOwnProperty(handlerName)){
            //        var h = require("./handler/" + handlerName);
            //        console.log("We loaded handler : " ,h);
            //        t.handlers[handlerName] = h;
            //    }
            //    var handlerFn = t.handlers[handlerName];
            //
            //    //console.log(utils.getObjectType(request));
            //    //console.log(utils.getObjectType(response));
            //    var rc = new requestContext.RequestContext(request, response, trt.runtime, trt.composer, trt.project);
            //    debugger;
            //    //handlerFn(request, response);
            //    handlerFn(rc);
            //}, function(err){
            //    logger.error("Could not reqsolve handler", err);
            //    utils.writeResponse(response, 500, {"Content-Type": "text/plain; charset=utf-8"}, "Could not determine handler for request");
            //});
        }
    };
    this.server = http.createServer(requestHandler);
};

ProtoStarServer.prototype. destroyServer = function() {
    if (typeof this.server === 'object') {
        if (this.startedListening) {
            this.server.close();
        }
        this.server = undefined;
        this.composer = undefined;
        this.startedListening = false;
        this.projectCommands = undefined;
        logger.info("Server closed");
    }
};

ProtoStarServer.prototype.stop = function () {
    this.destroyServer();
};

ProtoStarServer.prototype.start = function () {
    logger.info("Starting Protostar " + JSON.parse(this.runtime.readFile(this.runtime.constructAppPath("package.json"))).version + " ...");
    //createServer();
    this.startServer();
};

ProtoStarServer.prototype.createProjectFromTemplate = function(){
    var newProjPath = this.runtime.projectDirPath;

    if(this.runtime.isExistingDirPath(newProjPath)){
        throw new Error("Cannot create new project at existing path: " + newProjPath);
    }
    var templatepath = this.runtime.constructAppPath(['core', 'templates', 'project', this.runtime.projectTemplate]);
    logger.info('Copying ' + templatepath + ' to ' + newProjPath);
    copier.copy(templatepath, newProjPath);
    //wrench.copyDirSyncRecursive(templatepath, newProjPath);
    logger.info("Created new project based on the '" + this.runtime.projectTemplate + "' at directory path " + newProjPath);
};


module.exports = {
    ///**
    // *
    // * @param config
    // * @return {ProtoStarServer}
    // */
    //createServer: function (config) {
    //    return new ProtoStarServer(config);
    //},
    ProtoStarServer:ProtoStarServer
};
