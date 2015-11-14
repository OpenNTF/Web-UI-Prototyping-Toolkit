"use strict";

var fs = require("fs");
var path = require("path");

var copier = require("../../copier");

var protostarBuilder;// = require("../../protostarBuilder");

//var AdmZip = require("adm-zip");

//var blueBirdPromise = require("bluebird");

var zipUtils = require("../../zipUtils");

var osTmpdir = require("os-tmpdir");
//
//function zipDirPromise(cdp, targetDir){
//    return new blueBirdPromise(function(resolve,reject){
//        var zip = new AdmZip();
//        var children = fs.readdirSync(cdp);
//        children.forEach(function(cn){
//            var cp = cdp + path.sep + cn;
//            if(fs.statSync(cp).isDirectory()){
//                zip.addLocalFolder(cp, cn);
//            }else{
//                zip.addFile(cn, fs.readFileSync(cp));
//            }
//        });
//        var zipFileName = path.basename(cdp) + ".zip";
//        var targetZipPath = targetDir + path.sep + zipFileName;
//        zip.writeZip(targetZipPath, function(err){
//            if(err){
//                console.error("Could not write ZIP to " + targetZipPath, err);
//                reject();
//            }else{
//                console.log("Wrote component zip to " + targetZipPath+".");
//                resolve(targetZipPath);
//            }
//        });
//    });
//}

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    if(!protostarBuilder){
        protostarBuilder = require("../../protostarBuilder");
    }
    var projConfig = rc.runtime.readProjectConfig();
    if(!projConfig.hasOwnProperty("componentDirsParent")){
        var msg = "prototype.json does not contain a property componentDirsParent identifying the relative path of the dir containing a subdir per component (with sources that compile to html/js/css)";
        console.error(msg);
        rc.composer.renderNewBackendView(msg, {
            title: 'Error - Build Component ZIPs - Protostar',
            pageTitle: 'Error',
            pageSubtitle: 'Missing componentDirsParent property on prototype.json'
        }, rc.response);
    }else{
        var componentDirsParent = projConfig.componentDirsParent;

        var parentDirPath = rc.runtime.projectDirPath + path.sep + componentDirsParent;
        fs.stat(parentDirPath, function(err, stat){

            function listChildDirectoryPaths(parentDirPath){
                var cmpDirs = [];
                var children = fs.readdirSync(parentDirPath);
                children.forEach(function(c){
                    var dirPath = parentDirPath + path.sep + c;
                    if(fs.statSync(dirPath).isDirectory()){
                        cmpDirs.push(dirPath);
                    }
                });
                cmpDirs.sort();
                return cmpDirs;
            }

            if(err){
                var msg = "Configured componentDirsParent on prototype.json does not exist : " + parentDirPath;
                console.error(msg);
                rc.composer.renderNewBackendView(msg, {
                    title: 'Error - Build Component ZIPs - Protostar',
                    pageTitle: 'Error',
                    pageSubtitle: 'Incorrect componentDirsParent property on prototype.json'
                }, rc.response);
            }else if(stat.isDirectory()){
                var ts = new Date().getTime();
                var dirName = path.basename(rc.runtime.constructProjectPath(".")) + "_components_"+ts;
                var targetDir = osTmpdir() + path.sep + dirName;

                var cmpDirs = listChildDirectoryPaths(parentDirPath);

                if(cmpDirs.length > 0){
                    var builder = protostarBuilder.createBuilder({
                        runtime : rc.runtime,
                        project : rc.project,
                        composer :rc.composer
                    });

                    builder.buildComponentDirs(cmpDirs, targetDir, function(){
                        console.log("Finished building component dirs to " + targetDir);

                        var childDirs = listChildDirectoryPaths(targetDir);
                        //var zipPaths = [];
                        //var zipPromises = [];
                        var allZipsDir = targetDir + path.sep + 'zipped';
                        fs.mkdirSync(allZipsDir);
                        childDirs.forEach(function(cdp){
                            var zipFileName = path.basename(cdp) + ".zip";
                            var targetZipPath = allZipsDir + path.sep + zipFileName;
                            zipUtils.zipDirectory(cdp,targetZipPath);
                            //zipPromises.push(zipDirPromise(cdp, targetDir));
                        });
                        var allCmpZipPath = targetDir + path.sep + "latestComponentsZip.zip";
                        zipUtils.zipDirectory(allZipsDir, allCmpZipPath);
                        var buffer = fs.readFileSync(allCmpZipPath);
                        var zipFileName = path.basename(rc.runtime.projectDirPath) + "_components_"+new Date().getTime() + ".zip";
                        rc.response.writeHead(200, {
                            'Expires': 0,
                            'Cache-Control': 'must-revalidate, post-check=0, pre-check=0',
                            'Content-Description': 'File Transfer',
                            'Content-type': 'application/octet-stream',
                            'Content-Disposition': 'attachment; filename=\"' + zipFileName+'\"',
                            'Content-Transfer-Encoding': 'binary',
                            "Content-Length": buffer.length
                        });
                        rc.response.write(buffer, "binary");
                        rc.response.end();
                        //copier.deleteRecursively(targetDir);
                        rc.project.deleteIntermediaryFiles();


                        //
                        //blueBirdPromise.all(zipPromises).then(function(){
                        //    console.log("Finished zipping all component dirs to " + targetDir);
                        //    var children = fs.readdirSync(targetDir);
                        //    children.forEach(function(c){
                        //        var cp = targetDir + path.sep + c;
                        //        if(path.extname(cp) === '.zip' && fs.statSync(cp).isFile()){
                        //            zipPaths.push(cp);
                        //        }
                        //    });
                        //    var componentsZip = new AdmZip();
                        //    zipPaths.forEach(function(zp){
                        //        var zipName = path.basename(zp);
                        //        console.log("Adding " + zipName);
                        //        componentsZip.addLocalFile(zp, "", zipName);
                        //    });
                        //
                        //    componentsZip.writeZip(osTmpdir() + path.sep + "latestComponentsZip.zip", function(){
                        //        var zipFileName = path.basename(rc.runtime.projectDirPath) + "_components_"+new Date().getTime() + ".zip";
                        //        var buffer = componentsZip.toBuffer();
                        //        rc.response.writeHead(200, {
                        //            'Expires': 0,
                        //            'Cache-Control': 'must-revalidate, post-check=0, pre-check=0',
                        //            'Content-Description': 'File Transfer',
                        //            'Content-type': 'application/octet-stream',
                        //            'Content-Disposition': 'attachment; filename=\"' + zipFileName+'\"',
                        //            'Content-Transfer-Encoding': 'binary',
                        //            "Content-Length": buffer.length
                        //        });
                        //        rc.response.write(buffer, "binary");
                        //        rc.response.end();
                        //        //copier.deleteRecursively(targetDir);
                        //        rc.project.deleteIntermediaryFiles();
                        //    });
                        //
                        //});
                        //

                    });
                }else{
                    rc.composer.renderNewBackendView("There are no component dirs below " + parentDirPath, {
                        title: 'No component dirs present - Build Component ZIPs - Protostar',
                        pageTitle: 'No component dirs present',
                        pageSubtitle: 'Incorrect componentDirsParent property on prototype.json'
                    }, rc.response);
                }
            }
        });
    }
};
module.exports.label = 'Build component dir ZIPs';
module.exports.description = 'Generates a ZIP containing in turn one ZIP per configured component dir (self contained set of html,js,css)';

