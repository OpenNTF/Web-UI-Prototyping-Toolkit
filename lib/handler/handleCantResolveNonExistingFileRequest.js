"use strict";
var utils = require("../utils");
var url = require("url");
var path = require("path");
var fsops = require("fsops");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} trc
 */
var handleCantResolveNonExistingFileRequest =  function (trc) {
    var rc = trc;
    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(parsedUrl.pathname);
    if(parsedUrl.pathname.indexOf("/favicon") !== 0){
        logger.error("Non existing path while resolving http request for  " + parsedUrl.pathname + " : " + requestedFilePath);
    }
    if(!rc.runtime.lenient){
        throw new Error("Non existing path while resolving " + parsedUrl.pathname + " : " + requestedFilePath);
    }
    var responseHeaders = {"Content-Type": "text/html; charset=utf-8"};
    var statusCode = 404;
    if (parsedUrl.pathname.indexOf(".html") > 0) {
        var responseContent = "<div><p>404 Not Found : nothing here yet</p><h1>Would you like to create " + requestedFilePath + "?</h1></div>\n";
        var templateList = "";
        var createList = "";
        var templatePaths = rc.project.listAllTemplatePaths();

        var gotoTemplatesList = "";

        templatePaths.forEach(function(tp){
            var name = rc.runtime.createTemplateReferenceFromFullPath(tp);
            createList += '<li><a href="' + url.parse(rc.request.url).pathname + '?command=create&templatePath=' + name + '">Copy ' + name + '</a></li>';
            gotoTemplatesList += '<li><a href="/' + name + '">' + name + '</a></li>';
        });

        var htmlFiles = fsops.listRecursively(rc.runtime.constructProjectPath('')).filter(function(p){
            return path.extname(p) === '.html';
        });

        htmlFiles.forEach(function (tp) {
            var name = rc.runtime.createTemplateReferenceFromFullPath(tp);
            var link = rc.runtime.createUrlPathForFile(tp);
            templateList += '<li><a href="' + link + '">' + name + '</a></li>';
        });

        rc.project.logWcmMarkupFilesInProjectInfo();

        responseContent += '<h3>Existing children:</h3><ul>'+gotoTemplatesList+'</ul><h4>Or create new based on:</h4><ul>'+createList+'</ul></div>';
        utils.writeResponse(rc.response, statusCode, responseHeaders, responseContent + rc.project.readViewScriptsMarkup());
    } else {
        if (!rc.runtime.lenient) {
            var ignoredUrlPaths = {
                "/favicon.ico": 1
            };
            if (!ignoredUrlPaths.hasOwnProperty(parsedUrl.pathname)) {
                throw new Error("Non existing path while resolving " + parsedUrl.pathname + " : " + requestedFilePath);
            }
        }
        utils.writeResponse(rc.response, statusCode, responseHeaders, "<div><p>404 Nothing here for " + parsedUrl.pathname + "</p></div>\n" + rc.project.readViewScriptsMarkup());
    }
};
module.exports = handleCantResolveNonExistingFileRequest;