var runtime = require("./runtime");
var protostardust = require("./protostardust");
var portalThemeMerger = require("./portalThemeMerger");
var templateComposer = require("./templateComposer");
var protostarProject = require("./protostarProject");
var protostarBuilder = require("./protostarBuilder");
var path = require("path");

module.exports = {
    createRuntime: function (args) {
        var defaultArgs = {
            workingDir: process.cwd(), args: process.argv, debug: false
        };
        var a = args;
        if (!a) {
            a = defaultArgs;
        }
        var rt = runtime.createRuntime(a);
        return rt;
    },
    buildProject: function (rt) {
        var buildHelper = protostardust.createServer({
            runtime: rt
        });
        buildHelper.buildPrototype(rt.targetDirPath, function () {
            console.log("BUILT " + rt.constructProjectPath("") + " => " + rt.getTargetDirPath());
        });
    },
    mergeWithPortalTheme: function (rt) {
        //rt.targetDirPath = rt.getTargetDirPath();
        //rt.targetDir = rt.getTargetDirPath();
        //var server = protostardust.createServer({
        //    runtime: rt
        //});

        //buildHelper.buildPrototype(rt.targetDirPath, function () {
        //    console.log("BUILT " + rt.constructProjectPath("") + " => " + rt.getTargetDirPath());
        //});

        var composer = templateComposer.createTemplateComposer({
            runtime : rt
        });

        var project = protostarProject.createProject({
            runtime:rt,
            composer:composer
        });

        //var builder = protostarBuilder.createBuilder({
        //    runtime : rt,
        //    project : project,
        //    composer :composer,
        //    targetDir : rt.getTargetDirPath() + path.sep + "/build",
        //    ignoreExcludeFromBuild : false
        //});



        portalThemeMerger.merge({
            targetDir : rt.getTargetDirPath(),
            projectPath : rt.constructProjectPath('.'),
            themePath : rt.getThemeDirPath(),
            runtime:rt,
            composer:composer,
            project:project
        }).then(function(){
            console.log("merge success");
        }).catch(function(){
            console.error("merge error ::: ",errors);
        });

    },
    startProject: function (rt) {
        var helper = protostardust.createServer({
            runtime: rt
        });
        helper.start();
    }, createProject: function (rt) {
        var helper = protostardust.createServer({
            runtime: rt
        });
        helper.createProject();
        // create dir
        // create index.html with backend stuff
        // create prototype.json with defaults
    }
};