"use strict";
/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listAllTemplatePaths();
    files.sort();
    var links = [];
    files.forEach(function (fd) {
        var fileUrl = rc.runtime.createUrlPathForFile(fd);
        var displayPath = rc.runtime.createHtmlFileDisplayName(fd);
        links.push({
            pathname: fileUrl,
            label: displayPath.split("/").join(" / ") + '.html',
            target: "project"
        });
    });
    rc.composer.renderListingMarkup(links, {
        title: "All Pages - Protostar",
        pageTitle: "All Pages"
    }, rc.response);

};
module.exports.label = "List Pages";
module.exports.description = "Lists all fragments that compile to HTML and represent full pages (eg. compiled output includes an html tag)";