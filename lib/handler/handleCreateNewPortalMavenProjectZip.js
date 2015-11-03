"use strict";
var utils = require("../utils");
var url = require("url");
var portalThemeImporter;// = require("../portalThemeImporter");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleCreateNewPortalMavenProjectZip = function (rc) {
    if(!portalThemeImporter){
        portalThemeImporter = require("../portalThemeImporter");
    }
    var parsedUrl = url.parse(rc.request.url, true);
    //serve up
    var config = allowedThemeReqs[parsedUrl.query.auth];// JSON.parse(authorizedThemeReqData);
    var ti = new portalThemeImporter.ThemeImporter(config);
    ti.createNewThemeProjectZipBuffer(config.projectName, os.tmpdir(), config, function (buffer) {
        rc.response.writeHead(200, {
            'Expires': 0,
            'Cache-Control': 'must-revalidate, post-check=0, pre-check=0',
            'Content-Description': 'File Transfer',
            'Content-type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename=\"' + config.projectName + '.zip\"',
            'Content-Transfer-Encoding': 'binary',
            "Content-Length": buffer.length
        });
        rc.response.write(buffer, "binary");
        rc.response.end();
    });
};
module.exports = handleCreateNewPortalMavenProjectZip;