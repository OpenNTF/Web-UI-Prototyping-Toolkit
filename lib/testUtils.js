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

var path = require("path");
var ProtostarRuntime = require("./runtime");


var protostarscript = path.resolve(__dirname, '../bin/protostar.js');// + '/home/spectre/Projects/proto-star/bin/protostar.js';

function createRuntime(){
    var projDir;
    if(arguments.length > 0 && typeof arguments[0] === 'string'){
        projDir = arguments[0];
    }else{
        projDir = getTestProjectDir();
    }
    var rt = new ProtostarRuntime({
        workingDir: process.cwd(),
        debug:false,
        fullCommandLineArgs: process.argv,
        protostarDirPath: path.resolve(__dirname, ".."),
        nodeCommandPath: process.argv[0],
        protostarScriptPath: protostarscript,
        projectDirPath: projDir

    });
    return rt;
}

var getProjectDir = function () {
    return path.join(__dirname, "..");
};
var getTestProjectDir = function () {
    return path.join(getProjectDir(), "projects", "test");
};

module.exports = {
    getProjectDir: getProjectDir,
    getTestProjectDir: getTestProjectDir,
    createTestRuntime: createRuntime
};