"use strict";
var fs = require("fs");
var path = require("path");

var copier = require("../../copier");
var url = require("url");
var protostarBuilder;// = require("../../protostarBuilder");

var AdmZip = require("adm-zip");
var osTmpdir = require("os-tmpdir");
/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports= function (rc) {
    if(!protostarBuilder){
        protostarBuilder = require("../../protostarBuilder");
    }

    var url_parts = url.parse(rc.request.url, true);
    var dirParameterValue = url_parts.query.dir || false;
    if(!dirParameterValue) {
        throw new Error("missing directory");
    }
    var projectDir = rc.runtime.projectDirPath;
    var cmpDirPath = path.resolve(projectDir, dirParameterValue);
    if(!rc.runtime.isExistingDirPath(cmpDirPath)){
        throw new Error("Not an existing dir path for " + dirParameterValue + ": " + cmpDirPath);
    }
    var builder = protostarBuilder.createBuilder({
        runtime : rc.runtime,
        project : rc.project,
        composer :rc.composer
    });

    var ts = new Date().getTime();
    var dirName = path.basename(cmpDirPath);
    var targetDir = osTmpdir() + path.sep +  path.basename(rc.runtime.constructProjectPath(".")) + "_component_" + dirName + "_" +ts;



    builder.buildComponentDir(cmpDirPath, targetDir, function(){
        console.log("Finished building component dir "+cmpDirPath+" to " + targetDir);
        var zip = new AdmZip();
        var children = fs.readdirSync(targetDir);
        children.forEach(function(cn){
            var cp = targetDir + path.sep + cn;
            if(fs.statSync(cp).isDirectory()){
                zip.addLocalFolder(cp, cn);
            }else{
                zip.addFile(cn, fs.readFileSync(cp));
            }
        });
        var zipFileName = dirName + ".zip";
        var buffer = zip.toBuffer();
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
        rc.project.deleteIntermediaryFiles();

    });
};
module.exports.label = 'Download Component Dir ZIP';
module.exports.description = '';
module.exports.noMenu = true;