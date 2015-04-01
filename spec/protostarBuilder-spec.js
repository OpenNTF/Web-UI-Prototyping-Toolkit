var path = require("path");
var protostarBuilder = require("../lib/protostarBuilder");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
var protostarProject = require("../lib/protostarProject");
var templateComposer = require("../lib/templateComposer")
var originalTimeout;

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
        var composer = templateComposer.createTemplateComposer({
            runtime : runtime
        });
        var project = protostarProject.createProject({
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

        builder.createZipBuild(function(zip, targetDir, dirName){
            console.log("TARGET DIR = "+ targetDir)
            console.log("dirName = "+ dirName);
            zip.writeZip(targetDir + ".zip");
            var foundCss = false;
            zip.getEntries().forEach(function(e){
                console.log(e.name);
                if(e.name.toString() === 'styles.less-readable.css'){
                    foundCss = true;
                }
            });
            expect(foundCss).toBe(true);
            done();
        }, function(error){
            console.error("BUILD ERRORS", error.stack);
            done();
        });
    });
});