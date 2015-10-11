var fs = require("fs");
var path = require("path");
var fsops = require("fsops");
var debug = false;

/**
 * Copies and merges in files from sourceDir into targetDir
 * @param sourceDir must exist
 * @param targetDir may exist or will be created
 */
function mergeDirs(sourceDir, targetDir) {
    return fsops.copyUpdated(sourceDir, targetDir);
}

function listDirChildrenFullPathsRecursively(sourceDir, ignoredNames){
    return fsops.listRecursively(sourceDir, ignoredNames);
}

function listDirChildrenFullPathsRecursivelyFull(sourceDir, ignoredNames){
    return fsops.listRecursivelyMeta(sourceDir, ignoredNames);
}

function deleteRecursively(sourceDir) {
    return fsops.deleteRecursively(sourceDir);
}

function mkdirsSync(dirPath){
    return fsops.mkdirsSync(dirPath);
}

var ensureParentDirExists = function (fileName) {
    var pd = path.dirname(fileName);
    if (!fs.existsSync(pd)) {
        mkdirsSync(pd);
    }
};


module.exports = {
    copy:mergeDirs,
    deleteRecursively:deleteRecursively,
    mkdirsSync:mkdirsSync,
    listDirChildrenFullPathsRecursively:listDirChildrenFullPathsRecursively,
    listDirChildrenFullPathsRecursivelyFull:listDirChildrenFullPathsRecursivelyFull,
    ensureParentDirExists:ensureParentDirExists
};