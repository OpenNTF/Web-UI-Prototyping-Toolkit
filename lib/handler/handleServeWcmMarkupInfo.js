"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleServeWcmMarkupInfo = function(rc){
    var htmlFiles = fsops.listRecursively(runtime.constructProjectPath('')).filter(function(p){
        return path.extname(p) === '.html';
    });
    var wcmMarkupFilesInfo = {};
    htmlFiles.forEach(function (tp) {
        var link = runtime.createUrlPathForFile(tp);
        var htmlFile = runtime.readFile(tp);
        if(wcmTagParser.isWcmMarkup(htmlFile)){
            wcmMarkupFilesInfo[link] = wcmTagParser.createIbmWcmMarkupFragmentInfo(link, htmlFile);
        }
    });

    var wcmMarkupInfoJsonString = JSON.stringify(wcmMarkupFilesInfo);

    writeResponse(response, 200, {"Content-Type": "application/json"}, wcmMarkupInfoJsonString);

};
module.exports = handleServeWcmMarkupInfo;