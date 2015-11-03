"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var viewProjectConfig = function (rc) {
    var wrapper = '<!-- wrap:/ps/backend/layout-help -->\n';
    var editConfigView = runtime.constructAppPath(["core", "backend", "projectConfigCompiled.html"]);
    var editConfigContent = runtime.readFile(runtime.constructAppPath(["core", "assets", "projectConfig.html"]));
    var helpContent = wrapper + editConfigContent;
    runtime.writeFile(editConfigView, helpContent);
    var composed = composer.composeTemplate(editConfigView, helpContent);
    writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
};
module.exports = viewProjectConfig;