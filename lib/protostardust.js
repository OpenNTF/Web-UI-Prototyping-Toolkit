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
const appName = "ProtoStar";
const
    http = require("http"),
    copier = require("./copier"),
    BowerUtils = require("./bowerUtils"),
    TemplateComposer = require("./templateComposer"),
    lessCompiler = require("./lessCompiler"),
    jadeUtils = require("./jadeUtils"),
    Project = require('./protostarProject'),
    utils = require("./utils"),
    handlerResolver = require("./handlerResolver"),
    RequestContext = require("./requestContext"),
    auth = require('basic-auth'),
    opn = require('opn');

let builder;

const logger = utils.createLogger({sourceFilePath: __filename});


class ProtoStarServer {

    constructor({runtime, minResponseDelay = 0, maxResponseDelay = 0}) {

        /**
         *
         * @type {number}
         */
        this.minResponseDelay = minResponseDelay;

        /**
         *
         * @type {number}
         */
        this.maxResponseDelay = maxResponseDelay;

        /**
         *
         * @type {String}
         */
        this.lessCssRequestParameterPrefix = "less.";

        this.nonResourceExt = {
            '.html': 1,
            '.md': 1,
            '.hbs': 1,
            '.jade': 1
        };

        this.backendViewUrls = {
            '/projectConfig': 'projectConfig',
            '/pshelp': 'help',
            '/pscmds': 'commands',
            '/newPortalTheme': 'newPortalTheme'
        };


        this.allowedThemeReqs = {};

        /**
         * @type {Project}
         */
        this.project = undefined;
        /**
         * @type {Server}
         */
        this.server = undefined;
        /**
         * @type {TemplateComposer}
         */
        this.composer = undefined;
        this.projectCommands = undefined;
        this.startedListening = false;
        this.sslc = undefined;
        this.handlers = undefined;
        this.resolveHandler = undefined;
        /**
         * @type {ProtostarRuntime}
         */
        this.runtime = runtime;
        // this.createServer();
        this.composer = new TemplateComposer({
            runtime: this.runtime
        });
        this.project = new Project({
            composer: this.composer,
            runtime: this.runtime
        });
        this.sslc = lessCompiler.createServerSideLessCompiler(this.runtime.constructProjectPath(""), () => this.project["lessParserAdditionalArgs"]);
        this.project.sslc = this.sslc;
        this.handlers = {};
        this.resolveHandler = handlerResolver.createResolver({
            lessCssRequestParameterPrefix: this.lessCssRequestParameterPrefix,
            allowedThemeReqs: this.allowedThemeReqs,
            backendViewUrls: this.backendViewUrls,
            project: this.project,
            runtime: this.runtime,
            nonResourceExt: this.nonResourceExt
        });
        this.server = http.createServer((req, res) =>{
            this.requestHandler(req, res, this);
        });
    }

    buildPrototype(targetDir, callBack) {
        if (!builder) {
            builder = require("./protostarBuilder");
        }

        this.projectBuilder = builder.createBuilder({
            project: this.project,
            runtime: this.runtime,
            composer: this.composer
        });
        this.projectBuilder.buildPrototype(callBack);
    }

    /**
     * Options eg: {
     *      hostname: 'www.google.com',
     *      port: 80,
     *      path: '/upload',
     *      method: 'POST',
     *      headers: {
     *          'Content-Type': 'application/x-www-form-urlencoded',
     *          'Content-Length': Buffer.byteLength(postData)
     *      }
     *  }
     *
     * @param {{hostname:string, port:number, path: string, method: string, headers: Object.<string,string>}} options
     * @param {function} cb the callback
     */
    serverSideRequest(options, cb) {
        /*
        var options = {
            hostname: 'www.google.com',
            port: 80,
            path: '/upload',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        var options = {
            host: (process.env["VCAP_APP_HOST"] || 'localhost'),
            port: (process.env["VCAP_APP_PORT"] || this.runtime.getPort()),
            path: '/index.html'
        };
        */
        const self = this;

        const req = http.request(options, function (response) {
            let str = '';
            response.on('data', function (chunk) {
                str += chunk;
            });
            response.on('end', function () {
                if (self.runtime.isDebug()) {
                    logger.info(str);
                }
                cb(undefined, str);
            });
        });
        req.on('error', function (err) {
            cb(err);
        });
        req.end();
    }

    requestPath(urlPath) {
        const options = {
            host: (process.env["VCAP_APP_HOST"] || 'localhost'),
            port: (process.env["VCAP_APP_PORT"] || this.runtime.getPort()),
            path: urlPath || '/index.html'
        };
        const self = this;
        const callback = function (err, str) {
            if (process.env.hasOwnProperty("WCAP_APP_HOST")) {
                logger.info("Not opening in browser on bluemix.");
            } else {
                const userCfg = self.runtime.readUserConfig();
                if (userCfg.hasOwnProperty("openInBrowser") && userCfg["openInBrowser"]) {
                    if (!userCfg.hasOwnProperty("defaultBrowser") || !(userCfg["defaultBrowser"])) {
                        opn('http://localhost:' + self.runtime.getPort());
                    } else {
                        opn('http://localhost:' + self.runtime.getPort(), {app: userCfg["defaultBrowser"]});
                    }
                } else {
                    logger.info("Not opening in browser (protostar config.json has openInBrowser=" + userCfg["openInBrowser"] + ")");
                }
            }
        };
        self.serverSideRequest(options, callback);
    }

