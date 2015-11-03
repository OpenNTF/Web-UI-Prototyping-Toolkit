"use strict";

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listProjectTemplatePaths();
    files.sort();
    var hp = rc.project.htmlProducer;
    var out = hp.createListingMarkup(files) + rc.project.readViewScriptsMarkup();
    rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdList.html');
    rc.response.end();
};
module.exports.label = 'List All HTML Files';
module.exports.description = '';