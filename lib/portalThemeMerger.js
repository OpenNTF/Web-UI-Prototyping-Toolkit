"use strict";
var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    wrench = require("wrench"),
    protostarBuilder = require("./protostarBuilder"),
    utils = require("./utils"),
    Promise = require("bluebird");


var logger = utils.createLogger({sourceFilePath : __filename});

var dirsCreated = 0;
var filesCopied = 0;

var openFiles = 0;
function copyFile(source, target){
    var instr = fs.createReadStream(source);
    openFiles++;
    var outstr = fs.createWriteStream(target);
    openFiles++;
    instr.pipe(outstr);
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
    if(!fs.statSync(targetDir).isDirectory()){
        processCopyOp({
            source:sourceDir,
            target:targetDir,
            dir:false
        });
        console.log("Copied file " + sourceDir + " -> " + targetDir);
        return;
    }
    if(!fs.existsSync(targetDir)){
        wrench.mkdirSyncRecursive(targetDir);
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
                    dirsCreated++;
                }
            }else{
                fs.mkdirSync(copyOp.target);
                dirsCreated++;
            }
            processDir(copyOp.source, copyOp.target);
        }else{
            if(targetExists){
                var targetStat = fs.statSync(copyOp.target);
                targetOkType = targetStat.isFile();
                if(!targetOkType){
                    if(targetStat.isDirectory()){
                        wrench.rmdirSyncRecursive(copyOp.target)
                    }
                }
            }
            //console.log("stream copy " + copyOp.source + "->" + copyOp.target);
            filesCopied++;
            copyFile(copyOp.source, copyOp.target);
        }
    }
    processDir(sourceDir, targetDir);
    var done = 0;
    while(copyOps.length > 0){
        var op = copyOps.shift();
        processCopyOp(op);
        done++;
        if(done%100 === 0){
            console.log("Copied " + done + " so far ...");
        }
    }
    console.log("Processed " + done + " ops.");

}

/*
 1. create a directory to hold the merged files
 2. copy all prototype sources into that dir
 3. build the prototype to a different dir and copy over the built files into the merge dir
 make sure the theme module dirs (dsvThemeShared etc) files are in sync with prototype
 4. remove the 'dav' dir - (it holds portal originating files in the prototype)
 replace the contents of the angularTheme-static/src/main/webapp/themes/angularTheme/angularApps/mydsv dir with the contents of the build dir
 make sure that any prereqs (eg js & css like angular modules etc) are configured as contributions and loaded in the right order so that the dependencies are present in portal
 ensure layouts & theme templates are up to date
 */



/*
 So this is the current flow and files when delivering for portlets:
 - The markup for that portlet (compiled from our .jade by Protostar) with a normal <link> to the css (to make it obvious for the dev.).
 Downside to this is the path will not be correct and needs to be changed by the dev.
 - The css for that portlet (compiled by whatever tool we have, like a webstorm plugin).
 Downside to this is we need to import the relevant bootstrap less files and our own mixins/variables in the less file (a convenience issue)
 - The JS for the portlet. No immediate downside (unless of course there are new theme js that needs to be added,
 which means we have to wait for this entire theme deployment cycle to be complete before we can test our new portlet).

 */

var isDirPath = function(filePath){
    try{
        return fs.statSync(filePath).isDirectory();
    }catch(e){
        return false;
    }
};

var copyThePaths = function(copyPaths){
    logger.info("copying " + copyPaths.length + " paths: ", copyPaths);
    //var prom = [];
    copyPaths.forEach(function(cp){
        mergeDirs(cp.source, cp.target);
    });
};

