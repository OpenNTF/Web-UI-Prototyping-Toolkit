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

var protostar = require(__dirname + "/../lib/protostar");

var rt = protostar.createRuntime({
    workingDir: process.cwd(),
    args: process.argv,
    debug:false
});

if(rt.mode === 'create'){
    protostar.createProject(rt);
}else if(rt.mode === 'help'){
    //protostar.generateHelpMarkup();
}else if(rt.mode === "build"){
    protostar.buildProject(rt);
}else if(rt.mode === "devserver"){
    protostar.startProject(rt);
}else{
    throw new Error("Unknown runtime mode! " + rt.mode);
}