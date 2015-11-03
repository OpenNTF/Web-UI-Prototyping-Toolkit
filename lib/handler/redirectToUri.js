"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var redirectToUri = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    var uri = parsedUrl.query.uri;
    var newLoc = "http://" + rc.request.headers.host + uri;
    var params = '';
    var found = false;
    for (var qk in parsedUrl.query) { // jshint ignore:line
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
    rc.response.writeHead(302, {
        Location: newLoc
    });
    rc.response.end();
};
module.exports = redirectToUri;