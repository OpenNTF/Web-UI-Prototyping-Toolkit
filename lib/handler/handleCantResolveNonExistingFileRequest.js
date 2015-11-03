"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleCantResolveNonExistingFileRequest =  function (rc) {
    var parsedUrl = url.parse(request.url, true);
    var requestedFilePath = runtime.findFileForUrlPathname(parsedUrl.pathname);
    if(parsedUrl.pathname.indexOf("/favicon") !== 0){
        logger.error("Non existing path while resolving http request for  " + parsedUrl.pathname + " : " + requestedFilePath);
    }
    if(!runtime.lenient){
        throw new Error("Non existing path while resolving " + parsedUrl.pathname + " : " + requestedFilePath);
    }
    var responseHeaders = {"Content-Type": "text/html; charset=utf-8"};
    var statusCode = 404;
    if (parsedUrl.pathname.indexOf(".html") > 0) {
        var responseContent = "<div><p>404 Not Found : nothing here yet</p><h1>Would you like to create " + requestedFilePath + "?</h1></div>\n";
        var templateList = "";
        var createList = "";
        var templatePaths = project.listAllTemplatePaths();

        var gotoTemplatesList = "";

        templatePaths.forEach(function(tp){
            var name = runtime.createTemplateReferenceFromFullPath(tp);
            createList += '<li><a href="' + url.parse(request.url).pathname + '?command=create&templatePath=' + name + '">Copy ' + name + '</a></li>';
            gotoTemplatesList += '<li><a href="' + url.parse(request.url).pathname + '">' + name + '</a></li>';
        });

        var htmlFiles = fsops.listRecursively(runtime.constructProjectPath('')).filter(function(p){
            return path.extname(p) === '.html';
        });

        htmlFiles.forEach(function (tp) {
            var name = runtime.createTemplateReferenceFromFullPath(tp);
            var link = runtime.createUrlPathForFile(tp);
            templateList += '<li><a href="' + link + '">' + name + '</a></li>';
        });

        project.logWcmMarkupFilesInProjectInfo();

        responseContent += '<h3>Existing children:</h3><ul>'+gotoTemplatesList+'</ul><h4>Or create new based on:</h4><ul>'+createList+'</ul></div>';
        writeResponse(response, statusCode, responseHeaders, responseContent + project.readViewScriptsMarkup());
    } else {
        if (!runtime.lenient) {
            var ignoredUrlPaths = {
                "/favicon.ico": 1
            };
            if (!ignoredUrlPaths.hasOwnProperty(parsedUrl.pathname)) {
                throw new Error("Non existing path while resolving " + parsedUrl.pathname + " : " + requestedFilePath)
            }
        }
        writeResponse(response, statusCode, responseHeaders, "<div><p>404 Nothing here for " + parsedUrl.pathname + "</p></div>\n" + project.readViewScriptsMarkup());
    }
};
module.exports = handleCantResolveNonExistingFileRequest;