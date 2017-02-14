"use strict";

/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listAllReferencedPaths();
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
        title: "Referenced Fragments - Protostar",
        pageTitle: "Referenced Fragments"//,
        //pageSubtitle: 'Protostar'
    }, rc.response);
};
module.exports.label = 'List Referenced Fragments';
module.exports.description = 'Lists all fragments that are referred to from other files (eg included into, a layout, as content for a layout droppoint etc)';