function PortalThemeMerger(args) {
    this.args = args;
    this.targetDir = '';
    this.rt;
    this.prj;
    this.cmp;
    this.pathsToCopy = [];

    this.prepareTargetDirectory = function(){
        if(typeof this.targetDir !== 'string'){
            throw new Error("Illegal targetDir: " + this.targetDir);
        }
        if (this.targetDirExists()) {
            if(!this.rt.isExistingFilePath(path.join(this.targetDir, ".protostar-project-built"))){
                throw new Error("targetDir probably wasnt created by protostar (doesnt contain file .protostar-project-built) so refusing to delete/overwrite! " + targetDir);
            }
            this.emptyTargetDir();
            this.rt.writeFile(path.join(this.targetDir, ".protostar-project-built"), "This directory is created by building a Protostar prototype so can be overwritten by protostar.");
        } else {
            logger.info("Created build target directory: " + this.targetDir);
            this.rt.mkdirs(this.targetDir);
            this.rt.writeFile(path.join(this.targetDir, ".protostar-project-built"), "This directory is created by building a Protostar prototype so can be overwritten by protostar.");
        }
    };

    this.targetDirExists = function(){
        return isDirPath(this.targetDir);
     };

    this.emptyTargetDir = function(){
        var files = this.rt.listDir(this.targetDir);
        var td = this.targetDir;
        var rt = this.rt;
        files.forEach(function (f) {
            var fp = td + "/" + f;
            if (rt.isExistingDirPath(fp)) {
                wrench.rmdirSyncRecursive(fp, false);
            } else {
                rt.deleteFile(fp);
            }
        });
        logger.info("Emptied " + this.targetDir);
    };
    this.parseArgs = function(){
        logger.debug("PARSING MERGE ARGS: ", this.args);
        this.targetDir = this.args.targetDir;
        this.rt = this.args.runtime;
        this.prj = this.args.project;
        this.cmp = this.args.composer;
        if(!this.rt) throw new Error("missing runtime arg");
        if(!this.prj) throw new Error("missing project arg");
        if(!this.cmp) throw new Error("missing composer arg");
    };

    this.populateMergePaths = function(mergeConfigPath, mergeDir, themeCopyDir){
        var mp = [];
        if(this.rt.isExistingFilePath(mergeConfigPath)){
            var mergeConfig = JSON.parse(this.rt.readFile(mergeConfigPath));
            for(var prototypePath in mergeConfig.mergePaths){
                var themePath = mergeConfig.mergePaths[prototypePath];
                console.log('Need to copy ' + prototypePath + ' -> ' + themePath);
                var sourcePath;
                if(prototypePath === '<root>'){
                    sourcePath = mergeDir;
                }else{
                    sourcePath = mergeDir + path.sep + prototypePath;
                }
                var targetPath = themeCopyDir + path.sep + themePath;
                mp.push({
                    source:sourcePath,
                    target:targetPath
                });
            }
            logger.debug("POPULATED MERGE PATHS = ", mp);
        }
        return mp;
    };

    this.mergeProject = function(){
        var that = this;
        var rt = this.rt;
        var prj = this.prj;
        var cmp = this.cmp;
        var tp = this.args.themePath;
        that.prepareTargetDirectory();
        var buildDir = that.targetDir + path.sep + 'build';
        var mergeDir = that.targetDir + path.sep + 'merge';
        var themeCopyDir = that.targetDir + path.sep + 'theme';
        var projectDirPath = that.args.projectPath;
        var mergeDirPath = mergeDir;
        console.log("Copying " + projectDirPath + " => " + mergeDirPath + " ...");
        if(!rt.isExistingDirPath(projectDirPath)){
            throw new Error("There is no prototype at path " + projectDirPath);
        }
        if(!rt.isExistingDirPath(tp)){
            throw new Error("There is no portal theme at path " + tp);
        }
        if(!rt.isExistingDirPath(mergeDirPath)){
            fs.mkdirSync(mergeDirPath);
        }
        mergeDirs(projectDirPath, mergeDirPath);
        return new Promise(function(resolve, reject){
            var builder = protostarBuilder.createBuilder({
                runtime : rt,
                project : prj,
                composer :cmp,
                targetDir : buildDir,
                ignoreExcludeFromBuild : false
            });

            builder.buildPrototype().done(function(){
                console.log("copy " + buildDir + " => " + mergeDir);
                mergeDirs(buildDir, mergeDir);
                console.log("copy " + tp + " => " + themeCopyDir);
                if(!rt.isExistingDirPath(themeCopyDir)){
                    fs.mkdirSync(themeCopyDir);
                }
                mergeDirs(tp, themeCopyDir);
                var mergeConfigPath = mergeDir + path.sep + 'mergeThemeConfig.json';
                console.info("POPULATING PATHS FROM " + mergeConfigPath);
                var mp = that.populateMergePaths(mergeConfigPath, mergeDir, themeCopyDir);
                that.pathsToCopy = mp;
                //console.log("copying the paths");
                copyThePaths(that.pathsToCopy);
                console.log("Created " + dirsCreated + " dirs and copied " + filesCopied + " files");
                resolve();
            }, function(){
                reject()
            });
        });
    };
    this.parseArgs();
}

module.exports = {

    merge:function(args){
        var ptm = new PortalThemeMerger(args);
        return ptm.mergeProject();
    }

};