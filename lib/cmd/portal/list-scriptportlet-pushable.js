"use strict";
var path = require("path");
var copier = require("../../copier");


/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {

    var userCfg = rc.runtime.readUserConfig();
    var projectCfg = rc.runtime.readProjectConfig();

    if(!userCfg.hasOwnProperty("scriptPortletPushPath") || !rc.runtime.isExistingFilePath(userCfg["scriptPortletPushPath"])){
        var msg = "Script Portal push : missing property scriptPortletPushPath on " + rc.runtime.configPath + " or does not point to an existing file";
        console.error(msg);
        rc.composer.renderNewBackendView(msg, {
            title: 'Error - Script Portlet Push Not Configured - Protostar',
            pageTitle: 'Error',
            pageSubtitle: 'Script Portlet Push Not Configured'
        }, rc.response);
        return ;
    }
    var projectDir = rc.runtime.constructProjectPath("");
    var dirsWithSpConfigFiles = copier.listDirChildrenFullPathsRecursively(projectDir).filter(function(p){
        return path.basename(p) === 'sp-config.json';
    }).map(function(p){
        return path.dirname(p).substring(projectDir.length +1);
    });
    dirsWithSpConfigFiles.sort();
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