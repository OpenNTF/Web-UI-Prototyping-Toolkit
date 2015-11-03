"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleShowScreenshot = function (rc) {
    var parsedUrl = url.parse(request.url, true);
    var imageFilename = "screenshot_" + new Date().getTime() + "." + runtime.readUserConfig().runtime["screenshots"].streamType;
    var screeniePath = project.resolveProjectFile("screenshots/" + imageFilename);
    copier.ensureParentDirExists(screeniePath);
    screenies.createScreenshotAdvanced("http://localhost:" + runtime.getPort() + parsedUrl.pathname, screeniePath, 320, 'all', function (imagePath) {
        logger.info("Saved to " + imagePath);
        logger.info("Redirecting to image: " + project.toRelativePath(imagePath));
        response.writeHead(302, {
            Location: "http://" + request.headers.host + "/" + project.toRelativePath(imagePath)
        });
        response.end();
    });
};
module.exports = handleShowScreenshot;