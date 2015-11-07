"use strict";
var path = require("path");
var fs = require("fs");
module.exports = {};
var portalTooling = module.exports;

var dxsyncRequiredConfigProperties = [
    "username",
    "password",
    "contenthandlerPath",
    "host",
    "secure",
    "port",
    "theme"
];

portalTooling.validateThemeSyncDirSettings = function(dirPath){
    var dxsCfgPath = path.resolve(dirPath, ".settings");
    var missingFields = [];
    var messages = [];
    if(fs.existsSync(dxsCfgPath)){
        var dxsCfg = JSON.parse(fs.readFileSync(dxsCfgPath, "utf8"));
        dxsyncRequiredConfigProperties.forEach(function(field){
                if(!dxsCfg.hasOwnProperty(field) || (typeof dxsCfg[field]!== 'string' && typeof dxsCfg[field] !== 'boolean') || dxsCfg[field].length < 1){
                    missingFields.push(field);
                }
            });
        if(missingFields.length > 0){
            var msg = "Missing config properties on " + dxsCfgPath + ": " + missingFields.join(", ");
            messages.push(msg);
        }
    }else{
        messages.push("There is not settings file at " + dxsCfgPath);
    }
    if(messages.length > 0){
        return {
            ok : false,
            messages : messages,
            missingFields: missingFields,
            dir : dirPath
        };
    }else{
        return {
            ok: true,
            dir: dirPath
        };
    }
};

var runDxSyncCommand = function(dxSyncDir, cmd, dxsyncPath, cb){
    var dirVal = portalTooling.validateThemeSyncDirSettings(dxSyncDir);
    if(!dirVal.ok){
        console.error("Dir with invalid theme sync config passed: " + dxSyncDir, dirVal);
        cb(dirVal, dxSyncDir);
        return;
    }
    var env = process.env;
    env.PATH += ":" + path.dirname(process.argv[0]);
    var exec = require('child_process').exec;
    var command = dxsyncPath + " " + cmd;
    console.log("Running " + command + " from dir " + dxSyncDir + "...");
    exec(command, {
        cwd: dxSyncDir
    }, function(error, stdout, stderr) {
        console.log("ran "+cmd+" command : " + command);
        console.log("stdout: " + stdout);
        console.log("stderr: " + stderr);
        if(error){
            console.error("Failed! ", error);
            cb(error, dxSyncDir, stdout, stderr);
        }else{
            console.info("Success: " + stdout);
            cb(undefined, dxSyncDir, stdout, stderr);
        }
    });
};

portalTooling.pushThemeDirToWebDav = function(dxSyncDir, dxsyncPath, cb){
    runDxSyncCommand(dxSyncDir, 'push', dxsyncPath, cb);
};

portalTooling.pullThemeFromWebDavToDir = function(dxSyncDir, dxsyncPath, cb){
    runDxSyncCommand(dxSyncDir, 'pull', dxsyncPath, cb);
};
/**
 *
 * @param {Project} project
 */
portalTooling.isDefaultPortalConfigured= function(project){

};

/**
 * @param {Project} project
 */
portalTooling.isDxSyncPathConfigured= function(project){
    var userCfg = project.runtime.readUserConfig();
    return userCfg.hasOwnProperty("dxSyncPath") && fs.existsSync(userCfg["dxSyncPath"]);
};



/**
 * @param {Project} project
 */
portalTooling.isScriptPortletPushPathConfigured= function(project){
    var userCfg = project.runtime.readUserConfig();
    return userCfg.hasOwnProperty("scriptPortletPushPath") && fs.existsSync(userCfg["scriptPortletPushPath"]);
};

portalTooling.createDownloadStaticThemeFilesFromWebDavURL= function(){

};

portalTooling.isProjectDefaultPortlalConfigured = function(){

};

/**
 * @param {Project} project
 */
portalTooling.isThemeSyncDirConfigured = function(project){
    var pcfg = project.runtime.readProjectConfig();
    return pcfg.hasOwnProperty("dxSyncDir") && fs.existsSync(pcfg["dxSyncDir"]);
};

/**
 * @param {Project} project
 */
portalTooling.getThemeSyncDirPath = function(project){
    var pcfg = project.runtime.readProjectConfig();
    if(!pcfg.hasOwnProperty("dxSyncDir")){
        throw new Error("dxSyncDir path is not provided for project " + project.runtime.projectDirPath);
    }
    return pcfg["dxSyncDir"];
};

/**
 * @param {Project} project
 */
portalTooling.getDxSyncExecutablePath = function(project){
    var cfg = project.runtime.readUserConfig();
    if(!cfg.hasOwnProperty("dxSyncPath")){
        throw new Error("dxSyncPath path is not in config " + project.runtime.configPath);
    }
    return cfg["dxSyncPath"];
};

/**
 * @param {Project} project
 */
portalTooling.getScriptPortletPushExecutablePath = function(project){
    var cfg = project.runtime.readUserConfig();
    if(!cfg.hasOwnProperty("scriptPortletPushPath")){
        throw new Error("scriptPortletPushPath path is not in config " + project.runtime.configPath);
    }
    return cfg["scriptPortletPushPath"];
};


portalTooling.isScriptPortletPushConfigured = function(){

};

portalTooling.getWebDavThemePushConfig = function(){

};

portalTooling.getScriptPortletPushConfig = function(){

};

portalTooling.getAllScriptPortletConfigs = function(){

};

portalTooling.listScriptPortlets= function(){

};

portalTooling.listRemoteScriptPortlets= function(){

};

portalTooling.pullScriptPortletToDir = function(){

};

portalTooling.pushScriptPortletFromDir = function(){

};

portalTooling.isPortalRunning = function(){

};
