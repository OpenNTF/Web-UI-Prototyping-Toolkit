"use strict";
var url = require("url");
var utils = require("../utils");
var markdownHelper = require("../markdownHelper");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var viewHelp = function (rc) {
    var mdPath = rc.runtime.constructAppPath("README.md");
    var mdContents = markdownHelper.createTableOfContents(rc.runtime.readFile(mdPath) + "");
    var mdMarkup = markdownHelper.compileMarkdown(mdContents);
    var wrapper = '<!-- wrap:/ps/backend/layout-help -->\n';
    var helpPath = rc.runtime.constructAppPath(["core", "backend", "help.html"]);
    rc.runtime.writeFile(helpPath, mdMarkup);
    var dropPoints = rc.composer.findAllDropPoints(helpPath, mdMarkup, rc.runtime.userConfig.dropPointTypes);
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
            helpContent = rc.composer.replacePartContents(helpContent, dp, '<pre><code>' + utils.encodeHtmlEntities(dp.getTag())) + '</code></pre>';
        });
    helpContent = wrapper + helpContent;
    rc.runtime.writeFile(helpPath, helpContent);
    var composed = rc.composer.composeTemplate(helpPath, helpContent);
    utils.writeResponse(rc.response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
};
module.exports = viewHelp;