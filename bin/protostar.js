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

var path = require("path");
var fs = require("fs");
var protostardust = require("../lib/protostardust");
var utils = require("../lib/utils");
var psRuntime = require("../lib/runtime");

var rt = psRuntime.createRuntime({
    workingDir: process.cwd(),
    args: process.argv,
    debug:false
});

function buildProject(){
    var buildHelper = protostardust.createServer({
        runtime:rt
    });
    buildHelper.buildPrototype(rt.targetDirPath, function(){
        console.log("BUILT " + rt.constructProjectPath("") + " => " + rt.getTargetDirPath());
    });
}

function startProject(){
    var helper = protostardust.createServer({
        runtime:rt
    });
    helper.start();
}

function createProject(){
    var helper = protostardust.createServer({
        runtime:rt
    });
    helper.createProject();
    // create dir
    // create index.html with backend stuff
    // create prototype.json with defaults
}

function startWorkspace(){

}

//console.log("RT === ", rt);
if(rt.mode === 'create'){
    createProject();
}else if(rt.mode === 'help'){

}else if(rt.mode === "build"){
    buildProject();
}else if(rt.mode === "devserver"){
    startProject();
}else{
    throw new Error("Unknown runtime mode! " + rt.mode);
}