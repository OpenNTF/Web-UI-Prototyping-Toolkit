"use strict";

var path = require("path");

var copier = require("fsops");

var protostarBuilder = require("../../protostarBuilder");

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var ts = new Date().getTime();
    var dirName = path.basename(rc.runtime.constructProjectPath(".")) + "_build_"+ts;
    var targetDir = "/tmp/" + dirName;
    var builder = protostarBuilder.createBuilder({
        runtime : rc.runtime,
        project : rc.project,
        composer :rc.composer,
        targetDir : targetDir,
        ignoreExcludeFromBuild : false //args.ignoreExcludeFromBuild || false
    });
    builder.createZipBuild(function(zip, targetDir, dirName){
        var buffer = zip.toBuffer();
        rc.response.writeHead(200, {
            'Expires': 0,
            'Cache-Control': 'must-revalidate, post-check=0, pre-check=0',
            'Content-Description': 'File Transfer',
            'Content-type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename=\"' + dirName+'.zip\"',
            'Content-Transfer-Encoding': 'binary',
            "Content-Length": buffer.length
        });
        rc.response.write(buffer, "binary");
        rc.response.end();
        copier.deleteRecursively(targetDir);
        //wrench.rmdirSyncRecursive(targetDir);
    });
};