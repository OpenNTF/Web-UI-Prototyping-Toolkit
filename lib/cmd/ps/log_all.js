"use strict";
var utils = require("../../utils");
/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    utils.setLoggingLevel("all");
    return {
        status: 302,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Location": "/"
        }
    };
};