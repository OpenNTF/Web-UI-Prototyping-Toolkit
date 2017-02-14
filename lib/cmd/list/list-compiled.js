"use strict";

/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listCompiledTemplatePaths();
    //var files = rc.project.listProjectTemplatePaths();
    files.sort();
    var links = [];
    files.forEach(function (fd) {
        var fileUrl = rc.runtime.createUrlPathForFile(fd);
        var displayPath = rc.runtime.createHtmlFileDisplayName(fd).split("/").join(" / ");
        links.push({
            pathname: fileUrl,
            label: displayPath + '.html',
            target: "project"
        });
    });

    rc.composer.renderListingMarkup(links, {
        title: "Compiled Pages - Protostar",
        pageTitle: "Compiled pages"//,
        //pageSubtitle: 'Protostar'
    }, rc.response);

};
module.exports.label = 'List Compiled Pages';
module.exports.description = 'Lists all paths of HTML files that are the result of Compile All Pages command (fully composed HTML pages)';