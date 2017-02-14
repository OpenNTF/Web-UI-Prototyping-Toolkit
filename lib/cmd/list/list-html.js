"use strict";

/**
 *
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listProjectTemplatePaths();
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
        title: "All HTML Files - Protostar",
        pageTitle: "All HTML Files"//,
        //pageSubtitle: 'Protostar'
    }, rc.response);
};
module.exports.label = 'List All HTML Files';
module.exports.description = 'Lists all HTML files that are part of the project, excluding any below a bower directory or named path';
