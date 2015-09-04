var path = require("path");
//var protostarBuilder = require("../lib/protostarBuilder");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
var protostarProject = require("../lib/protostarProject");
var templateComposer = require("../lib/templateComposer");
var protostarBuilder = require("../lib/protostarBuilder");
var portalThemeMerger = require("../lib/portalThemeMerger");
var originalTimeout;

//if(false)
describe("portalThemeMerger", function(){
    beforeEach(function() {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
    });

    it("can run", function(done){
        var dsvPrototypePath = '/home/spectre/Projects/IBM/DSV/mydsv-protostar/mydsv';
        var dsvThemePath = '/home/spectre/Projects/IBM/DSV/angularTheme';

        //var sampleProjectPath = path.join(__dirname, "../projects/sample")
        var runtime = testUtils.createTestRuntime(dsvPrototypePath);
        var targetDir = "/tmp/psMergeThemeTest_" + (new Date().getTime());
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

        portalThemeMerger.merge({
            targetDir : targetDir,
            projectPath : dsvPrototypePath,
            themePath : dsvThemePath,
            runtime:runtime,
            composer:composer,
            project:project,
            builder:builder
        }).then(function(){
            console.log("success");
            done();
        }).catch(function(){
            console.log("error ::: ",errors);
            done();
        });


        //builder.createZipBuild(function(zip, targetDir, dirName){
        //    console.log("TARGET DIR = "+ targetDir)
        //    console.log("dirName = "+ dirName);
        //    zip.writeZip(targetDir + ".zip");
        //    var foundCss = false;
        //    zip.getEntries().forEach(function(e){
        //        console.log(e.name);
        //        if(e.name.toString() === 'styles.less-readable.css'){
        //            foundCss = true;
        //        }
        //    });
        //    expect(foundCss).toBe(true);
        //    done();
        //}, function(error){
        //    console.error("BUILD ERRORS", error.stack);
        //    done();
        //});
    });
});