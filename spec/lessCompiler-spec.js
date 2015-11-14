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
var testUtils = require("../lib/testUtils");
var fs = require("fs");
var path = require("path");
var lc = require("../lib/lessCompiler");
describe("lessCompile", function(){
    it("should offer a compile method", function(done){
        var filePath = path.join(testUtils.getTestProjectDir(),  "less", "style.less");
        lc.compile(
            filePath,[
                path.dirname(filePath) //folder toURL requires trailing slash
            ],
            "" + fs.readFileSync(filePath),
            path.join(testUtils.getTestProjectDir(),  "less"),
            function(css){
                expect(typeof css).toBe("string");
                console.log("COMPILED");
                done();
            }
        );
    });
    xit("should offer a compile many method", function(done){
        lc.compileLessFilesToCss(['/home/spectre/Projects/WUIPT/bower_components/bootstrap/less/bootstrap.less', '/home/spectre/Projects/WUIPT/projects/sample/less/styles.less'], function(err, cssPerFile){

            done();
        });
    });
});
