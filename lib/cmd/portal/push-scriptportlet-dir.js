"use strict";
var fs = require("fs");
var path = require("path");
var url = require("url");
var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
var portalTooling = require("../../portalTooling");
var copier = require("../../copier");
var osTmpdir = require("os-tmpdir");
var renderValidationError = function(portletDir, valOut, rc){
    console.error("Validation of script portlet push config failed for " + portletDir, valOut);
    var msg = "Failed config validation for pushing script portlet dir " + portletDir ;
    valOut.messages.forEach(function(m ,i){
        msg += '<br>Error: ' + m;
    });
    msg += '<br>';
    valOut.missingFields.forEach(function(m ,i){
        msg += '<br>Error: missing proprety on '+ portletDir + path.sep + '.settings : ' + m;
    });
    renderError(msg, "Validation of script portlet push config failed", rc);
};

var renderError = function(msg, errorTitle, rc){
    rc.composer.renderNewBackendView('<strong>'+msg+'</strong>', {
        title: 'Error - Push Script Portlet To Portal - Protostar',
        pageTitle: errorTitle
    }, rc.response);
};


var renderPushResult = function(error, dirPath, stdout, stderr, logFileContents, start, rc){
    var opener;
    var msg;
    var successful;
    if(error){
        console.error("Failed! ", error);
        opener = "Failed :-(";
        msg = "There were errors while executing the push of <br><strong>" + dirPath + "</strong><br>initiated at " + start;
        successful = false;
    }else{
        console.info("Success: " + stdout);
        opener = "Success!";
        msg = "The compiled contents of <br><strong>" + dirPath + "</strong><br>were pushed to the live script portlet instance";
        successful = true;
    }
    var out =
        '<div class="row"><div class="col-md-12">' +
        '<a href="/pscmds" class="btn btn-primary"><span class="glyphicon glyphicon-chevron-left"></span> Home</a>'+

        '<p>'+msg+'</p>'+
        '<p><a class="btn btn-primary" href="/?command=push-scriptportlet-dir&dir='+dirPath+'"><span class="glyphicon glyphicon-repeat"></span> Push '+dirPath +' again</a></p>' +
        (stdout ? '<h3>Console Output</h3><pre><code>'+stdout+'</code></pre>' : '') +
        (stderr ? '<h3>Console Error Output</h3><pre><code>'+stderr+'</code></pre>' : '') +
        '<h3>Logging</h3>'+
        '<pre><code>'+logFileContents+'</code></pre>' +
        '</div></div>';
    rc.project.deleteIntermediaryFiles();
    var ptm = successful ? '<span class="text-success">'+opener+'</span>' : '<span class="text-danger">'+opener+'</span>';
    rc.composer.renderNewBackendView(out, {
        title: opener + ' - Script Portlet Push - Protostar',
        pageTitle: ptm
    }, rc.response);
};

/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
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
    var start = new Date().getTime();
    var dirParameterValue = rc.wr.getQueryParam("dir") || false;
    if(!dirParameterValue) {
        throw new Error("missing directory");
    }
    var projectDir = rc.runtime.projectDirPath;
    var dirPath = path.resolve(projectDir, dirParameterValue);
    if(!rc.runtime.isExistingDirPath(dirPath)){
        throw new Error("Not an existing dir path for " + dirParameterValue + ": " + dirPath);
    }
    var validationResult = portalTooling.validateScriptPortletDirSettings(dirPath);
    if(!validationResult.ok){
        renderValidationError(dirPath, validationResult, rc);
        return;
    }
    var spConfigPath = path.resolve(dirPath, "sp-config.json");
    var spConfig = JSON.parse(fs.readFileSync(spConfigPath, "utf8"));
    var spServer = spConfig["scriptPortletServer"];
    console.log("Script portlet server = " + spServer);
    var host = spServer.substring(spServer.indexOf("//") + 2, spServer.lastIndexOf(":"));
    var port = parseInt(spServer.substring(spServer.lastIndexOf(":") + 1));
    var urlPathname = "/wps/portal";
    portalTooling.isPortalRunning(host, '' + port, urlPathname, function(isRunning){
        if(isRunning){
            console.log("Preparing for script portlet push : " + dirPath);
            var targetDir = osTmpdir() + path.sep + "psComponentPush_" + (new Date().getTime());
            portalTooling.prepareScriptPortletPush(dirPath, targetDir, rc.project, function(err, tmpDir){
                if(err){
                    var msg = "Script Portlet push : the scriptPortletServer defined in sp-config.json file at " + spConfigPath + " is not running : " + spConfig.scriptPortletServer;
                    console.error(msg);
                    rc.composer.renderNewBackendView(msg, {
                        title: 'Error - Portal not running - Protostar',
                        pageTitle: 'Error',
                        pageSubtitle: 'Portal configured in sp-config.json is not running'
                    }, rc.response);
                }else {
                    var spPath = portalTooling.getScriptPortletPushExecutablePath(rc.project);
                    portalTooling.pushScriptPortletFromDir(tmpDir, spPath, function(error, dirPath, stdout, stderr, logFileContents){
                        renderPushResult(error, dirParameterValue, stdout, stderr, logFileContents, start, rc);
                        //copier.deleteRecursively(targetDir);
                    });
                }
            });
        }else{
            var msg = "Script Portlet push : the scriptPortletServer defined in sp-config.json file at " + spConfigPath + " is not running : " + spConfig.scriptPortletServer;
            console.error(msg);
            rc.composer.renderNewBackendView(msg, {
                title: 'Error - Portal not running - Protostar',
                pageTitle: 'Error',
                pageSubtitle: 'Portal configured in sp-config.json is not running'
            }, rc.response);
        }
    });
};
module.exports.label = 'Push Script Portlet';
module.exports.description = '';
module.exports.noMenu = true;