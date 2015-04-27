var pnp = require("../lib/portalNavigationProducer");
var tc = require("../lib/templateComposer");
var fs = require("../lib/filesystem");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
var path = require("path");
var projectFactory = require("../lib/protostarProject");

function newTemplateComposer(projDir){
    var h = tc.createTemplateComposer({
        runtime: testUtils.createTestRuntime(projDir)
    });
    return h;
}

function newProject(projDir){
    var runtime = testUtils.createTestRuntime(projDir);
    var composer = tc.createTemplateComposer({
        runtime: runtime
    });
    return projectFactory.createProject({
        composer: composer,
        runtime: runtime
    });
}

describe("portalNavigationProducer", function(){
    var project;
    var runtime;
    var testsProjectDirPath = path.join(__dirname, "../projects/sample")
    beforeEach(function(){
        project = newProject(testsProjectDirPath);
        runtime = project.runtime;
    });
    it("", function(){
        expect(typeof pnp.generateNavigation(project)).toBe("object");
    });
})