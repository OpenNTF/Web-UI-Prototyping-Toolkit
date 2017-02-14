"use strict";
var path = require("path");
var copier = require("../../copier");
var portalTooling = require("../../portalTooling");


/**
 *
 * @param {RequestContext} rc
 */
module.exports= function (rc) {
    if(!portalTooling.isScriptPortletPushPathConfigured(rc.project)){
            var msg = "Script Portal push : missing property scriptPortletPushPath on " + rc.runtime.configPath + " or does not point to an existing file";
            console.error(msg);
            rc.composer.renderNewBackendView(msg, {
                title: 'Error - Script Portlet Push Not Configured - Protostar',
                pageTitle: 'Error',
                pageSubtitle: 'Script Portlet Push Not Configured'
            }, rc.response);
            return ;
    }
    var dirsWithSpConfigFiles = portalTooling.listProjectScriptPortletDirs(rc.runtime.projectDirPath);

    var menu = "";
    var links = [];
    dirsWithSpConfigFiles.forEach(function(f){
        menu+='<li><a href="/?command=push-scriptportlet-dir&dir='+f+'">'+f+'</a></li>';
        links.push({
            pathname: '/?command=push-scriptportlet-dir&dir=' + f,
            label: f,
            target: "ux"
        });
    });
    rc.composer.renderListingMarkup(links, {
        title: "Configured Script Portlets - Protostar",
        pageTitle: "Script Portlets",
        pageSubtitle: 'Pushable component directories'
    }, rc.response);
};
module.exports.label = 'List Script Portlets';
module.exports.description = 'Lists all directories that contain a file named sp-config.json';