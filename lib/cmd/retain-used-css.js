"use strict";

var url =require("url");
var utils = require("../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
var cssFixes = require("../cssFixes");
/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var hostPrefix = 'http://localhost:' +rc.runtime.port;
    var files = rc.project.listAllTemplatePaths().map(function(f){
        return hostPrefix + rc.runtime.createUrlPathForFile(f);
    });
    console.log("url paths = ", files);
    var urlParts = url.parse(rc.request.url, true);
    if(!urlParts.query.hasOwnProperty("cssPath")){
        console.error("Missing required query arg: cssPath");
        rc.response.writeHead(500);
        rc.response.end();
        return;
    }
    var cssPath = urlParts.query.cssPath;
    if(cssPath.indexOf('/') !== 0){
        cssPath = '/' + cssPath;
    }
    var styleSheetLocation = (hostPrefix + cssPath);

    cssFixes.removeUnusedCss(files, {
        stylesheets: [styleSheetLocation],
        report: true,
        timeout: 5000,

    }, function(err, newCss, report){
        if(err){
            console.error("Error removing unused css", err);
            rc.response.writeHead(500);
            rc.response.end();
            return;
        }
        console.log("finished removing unused css:", report);
        utils.writeResponse(rc.response, 200, {
            "Content-Type": "text/css; charset=utf-8"
        }, newCss+"");
    });
    //var hp = createHtmlProducer();
    //var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
    //composer.renderBackendView(request, response, files.join('<br>'), 'cmdListAll.html');
    //response.end();
};