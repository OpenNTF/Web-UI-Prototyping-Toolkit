var runtime = require("./runtime");
var protostardust = require("./protostardust");
var portalThemeMerger = require("./portalThemeMerger");
var templateComposer = require("./templateComposer");
var protostarProject = require("./protostarProject");
var protostarBuilder = require("./protostarBuilder");
var path = require("path");

module.exports = {
    /**
     *
     * @param {String[]} args
     * @return {ProtostarRuntime}
     */
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
    /**
     *
     * @param {ProtostarRuntime} rt
     */
    buildProject: function (rt) {
        var buildHelper = protostardust.createServer({
            runtime: rt
        });
        buildHelper.buildPrototype(rt.targetDirPath, function () {
            console.log("BUILT " + rt.constructProjectPath("") + " => " + rt.getTargetDirPath());
        });
    },
    /**
     *
     * @param {ProtostarRuntime} rt
     */
    mergeWithPortalTheme: function (rt) {
        var composer = templateComposer.createTemplateComposer({
            runtime : rt
        });
        var project = protostarProject.createProject({
            runtime:rt,
            composer:composer
        });
        var done = false;
        portalThemeMerger.merge({
            targetDir : rt.getTargetDirPath(),
            projectPath : rt.constructProjectPath('.'),
            themePath : rt.getThemeDirPath(),
            runtime:rt,
            composer:composer,
            project:project
        }).then(function(){
            console.log("merge success");
            done = true;
        }, function(){
            console.error("merge fail :(", arguments);
            done = true;
        }).catch(function(errors){
            console.error("merge error ::: ",errors);
            done = true;
        });
    },
    /**
     *
     * @param {ProtostarRuntime} rt
     */
    mergeStaticFiles: function (rt) {
        var composer = templateComposer.createTemplateComposer({
            runtime : rt
        });
        var project = protostarProject.createProject({
            runtime:rt,
            composer:composer
        });
        var done = false;
        portalThemeMerger.mergeStatic({
            targetDir : rt.getTargetDirPath(),
            projectPath : rt.constructProjectPath('.'),
            runtime:rt,
            composer:composer,
            project:project
        }).then(function(){
            console.log("merge success");
            done = true;
        }, function(){
            console.error("merge fail :(", arguments);
            done = true;
        }).catch(function(errors){
            console.error("merge error ::: ",errors);
            done = true;
        });
    },
    /**
     *
     * @param {ProtostarRuntime} rt
     */
    startProject: function (rt) {
        var helper = protostardust.createServer({
            runtime: rt
        });
        helper.start();
    },
    /**
     *
     * @param {ProtostarRuntime} rt
     */
    createProject: function (rt) {
        var helper = protostardust.createServer({
            runtime: rt
        });
        helper.createProject();
    }
};