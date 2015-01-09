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

var utils = require("../lib/utils");

describe("util functions", function(){
    var urls = [
        'js/dev/jquery-1.11.1.js',
        'js/main.js',
        '/ps/ext/boostrap/dist/js/bootstrap.js',
        'https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js',
        'slick/slick.css',
        'less/adp.less?compile',
        'img/ADP-favicon-32x32.png'
    ];

    it("should encode urls", function(){
        var targetDir = "/tmp/tmp";
        var du = utils.createDependencyUrlForTarget("/child/file.html", "../js/main.js", "/tmp/tmp");
        expect(du).toBe("/tmp/tmp/js/main.js");
        urls.forEach(function(u){
            console.log(u + " => " + utils.createDependencyUrlForTarget("/index.html", u, targetDir));
        })

    });
    it("should format bytesizes", function(){
        function testRun(n){
            for(var s in utils.sizeFormatters){
                if(typeof utils.sizeFormatters[s] === 'function'){
                    console.log("FORMAT " + s + " " + n + " : ", utils.formatByteSize(n, s));
                }
            }
        }
        [4320, 23.12*1024*1024, 918*1024*1024*1024].forEach(function(n){
            console.log("SIZE TEST " + n);
            testRun(n);
        })
    })
});