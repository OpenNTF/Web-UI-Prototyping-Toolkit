"use strict";
var utils = require("../utils");
var url = require("url");
var copier = require("../copier");
var screenies = require("../screenies");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var handleShowScreenshot = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    var imageFilename = "screenshot_" + new Date().getTime() + "." + rc.runtime.readUserConfig().runtime["screenshots"].streamType;
    var screeniePath = rc.project.resolveProjectFile("screenshots/" + imageFilename);
    copier.ensureParentDirExists(screeniePath);
    screenies.createScreenshotAdvanced("http://localhost:" + rc.runtime.getPort() + parsedUrl.pathname, screeniePath, 320, 'all', function (imagePath) {
        logger.info("Saved to " + imagePath);
        logger.info("Redirecting to image: " + rc.project.toRelativePath(imagePath));
        rc.response.writeHead(302, {
            Location: "http://" + rc.request.headers.host + "/" + rc.project.toRelativePath(imagePath)
        });
        rc.response.end();
    });
};
module.exports = handleShowScreenshot;