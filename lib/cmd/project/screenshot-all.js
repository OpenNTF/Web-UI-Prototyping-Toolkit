"use strict";

var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});

var copier = require("fsops");
var screenies = require("../../screenies");

var runningScreenshotsGen = false;

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    if (runningScreenshotsGen) {
        logger.info("Still running screenshotgen");
        rc.response.writeHead(302, {
            "Location": "http://" + rc.request.headers.host
        });
        rc.response.end();
        return false;
    }
    var cfg = rc.runtime.readUserConfig();

    runningScreenshotsGen = true;
    var sizes = cfg.runtime["screenshotSizes"];

    function listSizeNames() {
        var sizeNames = [];
        for (var sn in sizes) {
            if (sizes.hasOwnProperty(sn)) {
                sizeNames.push(sn);
            }
        }
        return sizeNames;
    }

    var allSizeNames = listSizeNames();
    var allTemplatePaths = rc.project.listAllTemplatePaths();
    logger.info("AllTemplatePaths: ", allTemplatePaths);
    var cmds = [];
    allSizeNames.forEach(function (sn) {
        allTemplatePaths.forEach(function (tp) {
            cmds.push({
                sizeName: sn,
                path: tp
            });
        });
    });

    function removeWrite(cmds, dirName) {
        if (cmds.length < 1) {
            logger.info("All are empty");
            return;
        }
        var cmd = cmds[0];
        cmds.splice(0, 1);
        var tp = cmd.path;
        var sizeName = cmd.sizeName;
        var tpName = rc.runtime.createUrlPathForFile(tp);
        logger.info("Creating screenshot for " + tpName + " in " + dirName + " for size " + sizeName);

        var screenieName = tpName.substring(1, tpName.lastIndexOf('.')).replace(new RegExp("\\/", 'g'), "__");
        var imageFilename = screenieName + ".png";
        var screeniePath = rc.project.resolveProjectFile("screenshots/" + dirName + "/" + sizeName + "/" + imageFilename);
        copier.ensureParentDirExists(screeniePath);

        screenies.createScreenshotAdvanced("http://localhost:" + (process.env["VCAP_APP_PORT"] || 8888) + tpName, screeniePath, sizes[sizeName].width, sizes[sizeName].height, function (imagePath) {
            logger.info("Saved to " + imagePath);
            if (cmds.length < 1) {
                runningScreenshotsGen = false;
                rc.response.writeHead(302, {
                    "Location": "http://" + rc.request.headers.host
                });
                rc.response.end();
            } else {
                removeWrite(cmds, dirName);
            }
        });
    }
    var ts = "" + new Date().getTime();
    var screenshotsDirName = "all_" + ts;
    removeWrite(cmds, screenshotsDirName);
    return false;
};