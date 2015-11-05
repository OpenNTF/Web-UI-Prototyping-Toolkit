"use strict";

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listAllReferencedPaths();
    files.sort();
    var hp = rc.project.htmlProducer;
    var out = hp.createListingMarkup(files) + rc.project.readViewScriptsMarkup();
    rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdListReferenced.html');
    rc.response.end();
};
module.exports.label = 'List Referenced Fragments';
module.exports.description = 'Lists all fragments that are referred to from other files (eg included into, a layout, as content for a layout droppoint etc)';