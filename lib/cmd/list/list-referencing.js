"use strict";

/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listPathsWithReferences();
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
        title: "Fragments With References - Protostar",
        pageTitle: "Fragments With References"//,
        //pageSubtitle: 'Protostar'
    }, rc.response);
};
module.exports.label = 'List Fragments With References';
module.exports.description = 'Lists all fragments that include/refer to other files/fragments (eg a file: tag or ..)';