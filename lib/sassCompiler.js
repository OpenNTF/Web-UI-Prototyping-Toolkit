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
var less = require("less");
var path = require("path");
var utils = require("./utils");
var fs = require("../node_modules/less/lib/less/fs");

var logger = utils.createLogger({sourceFilePath : __filename});

var sass;

function requireSass(){
    if(!sass){
        sass = require("node-sass");
    }
}

/**
 *
 * @param {String} sassCode
 * @param {String[]} includePathsArray
 * @param {String}cssFilename
 * @param {Function} doneFn
 */
function renderSass(sassCode, includePathsArray, cssFilename, doneFn){
    requireSass();
    sass.render({
        //file: '/path/to/myFile.scss',
        data: sassCode,
        //importer: function(url, prev, done) {
        //    // url is the path in import as is, which libsass encountered.
        //    // prev is the previously resolved path.
        //    // done is an optional callback, either consume it or return value synchronously.
        //    // this.options contains this options hash, this.callback contains the node-style callback
        //    someAsyncFunction(url, prev, function(result){
        //        done({
        //            file: result.path, // only one of them is required, see section Sepcial Behaviours.
        //            contents: result.data
        //        });
        //    });
        //    // OR
        //    var result = someSyncFunction(url, prev);
        //    return {file: result.path, contents: result.data};
        //},
        includePaths: includePathsArray, //[ 'lib/', 'mod/' ],
        sourceMap: './'+cssFilename+'.map',
        outputStyle: 'compressed', //(nested | expanded | compact | compressed)
        success: function(result){
            var css = result.css.toString();
            var cssMap = JSON.stringify(result.map);
            console.log(css);
            var stats = result.stats;
            console.log(stats);

            console.log(cssMap);
            // or better
            console.log(); // note, JSON.stringify accepts Buffer too
            doneFn(css, cssMap, stats);
        },
        error: function(error){
            console.log(error.status); // used to be "code" in v2x and below
            console.log(error.column);
            console.log(error.message);
            console.log(error.line);
            console.error("Error compiling sass", error);
        }
    }, function(error, result) { // node-style callback from v3.0.0 onwards
        if (error) {
            console.log(error.status); // used to be "code" in v2x and below
            console.log(error.column);
            console.log(error.message);
            console.log(error.line);
            console.error("Error compiling sass", error)
        }
        else {
            var css = result.css;
            var cssMap = result.map;
            var stats = result.stats;
            console.log(css);
            console.log(stats);
            console.log(cssMap);
            doneFn(css, cssMap, stats);
        }
    });
}

/**
 *
 * @param {String} filePath
 * @param {String[]} includePathsArray
 * @param {Function} doneFn
 */
function renderSassFile(filePath, includePathsArray, doneFn){
    requireSass()
    sass.render({
        file: filePath,
        //importer: function(url, prev, done) {
        //    // url is the path in import as is, which libsass encountered.
        //    // prev is the previously resolved path.
        //    // done is an optional callback, either consume it or return value synchronously.
        //    // this.options contains this options hash, this.callback contains the node-style callback
        //    someAsyncFunction(url, prev, function(result){
        //        done({
        //            file: result.path, // only one of them is required, see section Sepcial Behaviours.
        //            contents: result.data
        //        });
        //    });
        //    // OR
        //    var result = someSyncFunction(url, prev);
        //    return {file: result.path, contents: result.data};
        //},
        includePaths: includePathsArray,
        outputStyle: 'compressed'
    }, function(error, result) { // node-style callback from v3.0.0 onwards
        if (error) {
            console.log(error.status); // used to be "code" in v2x and below
            console.log(error.column);
            console.log(error.message);
            console.log(error.line);
            console.error("Error compiling sass", error.stack)
        }
        else {
            var css = result.css.toString();
            //var cssMap = result.map.toString();
            var cssMap = JSON.stringify(result.map);
            console.log(css);
            var stats = result.stats;
            console.log(stats);

            console.log(cssMap);
            // or better

            console.log(cssMap); // note, JSON.stringify accepts Buffer too
            doneFn(css, cssMap, stats);
        }
    });
}




module.exports = {
    renderSass : renderSass,
    renderSassFile : renderSassFile
};

