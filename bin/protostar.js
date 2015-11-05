#!/usr/bin/env node
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

/*
* Protostar CLI
* */

var launchTime = new Date().getTime();

//var protostar = require(__dirname + "/../lib/protostar");
var path = require("path")
var utils = require("../lib/utils")
var runtime = require(__dirname + "/../lib/runtime");
var protostardust = require(__dirname + "/../lib/protostardust");
var templateComposer = require(__dirname + "/../lib/templateComposer");
var protostarProject = require(__dirname + "/../lib/protostarProject");
var portalThemeMerger = require(__dirname + "/../lib/portalThemeMerger");
/**
 *
 * @return {Object.<String,String|Number>}
 */
var parseCommandLineArgs = function () {
    console.log("Launching with args: ", process.argv)
    console.info("node path = " + process.argv[0]);
    var o = {};
    o.protostarDirPath = path.join(__dirname, "..");
    var cmdArgs = process.argv.slice(2);
    var argCount = cmdArgs.length;
    var firstArg = cmdArgs[0];
    switch (firstArg) {
        case 'help':
            o.mode = 'help';
            o.helpMessage = 'Usage: protostar <command> <args>\n' +
                'Following commands are available:\n' +
                'protostar help                                    Displays this help\n' +
                'protostar dev <projectDir>                        Starts the Protostar development environment with the project directory at <projectDir>\n' +
                'protostar build <projectDir> <targetDir>          Creates a prebuilt version of the project located at directory <projectDir> at given <targetDir>\n' +
                'protostar create <templateName> <newProjectDir>   Creates a new project directory at <newProjectDir> using passed <templateName>';
            break;
        case 'create':
            o.mode = 'create',
            o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]),
            o.projectTemplate = cmdArgs.length > 2 ? cmdArgs[2] : 'default';
            break;
        case 'dev':
        case 'prod':
            if (argCount === 3) {
                var portArg = cmdArgs[2];
                if (parseInt(portArg, 10) == portArg) {
                    //this.port = parseInt(portArg, 10);
                    console.info("Setting port to " + portArg);
                    o.mode = "devserver";
                    o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
                    o.port = parseInt(portArg, 10);
                } else {
                    throw new Error("Illegal port argument provided; try 'protostar <projectDir> <portnumber>' or 'protostar <projectDir>' port passed:" + portArg);
                }
            } else {
                o.mode = "devserver";
                o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
            }
            break;
        case 'build':
            o.mode = 'build';
            o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
            o.targetDirPath = utils.normalizePathCmdLine(cmdArgs[2]);
            break;
        case 'mergeStatic':
            o.mode = 'mergeStatic';
            o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
            o.targetDirPath = utils.normalizePathCmdLine(cmdArgs[2]);
            break;

        case 'merge':
            o.mode = 'merge';
            o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
            o.themeDirPath = utils.normalizePathCmdLine(cmdArgs[2]);
            o.targetDirPath = utils.normalizePathCmdLine(cmdArgs[3]);
            break;
        default:
            // old way of invoking
            if (argCount === 3) {
                if (cmdArgs[0] === 'build') {
                    o.model = 'build';
                    o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
                    o.targetDirPath = utils.normalizePathCmdLine(cmdArgs[2]);

                } else {
                    console.error("CANNOT PARSE: ", process.argv);
                    throw new Error("cannot parse");
                }
            } else if (argCount === 1 || argCount === 2) {
                if (argCount === 2) {
                    if (parseInt(cmdArgs[1], 10) == cmdArgs[1]) {
                        console.info("Setting port to " + cmdArgs[1]);
                        o.mode = 'devserver';
                        o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[0]);
                        o.port = parseInt(cmdArgs[1], 10);
                    } else {
                        throw new Error("Illegal port argument provided; try 'protostar <projectDir> <portnumber>' or 'protostar <projectDir>' port passed:" + cmdArgs[1]);
                    }
                } else {
                    o.mode = 'devserver';
                    o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[0]);
                }
            } else {
                throw new Error("Please launch protostar properly: 'protostar <projectDir>' or 'protostar <projectDir> <port>'");
            }
            break;
    }
    console.log("Parsed cmdline args: ", o);
    return o;
};

var args = parseCommandLineArgs();
args.launchTime = launchTime;
var rt = new (runtime.ProtostarRuntime)(args);

function newProjectFromTemplate(){
    var helper = new (protostardust.ProtoStarServer)({
        runtime: rt
    });
    helper.createProjectFromTemplate();
}

function buildProject(){
    var buildHelper = new (protostardust.ProtoStarServer)({
        runtime: rt
    });
    buildHelper.buildPrototype(rt.targetDirPath, function () {
        console.log("BUILT " + rt.constructProjectPath("") + " => " + rt.getTargetDirPath());
    });
}

function mergeStatic(){
    var composer = new (templateComposer.TemplateComposer)({
        runtime: rt
    });
    var project = new protostarProject.Project({
        runtime: rt,
        composer: composer
    });
    portalThemeMerger.mergeStatic({
        targetDir: rt.getTargetDirPath(),
        projectPath: rt.constructProjectPath('.'),
        runtime: rt,
        composer: composer,
        project: project
    }).then(function () {
        console.log("merge success");
    }, function () {
        console.error("merge fail :(", arguments);
    }).catch(function (errors) {
        console.error("merge error ::: ", errors);
    });
}

function merge(){
    var composer = new (templateComposer.TemplateComposer)({
        runtime: rt
    });
    var project = new protostarProject.Project({
        runtime: rt,
        composer: composer
    });
    portalThemeMerger.merge({
        targetDir: rt.getTargetDirPath(),
        projectPath: rt.constructProjectPath('.'),
        themePath: rt.getThemeDirPath(),
        runtime: rt,
        composer: composer,
        project: project
    }).then(function () {
        console.log("merge success");
    }, function () {
        console.error("merge fail :(", arguments);
    }).catch(function (errors) {
        console.error("merge error ::: ", errors);
    });
}

function devServe(){
    var helper = new (protostardust.ProtoStarServer)({
        runtime: rt
    });
    helper.start();
}

function prodServe(){
    var helper = new (protostardust.ProtoStarServer)({
        runtime: rt
    });
    helper.start();
}

function launch(){
    if(rt.mode === 'create'){
        newProjectFromTemplate();
    }else if(rt.mode === 'help'){

    }else if(rt.mode === "build"){
        buildProject()
    }else if(rt.mode === "devserver"){
        devServe()
    }else if(rt.mode === 'merge'){
        merge()
    }else if(rt.mode === 'mergeStatic'){
        mergeStatic()
    }else if(rt.mode === 'prodserver'){
        prodServe();
    }else{
        throw new Error("Unknown runtime mode! " + rt.mode);
    }
}

launch();