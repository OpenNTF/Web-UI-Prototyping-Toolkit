"use strict";

var jadeUtils = require("../../jadeUtils");

/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var jtp = rc.project.listProjectJadeTemplatePaths();
    var deleted = jadeUtils.deleteCompiledFilesForTemplates(jtp);
    return {
        status: 302,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Location": "/"
        }
    };
};
module.exports.label = 'Delete Compiled JADE';
module.exports.description = 'Deletes HTML files that are the result of compiling JADE';