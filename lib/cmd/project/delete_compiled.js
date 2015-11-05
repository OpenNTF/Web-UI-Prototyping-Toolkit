"use strict";

var fs = require("fs");
var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listCompiledTemplatePaths();
    files.forEach(function (fd) {
        var filePath = fd;
        rc.runtime.deleteFile(filePath);
        logger.info("Deleted compiled file : " + filePath);
        var metaPath = filePath.substring(0, filePath.lastIndexOf('-'))+'-meta.json';
        if(fs.existsSync(metaPath)){
            rc.runtime.deleteFile(metaPath);
        }

    });
    rc.project.updateDynamic();
    var hp = rc.project.htmlProducer;
    var out = hp.createDeletedMarkup(files) + rc.project.readViewScriptsMarkup();
    rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdDeleteCompiled.html');
    rc.response.end();
};
module.exports.label = 'Delete Compiled Pages';
module.exports.description = 'Deletes all *-compiled.html files';