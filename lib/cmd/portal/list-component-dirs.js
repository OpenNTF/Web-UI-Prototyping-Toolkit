"use strict";
var path = require("path");
var copier = require("../../copier");
var portalTooling = require("../../portalTooling");
var utils = require("../../utils");
var fs = require("fs");


/**
 *
 * @param {RequestContext} rc
 */
module.exports= function (rc) {
    var projConfig = rc.runtime.readProjectConfig();
    if (projConfig.hasOwnProperty("componentDirsParent")) {
        var componentDirsParent = projConfig.componentDirsParent;
        var parentDirPath = rc.runtime.projectDirPath + path.sep + componentDirsParent;
        fs.stat(parentDirPath, function (err, stat) {
            if (err) {
                var msg = "Configured componentDirsParent on prototype.json does not exist : " + parentDirPath;
                console.error(msg);
                rc.composer.renderNewBackendView(msg, {
                    title: 'Error - List Component Dirs - Protostar',
                    pageTitle: 'Error',
                    pageSubtitle: 'Incorrect componentDirsParent property on prototype.json'
                }, rc.response);
            } else if (stat.isDirectory()) {
                var cmpDirs = utils.listChildDirectoryPaths(parentDirPath);
                if (cmpDirs.length > 0) {
                    var relCmpDirs = utils.relativize(cmpDirs, rc.runtime.projectDirPath);
                    var links = [];
                    relCmpDirs.forEach(function (f) {
                        links.push({
                            pathname: '/?command=download-component-dir-zip&dir=' + f,
                            label: f,
                            target: "ux"
                        });
                    });
                    rc.composer.renderListingMarkup(links, {
                        title: "List Component Dirs - Protostar",
                        pageTitle: "List Component Dirs"
                    }, rc.response);
                } else {
                    rc.composer.renderNewBackendView("There are no component dirs below " + parentDirPath, {
                        title: 'No component dirs present - List Component Dirs - Protostar',
                        pageTitle: 'No component dirs present',
                        pageSubtitle: 'Incorrect componentDirsParent property on prototype.json'
                    }, rc.response);
                }
            }else{
                var msg = "There is a file at configured componentDirsParent path : " + parentDirPath;
                console.error(msg);
                rc.composer.renderNewBackendView(msg, {
                    title: 'Error - List Component Dirs - Protostar',
                    pageTitle: 'Error',
                    pageSubtitle: 'Incorrect componentDirsParent property on prototype.json'
                }, rc.response);
            }
        });
    } else {
        var msg = "prototype.json does not contain a property componentDirsParent identifying the relative path of the dir containing a subdir per component (with sources that compile to html/js/css)";
        console.error(msg);
        rc.composer.renderNewBackendView(msg, {
            title: 'Error - List Component Dirs - Protostar',
            pageTitle: 'Error',
            pageSubtitle: 'Missing componentDirsParent property on prototype.json'
        }, rc.response);
    }
};
module.exports.label = 'List Component Dirs';
module.exports.description = 'Lists all component directories that can be exported to ZIP for import to a Script';