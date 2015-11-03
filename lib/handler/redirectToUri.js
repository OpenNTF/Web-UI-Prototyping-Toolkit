"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var redirectToUri = function (rc) {
    var parsedUrl = url.parse(request.url, true);
    var uri = parsedUrl.query.uri;
    var newLoc = "http://" + request.headers.host + uri;
    var params = '';
    var found = false;
    for (var qk in parsedUrl.query) {
        var v = parsedUrl.query[qk];
        if (typeof v === 'string' && qk !== 'uri') {
            if (found) {
                params += '&';
            }
            found = true;
            params += qk + '=' + v;
        }
    }
    if (found) {
        params = '?' + params;
    }
    newLoc += params;
    logger.debug("new loc =" + newLoc);
    response.writeHead(302, {
        Location: newLoc
    });
    response.end();
};
module.exports = redirectToUri;