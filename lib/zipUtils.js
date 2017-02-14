"use strict";
const fs = require("fs");
const path = require("path");
const utils = require("./utils");
const copier = require("./copier");
const nodeZip = require("node-zip");


const zipUtils = module.exports;
/**
 * @param {String} zipRootDir the dir on filesystem to zip up
 * @param {String} zipFilePath where to write the created zip
 */
zipUtils.zipDirectory = function (zipRootDir, zipFilePath){
    const zip = nodeZip();
    const children = copier.listDirChildrenFullPathsRecursively(zipRootDir).filter(c => fs.statSync(c).isFile());
    const relChildren = utils.relativize(children, zipRootDir);
    relChildren.forEach(c =>{
        zip.file(c, fs.readFileSync(zipRootDir+path.sep+c));
    });
    const data = zip.generate({base64: false, compression: 'DEFLATE'});
    fs.writeFileSync(zipFilePath, data, 'binary');
};
/**
 *
 * @param {String} zipRootDir the dir on filesystem to zip up
 * @param {String} rootPathInZip the local path of the dir inside the zip
 * @param {String} zipFilePath where to write the created zip
 */
zipUtils.zipDirectoryAs = function (zipRootDir, rootPathInZip, zipFilePath){
    const zip = nodeZip();
    const children = copier.listDirChildrenFullPathsRecursively(zipRootDir).filter(c => fs.statSync(c).isFile());
    const relChildren = utils.relativize(children, zipRootDir);
    const pref = rootPathInZip ? rootPathInZip + path.sep : '';
    relChildren.forEach(c =>{
        zip.file(pref + c, fs.readFileSync(zipRootDir+path.sep+c));
    });
    const data = zip.generate({base64: false, compression: 'DEFLATE'});
    fs.writeFileSync(zipFilePath, data, 'binary');
};