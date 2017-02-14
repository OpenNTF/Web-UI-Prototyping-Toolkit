"use strict";
var fs = require("fs");
var path = require("path");
var url = require("url");
var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
var portalTooling = require("../../portalTooling");



/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {

    if(portalTooling.isThemeSyncDirConfigured(rc.project)){
        var tdp = portalTooling.getThemeSyncDirPath(rc.project) + path.sep + ".settings";
        if(fs.existsSync(tdp)){
            var ss = JSON.parse(fs.readFileSync(tdp, 'utf8'));
            var themeName = ss.theme;
            var url = 'http' + (ss.secure ? 's' : '') + '://' + ss.host +':'+ ss.port + ss.contenthandlerPath + '/dav/fs-type1/themes/' + themeName + '?mime-type=application/zip';
            console.log("Theme files url = " + url);
            return {
                status: 302,
                headers: {
                    Location: url
                }
            };
        }else{
            var msg = "There is no dxsync .settings file at " + tdp;
            console.error(msg);
            rc.composer.renderNewBackendView(msg, {
                title: 'Error - Missing DXSync Settings - Protostar',
                pageTitle: 'Error'
            }, rc.response);

        }
    }else{
        var emsg = "dxSyncDir does not exist on " +rc.runtime.configPath+ " or point to a valid directory to use to sync with portal. ";
        console.error(emsg);
        rc.composer.renderNewBackendView(emsg, {
            title: 'Error - dxSyncDir not set - Protostar',
            pageTitle: 'Error'
        }, rc.response);
    }

};
module.exports.label = 'Download static theme files from Portal';
module.exports.description = 'Downloads the current static theme files for the configured theme for sync. Requires an authenticated portal session in your browser.';
