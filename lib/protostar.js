var runtime = require("./runtime");
var utils = require("./utils");
var protostardust = require("./protostardust");
var portalThemeMerger = require("./portalThemeMerger");
var templateComposer = require("./templateComposer");
var protostarProject = require("./protostarProject");
var protostarBuilder = require("./protostarBuilder");
var path = require("path");


var parseCommandLineArgs = function () {
    //todo: modes workspace,prodserver,..
    //var cmdArgs = this.cmdLineArgs;

    var o = {};
    ///**
    // * @type {String}
    // */
    //o.workingDir = process.cwd();
    ///**
    // * @type {String[]}
    // */
    //o.fullCommandLineArgs = [].concat(process.argv);
    console.log("Launching with args: ", process.argv)
    ///**
    // * @type {String}
    // */
    //o.nodeCommandPath = path.normalize(o.fullCommandLineArgs[0]);
    console.info("node path = " + process.argv[0]);

    ///**
    // * @type {String}o
    // */
    //o.protostarScriptPath = path.normalize(o.fullCommandLineArgs[1]);
    //console.info("protostar script path = " + o.fullCommandLineArgs[1]);
    /**
     * @type {String}
     */
    o.protostarDirPath = path.join(__dirname, "..");

    var cmdArgs = process.argv.slice(2);

    var argCount = cmdArgs.length;

    var firstArg = cmdArgs[0];
    switch (firstArg) {
        case 'help':


            o.mode = 'help';
            o.helpMessage = 'Usage: protostar <command> <args>\n' +
                'Following commands are available:\n' +
                'protostar help                                    Displays this help\n' +
                'protostar dev <projectDir>                        Starts the Protostar development environment with the project directory at <projectDir>\n' +
                'protostar build <projectDir> <targetDir>          Creates a prebuilt version of the project located at directory <projectDir> at given <targetDir>\n' +
                'protostar create <templateName> <newProjectDir>   Creates a new project directory at <newProjectDir> using passed <templateName>';

            break;
        case 'create':

            o.mode = 'create',
                o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]),
                o.projectTemplate = cmdArgs.length > 2 ? cmdArgs[2] : 'default';

            break;
        case 'dev':
        case 'prod':
            if (argCount === 3) {
                var portArg = cmdArgs[2];
                if (parseInt(portArg, 10) == portArg) {
                    //this.port = parseInt(portArg, 10);
                    console.info("Setting port to " + portArg);
                    o.mode = "devserver";
                    o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
                    o.port = parseInt(portArg, 10);
                } else {
                    throw new Error("Illegal port argument provided; try 'protostar <projectDir> <portnumber>' or 'protostar <projectDir>' port passed:" + portArg);
                }
            } else {
                o.mode = "devserver";
                o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
            }
            break;
        case 'build':
            o.mode = 'build';
            o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
            o.targetDirPath = utils.normalizePathCmdLine(cmdArgs[2]);
            break;
        case 'mergeStatic':
            o.mode = 'mergeStatic';
            o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
            o.targetDirPath = utils.normalizePathCmdLine(cmdArgs[2]);
            break;

        case 'merge':
            o.mode = 'merge';
            o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
            o.themeDirPath = utils.normalizePathCmdLine(cmdArgs[2]);
            o.targetDirPath = utils.normalizePathCmdLine(cmdArgs[3]);
            break;
        default:
            // old way of invoking
            if (argCount === 3) {
                if (cmdArgs[0] === 'build') {
                    o.model = 'build';
                    o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
                    o.targetDirPath = utils.normalizePathCmdLine(cmdArgs[2]);

                } else {
                    console.error("CANNOT PARSE: ", process.argv);
                    throw new Error("cannot parse");
                }
            } else if (argCount === 1 || argCount === 2) {
                if (argCount === 2) {
                    if (parseInt(cmdArgs[1], 10) == cmdArgs[1]) {
                        console.info("Setting port to " + cmdArgs[1]);
                        o.mode = 'devserver';
                        o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[0]);
                        o.port = parseInt(cmdArgs[1], 10);
                    } else {
                        throw new Error("Illegal port argument provided; try 'protostar <projectDir> <portnumber>' or 'protostar <projectDir>' port passed:" + cmdArgs[1]);
                    }
                } else {
                    o.mode = 'devserver';
                    o.projectDirPath = utils.normalizePathCmdLine(cmdArgs[0]);

                }
            } else {
                throw new Error("Please launch protostar properly: 'protostar <projectDir>' or 'protostar <projectDir> <port>'");

            }
            break;
    }
    console.log("Parsed cmdline args: ", o);
    return o;
    //this.launchServer = this.mode === 'devserver';
};

module.exports = {
    /**
     *
     * @param {String[]} args
     * @return {ProtostarRuntime}
     */
    createRuntime: function () {
        //var defaultArgs = {
        //    workingDir: process.cwd(), args: process.argv, debug: false
        //};
        var parsed = parseCommandLineArgs(process.argv.slice(2));
        //console.log("parsed cmdline args: ", parsed);
        //var a = args;
        //if (!a) {
        //    a = defaultArgs;
        //}
        var rt = runtime.createRuntime(parsed);
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
            runtime: rt
        });
        var project = protostarProject.createProject({
            runtime: rt,
            composer: composer
        });
        var done = false;
        portalThemeMerger.merge({
            targetDir: rt.getTargetDirPath(),
            projectPath: rt.constructProjectPath('.'),
            themePath: rt.getThemeDirPath(),
            runtime: rt,
            composer: composer,
            project: project
        }).then(function () {
            console.log("merge success");
            done = true;
        }, function () {
            console.error("merge fail :(", arguments);
            done = true;
        }).catch(function (errors) {
            console.error("merge error ::: ", errors);
            done = true;
        });
    },
    /**
     *
     * @param {ProtostarRuntime} rt
     */
    mergeStaticFiles: function (rt) {
        var composer = templateComposer.createTemplateComposer({
            runtime: rt
        });
        var project = protostarProject.createProject({
            runtime: rt,
            composer: composer
        });
        var done = false;
        portalThemeMerger.mergeStatic({
            targetDir: rt.getTargetDirPath(),
            projectPath: rt.constructProjectPath('.'),
            runtime: rt,
            composer: composer,
            project: project
        }).then(function () {
            console.log("merge success");
            done = true;
        }, function () {
            console.error("merge fail :(", arguments);
            done = true;
        }).catch(function (errors) {
            console.error("merge error ::: ", errors);
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