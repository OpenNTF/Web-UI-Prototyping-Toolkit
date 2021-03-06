"use strict";

/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listCompiledTemplatePaths();
    files.sort();
    var hp = rc.project.htmlProducer;
    var out = hp.createBareListingEntriesMarkup(files) + rc.project.readViewScriptsMarkup();
    return {
        status: 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8"
        },
        content: out
    };
};
module.exports.label = 'Generate bare listing';
module.exports.description = '';
module.exports.noMenu = true;