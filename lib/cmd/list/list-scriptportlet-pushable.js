"use strict";

var path = require("path");
var copier = require("copier");

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var userCfg = rc.runtime.readUserConfig();
    if(!userCfg.hasOwnProperty("scriptPortletPushPath") || !rc.runtime.isExistingFilePath(userCfg["scriptPortletPushPath"])){
        var msg = "Script Portal push : missing property scriptPortletPushPath on " + rc.runtime.configPath + " or does not point to an existing file";
        console.error(msg);

        rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
        rc.response.end();
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
    dirsWithSpConfigFiles.forEach(function(f){
        menu+='<li><a href="/?command=push-scriptportlet-dir&dir='+f+'">'+f+'</a></li>';
    });
    var out = '<div class="row"><ul>' + menu + "</ul></div>" + rc.project.readViewScriptsMarkup();
    rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdList.html');
    rc.response.end();
};