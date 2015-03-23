var runtime = require("./runtime");
var protostardust = require("./protostardust");

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
    }, buildProject: function (rt) {
        var buildHelper = protostardust.createServer({
            runtime: rt
        });
        buildHelper.buildPrototype(rt.targetDirPath, function () {
            console.log("BUILT " + rt.constructProjectPath("") + " => " + rt.getTargetDirPath());
        });
    }, startProject: function (rt) {
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