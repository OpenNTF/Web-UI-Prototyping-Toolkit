"use strict";
var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    logger.info("Handling exit request received by browser!");
    rc.response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
    });
    rc.response.on("finish", function () {
        logger.info("Finished response, exiting protostar.");
        process.exit(0);
    });
    rc.response.write("<div>Protostar is exiting by your command, <strong>bye bye</strong>!</div>");
    rc.response.end();
    return false;
};
module.exports.label = 'Exit (Kill Protostar)';
module.exports.description = '';