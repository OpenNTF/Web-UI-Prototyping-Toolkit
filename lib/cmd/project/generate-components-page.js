"use strict";

var url = require("url");
var path = require("path");
var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var componentDirsTxt = rc.wr.getQueryParam("componentDirs") || false;
    if (!componentDirsTxt) {
        logger.error("No componentDirs argument passed= " + rc.request.url);
        return {
            status: 406,
            headers: {
                "Content-Type": "text/plain"
            },
            content: "Missing componentDirs request argument, eg. componentDirs=components,portlets"
        };
    } else {
        var dirs = [componentDirsTxt];
        if (componentDirsTxt.indexOf(',') > 0) {
            dirs = componentDirsTxt.split(',');
        }
        var paths = [];
        dirs.forEach(function (dir) {
            var pd = rc.project.resolveProjectFile(dir);
            var templatePaths = rc.project.listProjectTemplatePaths(pd);
            templatePaths.forEach(function (tp) {
                paths.push(tp);
            });
        });
        paths.sort();
        var parentDivClasses = rc.wr.getQueryParam("parentDivClasses") || "col-md-6";
        var out = "";
        paths.forEach(function (p) {
            logger.info("Processing ", p);
            var composed = rc.composer.composeTemplate(path.basename(p), rc.runtime.readFile(p));
            out += '<div class="' + parentDivClasses + '">' + composed.content + '</div>';
        });
        rc.project.writeDynamicFile('components-page.html', out);
        return {
            status: 302,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Location": "/components-generated.html"
            },
            content: out
        };
    }
};
module.exports.label = 'Generate component page';
module.exports.description = '';
module.exports.noMenu = true;
module.exports.window = 'project';