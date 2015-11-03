"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleSaveInlineContentUpdate = function (rc) {
    var saveContentUpdateToFile = function (updateRequest, request, response) {
        var ur = updateRequest;
        logger.info("updating part content for " + ur.partname + ":", ur);
        var partPath = runtime.findFileForUrlPathname("/" + ur.partname + ".html");
        var partContents = composer.prepareEditableRefs(partPath, runtime.readFile(partPath));
        var writtenData = '';
        var storeFileContentUpdate = function ($) {
            var origId = ur.id;
            var sel = $('[data-editable="' + ur.partname +'"]');
            sel.html(ur.content);
            if (origId.indexOf("psGen") === 0) {
                logger.info("Removing editable attrs");
                sel.removeAttr("id");
                sel.removeAttr("data-editable");
                sel.attr('data-editable', '');
            }
            var out = utils.beautifyHtml($.html());
            out = out.replace(/data-editable=""/g,'data-editable');
            project.writeFile(partPath, out);
            writtenData = out;
            logger.info("Updated part " + partPath + " with contents : " + out);
            return out;
        };
        var done = function (result, errors, window) {
            logger.info("Wrote to " + partPath + " : " + writtenData);
        };
        jqueryRunner.runJQuery(partContents, storeFileContentUpdate, done);
    };
    var body = '';
    request.on('data', function (data) {
        body += data;
        // Too much data
        if (body.length > 1e6)
            request.connection.destroy();
    });
    request.on('end', function () {
        var contentUpdateReq = JSON.parse(body);
        saveContentUpdateToFile(contentUpdateReq, request, response);
        writeResponse(response, 200, {"Content-Type": "application/json; charset=utf-8"}, '{"status":"ok"}');
    });
};

module.exports =handleSaveInlineContentUpdate;