"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var viewHelp = function (rc) {
    var mdPath = runtime.constructAppPath("README.md");
    var mdContents = markdownHelper.createTableOfContents(runtime.readFile(mdPath) + "");
    var mdMarkup = markdownHelper.compileMarkdown(mdContents);
    var wrapper = '<!-- wrap:/ps/backend/layout-help -->\n';
    var helpPath = runtime.constructAppPath(["core", "backend", "help.html"]);
    runtime.writeFile(helpPath, mdMarkup);
    var dropPoints = composer.findAllDropPoints(helpPath, mdMarkup, runtime.userConfig.dropPointTypes);
    dropPoints.sort(function (a, b) {
        return -1 * (a.start - b.start);
    });
    var helpContent = mdMarkup;
    dropPoints.forEach(
        /**
         *
         * @param {utils.Placeholder} dp
         */
        function (dp) {
            //noinspection JSUnresolvedFunction
            helpContent = composer.replacePartContents(helpContent, dp, '<pre><code>' + utils.encodeHtmlEntities(dp.getTag())) + '</code></pre>';
        });
    helpContent = wrapper + helpContent;
    runtime.writeFile(helpPath, helpContent);
    var composed = composer.composeTemplate(helpPath, helpContent);
    writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
};
module.exports = viewHelp;