    startListening() {
        let self = this;
        try {
            this.server.listen(this.runtime.getPort());
        } catch (ServerLaunchError) {
            logger.error("Could not launch due to error, maybe port " + this.runtime.getPort() + " is in use?", ServerLaunchError.stack);
        }
        this.server.on("listening", function () {
            self.startedListening = true;
            logger.info("protostar started up in " + (new Date().getTime() - self.runtime.launchTime) + "ms");
            logger.info("protostar is listening on http://localhost:" + self.runtime.getPort() + "/");

        });
        this.server.on("error", function (err) {
            logger.error("Could not launch due to error, maybe port " + self.runtime.getPort() + " is in use?", err.stack);
        });
        this.requestPath();

    }

    startServer() {

        const jtp = this.project.listProjectJadeTemplatePaths();
        const deleted = jadeUtils.deleteCompiledFilesForTemplates(jtp);
        if (deleted && deleted.length > 0) {
            logger.info("Deleted " + deleted.length + " compiled JADE html files");
        }

        const curProj = this.runtime.constructProjectPath(".");

        if (this.runtime.isExistingProjectFilePath(["bower.json"])) {
            logger.info("Found bower.json inside active project");
            const bowerExec = this.runtime.constructAppPath(["node_modules", "bower", "bin", "bower"]);

            const bu = new BowerUtils(curProj);
            const self = this;
            bu.runBower(bowerExec, this.runtime.getNodeCommandPath())
                .done(function () {
                    self.startListening();
                }, function (err) {
                    logger.error("Bower check error", err);
                    logger.error("Bower error: ", err.stack);
                    self.startListening();
                });
        } else {
            this.startListening();
        }
    }

    requestHandler(request, response, self) {
        // const self = this;
        const prjCfg = self.runtime.readProjectConfig();
        // console.log("Read project config = ", prjCfg);
        if (prjCfg.hasOwnProperty('runtime') && prjCfg.runtime.hasOwnProperty('auth') && prjCfg.runtime.auth.hasOwnProperty('users') && prjCfg.runtime.auth.users.length) {
            let fail = false;
            let credentials = auth(request);
            if (credentials) {
                let ok = false;
                let c = credentials;
                prjCfg.runtime.auth.users.forEach(function (u) {
                    if (u.username === c.name && u.password === c.pass) {
                        ok = true;
                    }
                });
                if (!ok) {
                    fail = true;
                }
            } else {
                fail = true;
            }
            if (fail) {
                response.statusCode = 401;
                response.setHeader('WWW-Authenticate', 'Basic realm="' + prjCfg.runtime.auth.realm + '"');
                response.end('Access denied');
                return;
            }
        }


        if (self.minResponseDelay >= 0 && self.maxResponseDelay >= 0 && (self.maxResponseDelay - self.minResponseDelay) > 0) {
            const responseDelay = self.minResponseDelay + Math.floor(Math.random() * (self.maxResponseDelay - self.minResponseDelay));
            setTimeout(() =>{
                console.info("LAUNCH WITH TIMEOUT");
                this.handle(request, response);
            }, responseDelay);
        } else {
            setImmediate(() =>{
                this.handle(request, response);
            });

        }
    }

    handle(request, response) {
        this.resolveHandler(request, response)
            .done(handlerName =>{
                logger.debug("handler=" + handlerName);
                if (!this.handlers.hasOwnProperty(handlerName)) {
                    this.handlers[handlerName] = require("./handler/" + handlerName);
                    logger.info("Loaded handler " + handlerName);
                }
                const rc = new RequestContext(request, response, this.runtime, this.composer, this.project);
                const handlerFn = this.handlers[handlerName];
                try {
                    handlerFn(rc);
                } catch (he) {
                    if (this.runtime.lenient) {
                        logger.error("Error handling request for " + request.method + " " + request.url + " with handler " + handlerName + ": " + he.message, he.stack);
                        response.writeHead(500);
                        response.end();
                    } else {
                        throw he;
                    }
                }
            }, err =>{
                logger.error("Could not reqsolve handler", err);
                utils.writeResponse(response, 500, {"Content-Type": "text/plain; charset=utf-8"}, "Could not determine handler for request");
            });
    }


    start() {
        let packageJsonPath = this.runtime.constructAppPath("package.json");
        let packageJson = JSON.parse(this.runtime.readFile(packageJsonPath));
        logger.info("Starting Protostar " + packageJson.version + " ...");
        this.startServer();
    }

    stop() {
        this.destroyServer();
    }

    destroyServer() {
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
    }

    createProjectFromTemplate() {
        const newProjPath = this.runtime.projectDirPath;
        if (this.runtime.isExistingDirPath(newProjPath)) {
            throw new Error("Cannot create new project at existing path: " + newProjPath);
        }
        const templatepath = this.runtime.constructAppPath(['core', 'templates', 'project', this.runtime.projectTemplate]);
        logger.info('Copying ' + templatepath + ' to ' + newProjPath);
        copier.copy(templatepath, newProjPath);
        logger.info("Created new project based on the '" + this.runtime.projectTemplate + "' at directory path " + newProjPath);
    }
}

module.exports = ProtoStarServer;