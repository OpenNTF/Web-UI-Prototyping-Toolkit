var path = require("path");
var protostarBuilder = require("../lib/protostarBuilder");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
var protostarProject = require("../lib/protostarProject");
var templateComposer = require("../lib/templateComposer")
var fs = require("fs");
var originalTimeout;
if(false)
describe("protostarBuilder", function(){
    beforeEach(function() {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
    });

    it("should finish all threads first before exiting..", function(done){
        var sampleProjectPath = path.join(__dirname, "../projects/sample")
        var runtime = testUtils.createTestRuntime(sampleProjectPath);
        var targetDir = "/tmp/psBuildTest_" + (new Date().getTime());
        runtime.targetDirPath = targetDir;
        runtime.targetDir = targetDir;
        var composer = new (templateComposer.TemplateComposer)({
            runtime : runtime
        });
        var project = new protostarProject.Project({
            runtime:runtime,
            composer:composer
        });

        var builder = protostarBuilder.createBuilder({
            runtime : runtime,
            project : project,
            composer :composer,
            targetDir : targetDir,
            ignoreExcludeFromBuild : false
        });

        builder.createZipBuild(function(zipFilePath, targetDir, dirName){
            console.log("Wrote zip to " + zipFilePath);
            console.log("dirName = "+ dirName);

            expect(fs.existsSync(zipFilePath)).toBe(true);
            fs.unlinkSync(zipFilePath);
            done();
        }, function(error){
            console.error("BUILD ERRORS", error.stack);
            done();
        });
    });
});