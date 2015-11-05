"use strict";

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listPathsWithReferences();
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
module.exports.label = 'List Referencing Bare';
module.exports.description = 'Returns <li> tags with links to the paths that include/reference other fragments';
module.exports.noMenu = true;