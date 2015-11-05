"use strict";

var fs = require("fs");
var path = require("path");
var portletThemeMerger = require("../../portalThemeMerger");

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var userCfg = rc.runtime.readUserConfig();
    var dxsyncConfigured = userCfg.hasOwnProperty("dxSyncPath") && rc.runtime.isExistingFilePath(userCfg["dxSyncPath"]);
    if(dxsyncConfigured && rc.runtime.isProjectConfigPresent()){
        var pcfg = rc.runtime.readProjectConfig();
        if(pcfg.hasOwnProperty("dxSyncDir")){
            var dxSyncDir = path.normalize(pcfg["dxSyncDir"]);
            var dxsCfgPath = path.resolve(dxSyncDir, ".settings");
            var missingFields = [];
            if(rc.runtime.isExistingFilePath(dxsCfgPath)){
                var dxsCfg = JSON.parse(fs.readFileSync(dxsCfgPath, "utf8"));
                ["username",
                    "password",
                    "contenthandlerPath",
                    "host",
                    "secure",
                    "port",
                    "theme"].forEach(function(field){
                        if(!dxsCfg.hasOwnProperty(field) || (typeof dxsCfg[field]!== 'string' && typeof dxsCfg[field] !== 'boolean') || dxsCfg[field].length < 1){
                            missingFields.push(field);
                        }

                    });
                if(missingFields.length > 0){
                    var msg = "DXSync : missing config properties on " + dxsCfgPath + ": " + missingFields.join(", ");
                    console.error(msg);
                    rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
                    rc.response.end();
                }else{

                    console.info("DXSync integration is enabled.");
                    var start = new Date();
                    portletThemeMerger.mergeStatic({
                        targetDir : dxSyncDir,
                        projectPath : rc.runtime.constructProjectPath('.'),
                        runtime:rc.runtime,
                        composer:rc.composer,
                        project:rc.project
                    }).then(function(){
                        console.log("Merged static successfully to " + dxSyncDir);

                        var env = process.env;
                        env.PATH += ":" + path.dirname(rc.runtime.nodeCommandPath);
                        var exec = require('child_process').exec;
                        var command = userCfg["dxSyncPath"] + " push";
                        console.log("Running " + command + " from dir " + dxSyncDir + "...");
                        exec(command, {
                            cwd: dxSyncDir
                        }, function(error, stdout, stderr) {
                            console.log("ran push command : " + command);
                            console.log("stdout: " + stdout);
                            console.log("stderr: " + stderr);
                            var opener;
                            if(error){
                                console.error("Failed! ", error);
                                opener = "Failed to push theme files using DXSync using";
                            }else{
                                console.info("Success: " + stdout);
                                opener = "Successfully pushed theme files to webdav using DXSync using";
                            }

                            var out = '<div class="row"><div class="col-md-12">' +
                                '<h1>'+opener+' '+dxSyncDir+' to portal on '+start+'</h1>' +
                                '<p><a class="btn btn-primary" href="/?command=dxsync-push">Sync DX again</a></p>' +
                                '<h3>stdout</h3>'+
                                '<pre><code>'+stdout+'</code></pre>' +
                                '<h3>stderr</h3>'+
                                '<pre><code>'+stderr+'</code></pre>' +
                                '</div></div>';

                            rc.project.deleteIntermediaryFiles();
                            rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdList.html');
                            rc.response.end();
                        });
                    }, function(){
                        var msg = "Could not merge static successfully to " + dxSyncDir;
                        console.error(msg, arguments);
                        rc.project.deleteIntermediaryFiles();
                        rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
                        rc.response.end();
                    }).catch(function(){
                        var msg = "Could not merge static to " + dxSyncDir;
                        console.error(msg, arguments);
                        rc.project.deleteIntermediaryFiles();
                        rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
                        rc.response.end();
                    });
                }
            }else{
                var msg = "DXSync : property 'dxSyncDir' on prototype.json does not point to an existing directory: " + dxSyncDir;
                console.error(msg);
                rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
                rc.response.end();
            }
        }else{
            var msg = "DXSync : missing project config property 'dxSyncDir' on prototype.json at " + rc.runtime.projectConfigPath;
            console.error(msg);
            rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
            rc.response.end();
        }
    }else{
        var msg = "DXSync is not configured : either missing path to dxsync on " + rc.runtime.configPath + " or no prototype config present at " + rc.runtime.projectConfigPath;
        console.error(msg);
        rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
        rc.response.end();
    }
};
module.exports.label = 'Push Theme To Portal WebDAV';
module.exports.description = 'Merges built output into the configured DXSync directory and initiates a DXSync push command for that directory';