var tc = require("../lib/templateComposer");
var fs = require("../lib/filesystem");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
//var _fs = require("fs");
var path = require("path");
//var templatesParent =path.join(testUtils.getTestProjectDir(), "component") + "/";
var fotlLorem = require("../lib/fotl-lorem");
//function newTemplateComposer(projDir){
//    var h = tc.createTemplateComposer({
//        runtime: testUtils.createTestRuntime(projDir)
//    });
//    return h;
//}

describe("File Oriented Templating Language", function(){
    //var cmp;
    //var runtime;
    var testsProjectDirPath = path.join(__dirname, "files/testsProj");
    //beforeEach(function(){
    //    console.log("before each")
    //    cmp = newTemplateComposer(testsProjectDirPath);
    //    runtime = cmp.runtime;
    //});


    it("create factory", function(){

        var fact = fotlLorem.createFactory({
            runtime: testUtils.createTestRuntime(testsProjectDirPath)
        });
        //tagName, fullTag, startIdx, endIdx, filepath

        //var tag = '<!-- lorem:word -->';
        //var ph = fact.parsePlaceholder('ignored', tag, 0, tag.length, '/tmp/test');
        //var newOut = fact.applyPlaceholder(ph, tag);
        //console.log("NEW = ", newOut);

        function testLorem(tagContents){
            var tag = '<!-- ' + tagContents + ' -->';
            var ph = fact.parsePlaceholder('ignored', tag, 0, tag.length, '/tmp/test');
            var newOut = fact.applyPlaceholder(ph, tag);
            console.log(tag + "  =>  " + newOut);
            return newOut;
        }

        var tl = testLorem;
        tl('word');
        tl('word(count=2)');


        var phraseTest = tl('lorem:phrase(minLength=3;maxLength=9)');
        var phraseTest = tl('lorem:phrase(min=1;max=3)');
        expect(phraseTest+"" === "NaN").toBe(false);
        expect(phraseTest.indexOf("NaN") === 0).toBe(false);


        //var templatePath = path.join(testsProjectDirPath, "fotl/fileIncludesHtml.html");
        //var tf = fs.readFileSync(templatePath, 'utf8');
        //var composed = cmp.composeTemplate(templatePath, tf);
        ////console.log("COMPOSED = ", composed);
        //expect(composed.content).toBe('a<p>S</p>b');
        //expect(composed.metadata.templatePath).toBe(templatePath);
        //expect(composed.metadata.deps.hasOwnProperty(templatePath)).toBe(true);
        //expect(composed.metadata.deps.hasOwnProperty(testsProjectDirPath + path.sep +"stub.html")).toBe(true);
        //var count = utils.countOwnProperties(composed.metadata.deps);
        //expect(count).toBe(2);
        //done();
        //fs.readTextFile(templatePath).done(function(tf){
        //
        //});
    });


});