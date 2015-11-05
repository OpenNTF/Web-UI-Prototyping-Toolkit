"use strict";

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listCompiledTemplatePaths();
    files.sort();
    var hp = rc.project.htmlProducer;
    var out = hp.createListingMarkup(files) + rc.project.readViewScriptsMarkup();
    rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdListCompiled.html');
    rc.response.end();
};
module.exports.label = 'List Compiled Pages';
module.exports.description = 'Lists all paths of HTML files that are the result of Compile All Pages command (fully composed HTML pages)';