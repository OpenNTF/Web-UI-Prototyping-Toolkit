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

var utils = require("../lib/utils");
var wcmTagParser = require("../lib/wcmTagParser");
var path = require("path");

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
        });

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
        });
    });
    it("should correct comment endings", function(){
        var html='<blah><!-- test:test--> <!-- ok:ok --> <!-- test2:test2-->';
        var expected='<blah><!-- test:test --> <!-- ok:ok --> <!-- test2:test2 -->';
        console.log("correcting ...");
        var actual = utils.correctCommentClosings(html);
        console.log("Corrected comments=", actual);
        expect(actual).toBe(expected);


    });

    it("should properly parse Placeholder instances from tag without args", function(){
        var filePath = '/tmp/testFilePath.html';
        var startIdx = 10;
        var tag = '<!-- file:index -->';
        var ph = utils.parsePlaceholder(tag, filePath, startIdx);
        expect(ph.getName()).toBe('index');
        expect(ph.hasArgs()).toBe(false);
        expect(ph.getType()).toBe('file');
        expect(ph.getArgs().length).toBe(0);
        expect(ph.getEnd()).toBe(startIdx + tag.length);
        expect(ph.getFilePath()).toBe(filePath);
    });

    it("should properly parse Placeholder instances from tag with args by name", function(){
        var filePath = '/tmp/testFilePath.html';
        var startIdx = 10;
        var tag = '<!-- layout:layout/home(main=file:hello;title="hey") -->';
        var ph = utils.parsePlaceholder(tag, filePath, startIdx);
        expect(ph.getName()).toBe('layout/home');
        expect(ph.hasArgs()).toBe(true);
        expect(ph.getType()).toBe('layout');
        expect(ph.getArgs().length).toBe(2);
        var ao = ph.getArgsObject();
        expect(ao.main).toBe('file:hello');
        expect(ao.title).toBe('"hey"');
        expect(ph.getArgs()[0]).toBe('main=file:hello');
        expect(ph.getArgs()[1]).toBe('title="hey"');
        expect(ph.getEnd()).toBe(startIdx + tag.length);
        expect(ph.isArgsByName()).toBe(true);
        expect(ph.isArgsByOrder()).toBe(false);
    });

    it("should properly parse Placeholder instances from tag with args by order", function(){
        var filePath = '/tmp/testFilePath.html';
        var startIdx = 10;
        var tag = '<!-- layout:layout/home(file:hello;"hey") -->';
        var ph = utils.parsePlaceholder(tag, filePath, startIdx);
        expect(ph.getName()).toBe('layout/home');
        expect(ph.hasArgs()).toBe(true);
        expect(ph.getType()).toBe('layout');
        expect(ph.getArgs().length).toBe(2);

        expect(ph.getArgs()[0]).toBe('file:hello');
        expect(ph.getArgs()[1]).toBe('"hey"');
        expect(ph.getEnd()).toBe(startIdx + tag.length);
        expect(ph.isArgsByName()).toBe(false);
        expect(ph.isArgsByOrder()).toBe(true);
        function getArgsObjectWhenByOrder(){
            var ph = utils.parsePlaceholder(tag, filePath, startIdx);
            var ao = ph.getArgsObject();
        }
        expect(getArgsObjectWhenByOrder).toThrow();
    });

});