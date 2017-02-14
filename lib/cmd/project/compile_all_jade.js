"use strict";

var jadeUtils = require("../../jadeUtils");

/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var jtp = rc.project.listProjectJadeTemplatePaths();
    jadeUtils.compileTemplatesToFiles(jtp);
    return {
        status: 302,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Location": "/"
        }
    };
};
module.exports.label = 'Compile All Jade';
module.exports.description = 'Creates an HTML file for each JADE file found in the project';