"use strict";
var fs = require("fs");
var path = require("path");
var utils = require("./utils");
var copier = require("./copier");
var nodeZip = require("node-zip");


var zipUtils = module.exports;
/**
 * @param {String} zipRootDir the dir on filesystem to zip up
 * @param {String} zipFilePath where to write the created zip
 */
zipUtils.zipDirectory = function (zipRootDir, zipFilePath){
    var zip = nodeZip();
    var children = copier.listDirChildrenFullPathsRecursively(zipRootDir).filter(function(c){
        return fs.statSync(c).isFile();
    });
    var relChildren = utils.relativize(children, zipRootDir);
    relChildren.forEach(function(c){
        zip.file(c, fs.readFileSync(zipRootDir+path.sep+c));
    });
    var data = zip.generate({base64:false,compression:'DEFLATE'});
    fs.writeFileSync(zipFilePath, data, 'binary');
};
/**
 *
 * @param {String} zipRootDir the dir on filesystem to zip up
 * @param {String} rootPathInZip the local path of the dir inside the zip
 * @param {String} zipFilePath where to write the created zip
 */
zipUtils.zipDirectoryAs = function (zipRootDir, rootPathInZip, zipFilePath){
    var zip = nodeZip();
    var children = copier.listDirChildrenFullPathsRecursively(zipRootDir).filter(function(c){
        return fs.statSync(c).isFile();
    });
    var relChildren = utils.relativize(children, zipRootDir);
    var pref = rootPathInZip ? rootPathInZip + path.sep : '';
    relChildren.forEach(function(c){
        zip.file(pref + c, fs.readFileSync(zipRootDir+path.sep+c));
    });
    var data = zip.generate({base64:false,compression:'DEFLATE'});
    fs.writeFileSync(zipFilePath, data, 'binary');
};