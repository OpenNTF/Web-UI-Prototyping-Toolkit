"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var redirectToUri = function (rc) {
    var uri = rc.wr.getQueryParam('uri');
    var newLoc = "http://" + rc.request.headers.host + uri;
    var params = '';
    var found = false;
    rc.wr.getQueryParamNames().forEach(function(qk){
        var v = rc.wr.getQueryParam(qk);
        if (typeof v === 'string' && qk !== 'uri') {
            if (found) {
                params += '&';
            }
            found = true;
            params += qk + '=' + v;
        }
    });
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