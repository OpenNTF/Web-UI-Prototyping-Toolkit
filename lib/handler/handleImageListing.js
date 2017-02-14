"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var handleImageListing = function (rc) {
    var listImages = function (imagesDir, dirReplacement, folderName) {
        var fileNames = rc.runtime.listDir(imagesDir);
        var imageFiles = [];
        var baseName = folderName;
        var ie = rc.runtime.readUserConfig()["imageExtensions"];
        var extMap = {};
        ie.forEach(function (e) {
            extMap[e] = 1;
        });
        fileNames.forEach(function (fileName) {
            var extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
            if (extMap.hasOwnProperty(extension)) {
                var imagePath = dirReplacement + "/" + fileName;
                imageFiles.push({
                    image: imagePath,
                    thumb: imagePath,
                    folder: baseName,
                    name: fileName
                });
            }
        });
        imageFiles.sort(function (a, b) {
            var ps = utils.sortString(a.path, b.path);
            if (ps === 0) {
                ps = utils.sortString(a.name, b.name);
            }
            return ps;
        });
        return imageFiles;
    };
    var psImagesDir = rc.runtime.constructAppPath(["core", "assets"]);
    var psImages = listImages(psImagesDir, "/ps/assets", "Protostar");
    var projImagesDir = rc.runtime.constructProjectPath("images");
    if (rc.runtime.isExistingDirPath(projImagesDir)) {
        var projectImages = listImages(projImagesDir, "/images", "Project");
        projectImages.forEach(function (i) {
            psImages.push(i);
        });
    }
    utils.writeResponse(rc.response, 200, {
        "Content-Type": "application/json; charset=utf-8"
    }, JSON.stringify(psImages));
    logger.info("Wrote images:", psImages);
};
module.exports = handleImageListing;