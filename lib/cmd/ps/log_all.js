"use strict";
var utils = require("../../utils");
/**
 *
 * @param {RequestContext} rc
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
module.exports.label = 'Enable Trace Logging';
module.exports.description = 'Enables a lot of debug logging to the console';