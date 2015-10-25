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

var dust = require("../lib/protostardust");
var fs = require("fs");
var testUtils = require("../lib/testUtils");
var psRuntime = require("../lib/runtime")
var args = {};
args.port = 9999;
args.writeResponsesToFiles = true;
args.writtenResponsesParent = "/tmp";
args.workingDirectory = testUtils.getProjectDir();
args.defaultPageTemplatePath = '/parts/page.html';
args.dropPointTypes = ["part", "layout", "content", "file", "lorem"];
args.partTypePaths = {
    part: "parts", layout: "layouts", component: "component"
};
args.enableDebug = true;
args.projectDir = testUtils.getTestProjectDir();
function createRuntime() {
    var rt = testUtils.createTestRuntime();
    return rt;
}
function createServer() {
    return dust.createServer({
        runtime: createRuntime()
    });
}
describe("Helper", function () {
    it("should create a new helper instance", function () {
        console.log("ptsd1");
        var h = createServer();
        expect(typeof h).toBe("object");
        h.stop();
    }, 2000);
});
if(false)
describe("Postprocess", function () {
    it("should provide editables of unique ids", function (done) {
        console.log("ptsd2");
        var s = createServer();
        var editableMarkup = '<div data-editable="hey/test"><p>some text</p></div>';
        var expected = '<!doctype html>\n<html><body><div data-editable="hey/test" id="psGenId_0"><p>some text</p></div></body></html>';
        s.postProcessComposed({content: editableMarkup}, function (result) {
            expect(result).toBe(expected);
            done();
        });
    }, 2000)
});
if(false)
describe("jsdom test", function () {
    it("should get a value out", function (done) {
        console.log("ptsd3");
        function runJQueryFunction(html_in, jqueryFunction, callback) {
            var jsdom = require('jsdom');
            jsdom.env({
                html: html_in, done: function (errors, window) {
                    var $ = require("jquery")(window);
                    var result = jqueryFunction($, window);
                    callback(result, errors, window);
                    window.close();
                    console.log("closed window");
                }
            });
        }

        var oldhtml = '<body><div>some text</div></body>';
        runJQueryFunction(oldhtml, function ($) {
            $('body').append('<div>foo</div><!-- test -->');
            return $("body").html();
        }, function (newstuff, errors, window) {
            console.log(newstuff); // woohoo! it works!
            console.log("errors:", errors);
            done();
        });
    }, 2000);
});
if(false)
describe("Building prototypes", function () {
    it("should build to a target directory", function (done) {
        console.log("ptsd4");
        var s = createServer();
        var targetDir = "/tmp/psTestBuild";
        s.buildPrototype(targetDir, function () {
            console.log("built.");
            console.log("Arguments", arguments);
            expect(fs.existsSync(targetDir + "/index.html")).toBe(true);
            expect(fs.existsSync(targetDir + "/two.html")).toBe(true);
            done();
        });
    }, 2000);

    it("should be able to send a Ghost Request", function (done) {
        console.log("ptsd4");
        var s = createServer();
        var targetDir = "/tmp/psTestBuild";
        s.buildPrototype(targetDir, function () {
            console.log("built.");
            console.log("Arguments", arguments);
            expect(fs.existsSync(targetDir + "/index.html")).toBe(true);
            expect(fs.existsSync(targetDir + "/two.html")).toBe(true);
            done();
        });
    });
});







