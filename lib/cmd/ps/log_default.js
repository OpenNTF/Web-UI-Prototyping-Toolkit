"use strict";

var utils = require("../../utils");
/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    utils.setLoggingLevel("info");
    return {
        status: 302,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Location": "/"
        }
    };
};
module.exports.label = 'Restore Logging Defaults';
module.exports.description = '';