var fs = require("fs");
var path = require("path");
var utils = require("./utils");
var crypto = require("crypto");

var streams = false;

function copyFile(source, target){
    if (streams) {
        var instr = fs.createReadStream(source);
        var outstr = fs.createWriteStream(target);
        instr.pipe(outstr);
    } else {
        if(fs.existsSync(source) && fs.existsSync(target)){
            var sc = checksumFile(source);
            var tc = checksumFile(target);
            if(sc !== tc){
                fs.writeFileSync(target, fs.readFileSync(source));
            }else{
                console.log("Not writing unchanged " + source + " -> " + target);
            }
        }else{
            fs.writeFileSync(target, fs.readFileSync(source));
        }
    }
}

function checksumFile (filePath) {
    return crypto
        .createHash('sha1')
        .update(fs.readFileSync(filePath), 'utf8')
        .digest('hex')
}

/**
 * Copies and merges in files from sourceDir into targetDir
 * @param sourceDir must exist
 * @param targetDir may exist or will be created
 */
function mergeDirs(sourceDir, targetDir) {
    var copyOps = [];
    if(!fs.existsSync(sourceDir)){
        throw new Error("Copy source does not exist: " + sourceDir);
    }

    if(!fs.existsSync(targetDir)){
        mkdirsSync(targetDir);
    }else{
        if(!fs.statSync(targetDir).isDirectory()){
            processCopyOp({
                source:sourceDir,
                target:targetDir,
                dir:false
            });
            console.info("Copied file " + sourceDir + " -> " + targetDir);
            return;
        }
    }

    function processDir(sourceDir, targetDir){
        var directChildren = fs.readdirSync(sourceDir);

        directChildren.forEach(function(cfn){
            var sourcePath = sourceDir + path.sep + cfn;
            var targetPath = targetDir + path.sep + cfn;
            copyOps.push({
                source: sourcePath,
                target: targetPath,
                dir : fs.statSync(sourcePath).isDirectory()
            });
        });
    }

    function processCopyOp(copyOp){
        var targetExists = fs.existsSync(copyOp.target);
        var targetOkType;
        if(copyOp.dir){
            if(targetExists){
                targetOkType = fs.statSync(copyOp.target).isDirectory();
                if(!targetOkType){
                    fs.unlinkSync(copyOp.target);
                    fs.mkdirSync(copyOp.target);
                    //dirsCreated++;
                }
            }else{
                fs.mkdirSync(copyOp.target);
                //dirsCreated++;
            }
            processDir(copyOp.source, copyOp.target);
        }else{
            if(targetExists){
                var targetStat = fs.statSync(copyOp.target);
                targetOkType = targetStat.isFile();
                if(!targetOkType){
                    if(targetStat.isDirectory()){
                        deleteRecursively(copyOp.target)
                    }
                }
            }
            copyFile(copyOp.source, copyOp.target);
        }
    }
    processDir(sourceDir, targetDir);
    var done = 0;
    while(copyOps.length > 0){
        var op = copyOps.shift();
        processCopyOp(op);
        done++;
    }
    console.log("Copied " + done  + " items from " + sourceDir + " -> " + targetDir);
}

function listDirChildrenFullPathsRecursively(sourceDir){
    if(!fs.existsSync(sourceDir)){
        throw new Error("Path to delete does not exist: " + sourceDir);
    }

    if(!fs.statSync(sourceDir).isDirectory()){
        throw new Error("not a directory: " + sourceDir);
    }

    var childPaths = [];

    function listDir(sourceDir, depth){

        try {
            var directChildren = fs.readdirSync(sourceDir);
            directChildren.forEach(function(cfn){
                var sourcePath = sourceDir + path.sep + cfn;
                childPaths.push({
                    path: sourcePath,
                    dir : fs.statSync(sourcePath).isDirectory(),
                    depth: depth
                });
            });
        } catch (e) {
            console.error("Could not list " + sourceDir, e);
        }

    }
    listDir(sourceDir, 1);
    for(var i = 0; i < childPaths.length ; i++){
        var op = childPaths[i];
        if (op.dir) {
            listDir(op.path, op.depth + 1);
        }
    }
    var paths = childPaths.map(function(e){
        return e.path;
    });
    paths.sort();
    return paths;
}



function deleteRecursively(sourceDir) {
    if(!fs.existsSync(sourceDir)){
        throw new Error("Path to delete does not exist: " + sourceDir);
    }
    if(!fs.statSync(sourceDir).isDirectory()){
        fs.unlinkSync(sourceDir);
        //console.log("Deleted file " + sourceDir);
        return;
    }

    var deleteOps = [];

    function deleteDir(sourceDir, depth){
        var directChildren = fs.readdirSync(sourceDir);
        directChildren.forEach(function(cfn){
            var sourcePath = sourceDir + path.sep + cfn;
            deleteOps.push({
                path: sourcePath,
                dir : fs.statSync(sourcePath).isDirectory(),
                depth: depth
            });
        });
    }
    deleteDir(sourceDir, 1);
    for(var i = 0; i < deleteOps.length ; i++){
        var op = deleteOps[i];
        if (op.dir) {
            deleteDir(op.path, op.depth + 1);
        }
    }
    deleteOps.splice(0, 0, {
        path: sourceDir,
        dir: true,
        depth: 0
    });
    deleteOps.sort(function(a,b){
        if(a.dir && !b.dir){
            return 1;
        }
        if(!a.dir && b.dir){
            return -1
        }
        return (a.depth - b.depth)*-1;
    });
    var todel = deleteOps.length;
    while(deleteOps.length > 0){
        var delOp = deleteOps.shift();
        if(delOp.dir){
            fs.rmdirSync(delOp.path);
        }else{
            fs.unlinkSync(delOp.path);
        }
    }
    console.log("Finished deleting " + sourceDir + ": " + todel + " files & dirs deleted");
}

function mkdirsSync(dirPath){
    var thePath = path.normalize(dirPath);
    if(fs.existsSync(thePath)){
        if(fs.statSync(thePath).isDirectory()){
            return;
        }else{
            throw new Error("There is a non dir at path " + thePath);
        }
    }
    var toCreate = [];

    var dp = '' + thePath;
    while(!fs.existsSync(dp)){
        var lastSep = dp.lastIndexOf(path.sep);
        var lastPart = dp.substring(lastSep+1);
        console.log(".. so adding to tocreate: " + lastPart);
        toCreate.unshift(lastPart);
        dp = dp.substring(0, lastSep);
    }
    toCreate.forEach(function(part, idx){
        var ndp = dp + path.sep + part;
        fs.mkdirSync(ndp);
        dp = ndp;
    });

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
    ensureParentDirExists:ensureParentDirExists
};