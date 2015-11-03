var screenies = require("./screenies");
var portalThemeImporter = require("./portalThemeImporter");
var url = require("url");
var os = require("os");
var path = require("path");
var mime = require('mime');
var fsops = require("fsops");
var fs = require("./filesystem");
var _fs = require("fs");
var jqueryRunner = require("./jqueryRunner");
var templateComposer = require("./templateComposer");
var utils = require("./utils");
var cheerio = require("cheerio");
var copier = require("./copier");
var markdownHelper = require("./markdownHelper");
var sassCompiler = require("./sassCompiler");
var portalNavGen = require("./portalNavigationProducer");
var jadeUtils = require("./jadeUtils");
var wcmTagParser = require("./wcmTagParser");
var logger = utils.createLogger({sourceFilePath: __filename});
var writeBinaryResponse = utils.writeBinaryResponse;
var writeResponse = utils.writeResponse;
var enableFileCaching = false;
var http = require("http");
var hbsUtils = require("./hbsUtils");
var stream = require("stream");
var zlib = require("zlib");
function createHandlers(args) {
    /**
     * @type {templateComposer.TemplateComposer}
     */
    var composer = args.composer;
    var serversideLessCompiler = args.sslc;
    /**
     * @type {ProtostarRuntime}
     */
    var runtime = args.runtime;
    /**
     * @type {Project}
     */
    var project = args.project;
    var projectCommands = args.projectCommands;
    var allowedThemeReqs = args.allowedThemeReqs;

    var handlers = {

    };

    return handlers;
}
module.exports = {
    createHandlers: createHandlers,
    writeResponse: writeResponse,
    writeBinaryResponse: writeBinaryResponse
};