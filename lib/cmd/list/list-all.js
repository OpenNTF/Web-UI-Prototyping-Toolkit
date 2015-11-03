"use strict";
/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listAllTemplatePaths();
    var hp = rc.project.htmlProducer;
    var out = hp.createListingMarkup(files) + rc.project.readViewScriptsMarkup();
    rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdListAll.html');
    rc.response.end();
};
module.exports.label = "List Pages";
module.exports.description = "Lists all fragments that compile to HTML and represent full pages (eg. compiled output includes an html tag)";