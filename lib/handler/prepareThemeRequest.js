"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var prepareThemeRequest = function (rc) {
    var firstThemeReqData = '';
    rc.request.on('data', function (data) {
        firstThemeReqData += data;
        // Too much data
        if (firstThemeReqData.length > 1e6) {
            rc.request.connection.destroy();
        }
    });
    rc.request.on('end', function () {
        var initData = JSON.parse(firstThemeReqData);
        var auth = "ok_" + new Date().getTime();
        allowedThemeReqs[auth] = initData;
        utils.writeResponse(rc.response, 200, {"Content-Type": "application/json; charset=utf-8"}, JSON.stringify({auth: auth}));
    });
};
module.exports = prepareThemeRequest;