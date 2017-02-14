var pnp = require("../lib/portalNavigationProducer");
var TemplateComposer = require("../lib/templateComposer");
var fs = require("../lib/filesystem");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
var path = require("path");
var Project = require("../lib/protostarProject");

function newTemplateComposer(projDir){
    var h = new TemplateComposer({
        runtime: testUtils.createTestRuntime(projDir)
    });
    return h;
}

function newProject(projDir){
    var runtime = testUtils.createTestRuntime(projDir);
    var composer = new TemplateComposer({
        runtime: runtime
    });
    return new Project({
        composer: composer,
        runtime: runtime
    });
}

describe("portalNavigationProducer", function(){
    var project;
    var runtime;
    var testsProjectDirPath = path.join(__dirname, "../projects/sample");
    beforeEach(function(){
        project = newProject(testsProjectDirPath);
        runtime = project.runtime;
    });
    it("", function(){
        expect(typeof pnp.generateNavigation(project)).toBe("object");
    });
});