var protostarBuilder = require("../lib/protostarBuilder");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
var protostarProject = require("../lib/protostarProject");
var templateComposer = require("../lib/templateComposer")
describe("protostarBuilder", function(){
    it("should finish all threads first before exiting..", function(done){
        var runtime = testUtils.createTestRuntime("/home/spectre/Projects/protostar-projects/dsv-prototype/src");
        var composer = templateComposer.createTemplateComposer({
            runtime : runtime
        });
        var project = protostarProject.createProject({
            runtime:runtime,
            composer:composer
        });

        var targetDir = "/tmp/psBuildTest_" + (new Date().getTime());
        var builder = protostarBuilder.createBuilder({
            runtime : runtime,
            project : project,
            composer :composer,
            targetDir : targetDir,
            ignoreExcludeFromBuild : false
        });
        builder.createZipBuild(targetDir, function(zip, targetDir, dirName){
            expect(utils.getObjectType(zip.getEntry("mydsv.css"))).not.toBe("Null");
            done();
        });
    });
});