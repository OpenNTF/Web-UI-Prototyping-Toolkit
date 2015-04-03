var tc = require("../lib/templateComposer");
var fs = require("../lib/filesystem");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
var path = require("path");
var templatesParent =path.join(testUtils.getTestProjectDir(), "component") + "/";

function newTemplateComposer(projDir){
    var h = tc.createTemplateComposer({
        runtime: testUtils.createTestRuntime(projDir)
    });
    return h;
}

describe("File Oriented Templating Language", function(){
    var cmp;
    var runtime;
    var testsProjectDirPath = path.join(__dirname, "files/testsProj")
    beforeEach(function(){
        cmp = newTemplateComposer(testsProjectDirPath);
        runtime = cmp.runtime;
    });

    it("file: includes html files at project relative path", function(done){
        var templatePath = path.join(testsProjectDirPath, "fotl/fileIncludesHtml.html");
        fs.readTextFile(templatePath).done(function(tf){
            var composed = cmp.composeTemplate(templatePath, tf);
            //console.log("COMPOSED = ", composed);
            expect(composed.content).toBe('a<p>S</p>b');
            expect(composed.metadata.templatePath).toBe(templatePath);
            expect(composed.metadata.deps.hasOwnProperty(templatePath)).toBe(true);
            expect(composed.metadata.deps.hasOwnProperty(testsProjectDirPath + path.sep +"stub.html")).toBe(true);
            var count = utils.countOwnProperties(composed.metadata.deps);
            expect(count).toBe(2);
            done();
        });
    });
    it("layout: includes passed file: statements", function(done){
        var templatePath = path.join(testsProjectDirPath, "fotl/layoutSimple.html");
        fs.readTextFile(templatePath).done(function(tf){
            var composed = cmp.composeTemplate(templatePath, tf);
            //console.log("COMPOSED = ", composed);
            expect(composed.content).toBe('a<p><p>S</p></p><p>S</p>b');
            expect(composed.metadata.templatePath).toBe(templatePath);
            expect(composed.metadata.deps.hasOwnProperty(templatePath)).toBe(true);
            expect(composed.metadata.deps.hasOwnProperty(testsProjectDirPath + path.sep +"stub.html")).toBe(true);
            expect(composed.metadata.deps.hasOwnProperty(testsProjectDirPath + path.sep +"fotl" +path.sep+ "lay1.html")).toBe(true);
            var count = utils.countOwnProperties(composed.metadata.deps);
            expect(count).toBe(3);
            done();
        });
    });
    it("layout: includes string args ", function(done){
        var templatePath = path.join(testsProjectDirPath, "fotl/layoutSimpleStringArgs.html");
        fs.readTextFile(templatePath).done(function(tf){
            var composed = cmp.composeTemplate(templatePath, tf);
            //console.log("COMPOSED = ", composed);
            expect(composed.content).toBe('a<p>a</p>bb');
            expect(composed.metadata.templatePath).toBe(templatePath);
            expect(composed.metadata.deps.hasOwnProperty(templatePath)).toBe(true);
            expect(composed.metadata.deps.hasOwnProperty(testsProjectDirPath + path.sep +"fotl" +path.sep+ "lay1.html")).toBe(true);
            var count = utils.countOwnProperties(composed.metadata.deps);
            expect(count).toBe(2);
            done();
        });
    });
    it("layout: args can be assigned by order ", function(done){
        var templatePath = path.join(testsProjectDirPath, "fotl/layoutArgsByOrder.html");
        fs.readTextFile(templatePath).done(function(tf){
            var composed = cmp.composeTemplate(templatePath, tf);
            //console.log("COMPOSED = ", composed);
            expect(composed.content).toBe('x<p>a</p>by');
            expect(composed.metadata.templatePath).toBe(templatePath);
            expect(composed.metadata.deps.hasOwnProperty(templatePath)).toBe(true);
            expect(composed.metadata.deps.hasOwnProperty(testsProjectDirPath + path.sep +"fotl" +path.sep+ "lay1.html")).toBe(true);
            var count = utils.countOwnProperties(composed.metadata.deps);
            expect(count).toBe(2);
            done();
        });
    });

    it("layout: includes nested layout args", function(done){
        var templatePath = path.join(testsProjectDirPath, "fotl/layoutNested.html");
        fs.readTextFile(templatePath).done(function(tf){
            var dpt = cmp.findAllDropPoints(templatePath, tf, cmp.runtime.dropPointTypes);
            expect(dpt.length).toBe(1);
            expect(dpt[0].getArgs()[0]).toBe("main=layout:fotl/lay1(main=\"A1M\";other=\"A1O\")");
            expect(dpt[0].getArgs()[1]).toBe("other=layout:fotl/lay1(main='A2M';other='A20')");
            //console.log("DPT=", dpt);
            var composed = cmp.composeTemplate(templatePath, tf);
            //console.log("COMPOSED = ", composed);
            expect(composed.content).toBe('a<p><p>A1M</p>A1O</p><p>A2M</p>A20b');
            expect(composed.metadata.templatePath).toBe(templatePath);
            expect(composed.metadata.deps.hasOwnProperty(templatePath)).toBe(true);
            expect(composed.metadata.deps.hasOwnProperty(testsProjectDirPath + path.sep +"fotl" +path.sep+ "lay1.html")).toBe(true);
            var count = utils.countOwnProperties(composed.metadata.deps);
            expect(count).toBe(2);
            done();
        });
    });
    it("it allows complex tags to be spread over multiple lines", function(done){
        var templatePath = path.join(testsProjectDirPath, "fotl/layoutNestedStruct.html");
        fs.readTextFile(templatePath).done(function(tf){
            var dpt = cmp.findAllDropPoints(templatePath, tf, cmp.runtime.dropPointTypes);
            expect(dpt.length).toBe(1);
            expect(dpt[0].getArgs()[0]).toBe("main=layout:fotl/lay1(main=\"A1M\";other=\"A1O\")");
            expect(dpt[0].getArgs()[1]).toBe("other=layout:fotl/lay1(main='A2M';other='A20')");
            //console.log("DPT=", dpt);
            var composed = cmp.composeTemplate(templatePath, tf);
            //console.log("COMPOSED = ", composed);
            expect(composed.content).toBe('a<p><p>A1M</p>A1O</p><p>A2M</p>A20b');
            expect(composed.metadata.templatePath).toBe(templatePath);
            expect(composed.metadata.deps.hasOwnProperty(templatePath)).toBe(true);
            expect(composed.metadata.deps.hasOwnProperty(testsProjectDirPath + path.sep +"fotl" +path.sep+ "lay1.html")).toBe(true);
            var count = utils.countOwnProperties(composed.metadata.deps);
            expect(count).toBe(2);
            done();
        });
    });
    it("it behaves correctly with not all droppoints assigned and prints helpful comment", function(done){
        var templatePath = path.join(testsProjectDirPath, "fotl/layoutOnlyOneArg.html");
        fs.readTextFile(templatePath).done(function(tf){
            var dpt = cmp.findAllDropPoints(templatePath, tf, cmp.runtime.dropPointTypes);
            expect(dpt.length).toBe(1);
            expect(dpt[0].getArgs()[0]).toBe('"a"');
            //expect(dpt[0].getArgs()[1]).toBe("other=layout:fotl/lay1(main='A2M';other='A20')");
            //console.log("DPT=", dpt);
            var composed = cmp.composeTemplate(templatePath, tf);
            //console.log("COMPOSED = ", composed);
            expect(composed.content).toBe('x<p>a</p>y');
            expect(composed.metadata.templatePath).toBe(templatePath);
            expect(composed.metadata.deps.hasOwnProperty(templatePath)).toBe(true);
            expect(composed.metadata.deps.hasOwnProperty(testsProjectDirPath + path.sep +"fotl" +path.sep+ "lay1.html")).toBe(true);
            var count = utils.countOwnProperties(composed.metadata.deps);
            expect(count).toBe(2);
            done();
        });
    });
    it("detects invalid and recursive refs", function(done){
        var templatePath = path.join(testsProjectDirPath, "fotl/invalidSelfRef.html");
        fs.readTextFile(templatePath).done(function(tf){
            function selfRef(){
                //var dpt = cmp.findAllDropPoints(templatePath, tf, cmp.runtime.dropPointTypes);
                var composed = cmp.composeTemplate(templatePath, tf);
                done();
            }
            expect(selfRef).toThrow();
        });
    });

});