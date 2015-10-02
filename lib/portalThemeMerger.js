"use strict";
var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    Promise = require("bluebird"),
    utils = require("./utils"),
    copier = require("./copier"),
    protostarBuilder = require("./protostarBuilder"),
    osTmpdir = require("os-tmpdir");




var logger = utils.createLogger({sourceFilePath : __filename});

/*
 1. create a directory to hold the merged files
 2. copy all prototype sources into that dir
 3. build the prototype to a different dir and copy over the built files into the merge dir
 make sure the theme module dirs (dsvThemeShared etc) files are in sync with prototype
 4. remove the 'dav' dir - (it holds portal originating files in the prototype) replace the contents of the angularTheme-static/src/main/webapp/themes/angularTheme/angularApps/mydsv dir with the contents of the build dir
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
        copier.copy(cp.source, cp.target);
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

    this.prepareTargetStaticDirectory = function(){
        if(typeof this.targetDir !== 'string' || !this.targetDirExists()){
            throw new Error("Illegal targetDir: " + this.targetDir + ", it should exist (used as source as well)");
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
                copier.deleteRecursively(fp);
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

    this.readPrototypeMergeConfig = function(mergeConfigPath){
        try {
            return JSON.parse(this.rt.readFile(mergeConfigPath));
        } catch (e) {
            e.message = "Could not read mergeConfig from " + mergeConfigPath;
            throw new e;
        }
    };

    this.prototypeMergeConfigExists = function(mergeConfigPath){
        return this.rt.isExistingFilePath(mergeConfigPath);
    };

    this.populateMergePaths = function(mergeConfigPath, mergeDir, themeCopyDir){
        var mp = [];
        if(this.rt.isExistingFilePath(mergeConfigPath)){
            var mergeConfig = this.readPrototypeMergeConfig(mergeConfigPath);
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
    this.mergeStatic = function(){
        var that = this;
        var themeSourcePath = that.targetDir;
        this.prepareTargetStaticDirectory();
        var tmpDirPath = osTmpdir() + path.sep + ("_psMergeTemp_"+ new Date().getTime());
        var targetBuildDirPath = tmpDirPath + path.sep + 'build';
        var targetMergeDirPath = tmpDirPath + path.sep + 'merge';
        copier.mkdirsSync(targetMergeDirPath);
        var targetThemeDirPath = tmpDirPath + path.sep + 'theme';
        copier.mkdirsSync(targetThemeDirPath);
        var projectSourceDirPath = that.args.projectPath;
        console.log("Copying " + projectSourceDirPath + " => " + targetMergeDirPath + " ...");
        if(!that.rt.isExistingDirPath(projectSourceDirPath)){
            throw new Error("There is no prototype at path " + projectSourceDirPath);
        }
        if(!that.rt.isExistingDirPath(themeSourcePath)){
            throw new Error("There is no portal theme at path " + themeSourcePath);
        }
        if(!that.rt.isExistingDirPath(targetMergeDirPath)){
            fs.mkdirSync(targetMergeDirPath);
        }
        copier.copy(projectSourceDirPath, targetMergeDirPath);
        return new Promise(function(resolve, reject){
            var builder = protostarBuilder.createBuilder({
                runtime : that.rt,
                project : that.prj,
                composer :that.cmp,
                targetDir : targetBuildDirPath,
                ignoreExcludeFromBuild : false
            });

            builder.buildPrototype().done(function(){
                console.log("copy " + targetBuildDirPath + " => " + targetMergeDirPath);
                copier.copy(targetBuildDirPath, targetMergeDirPath);
                console.log("copy " + themeSourcePath + " => " + targetThemeDirPath);
                if(!that.rt.isExistingDirPath(targetThemeDirPath)){
                    fs.mkdirSync(targetThemeDirPath);
                }
                copier.copy(themeSourcePath, targetThemeDirPath);
                var mergeConfigPath = targetMergeDirPath + path.sep + 'mergeThemeConfigStatic.json';
                console.info("Populating merge configuration (paths to copy) " + mergeConfigPath);
                var mp = that.populateMergePaths(mergeConfigPath, targetMergeDirPath, targetThemeDirPath);
                that.pathsToCopy = mp;
                //console.log("copying the paths");
                copyThePaths(that.pathsToCopy);
                console.info("Copying collected and combined files from " + targetThemeDirPath + " back to " + that.targetDir +  " ...");
                copier.copy(targetThemeDirPath, that.targetDir);
                console.info("Finished pusing collected and combined files from " + targetThemeDirPath + " back to " + that.targetDir );
                console.info("Deleting temp dir " + tmpDirPath);
                copier.deleteRecursively(tmpDirPath);
                console.info("Static Merge finished successfully to " + that.targetDir);
                resolve();
            }, function(){
                reject()
            });
        });


    };

    this.mergeProject = function(){

        var that = this;
        var themeSourcePath = that.args.themePath;
        this.prepareTargetDirectory();
        var targetBuildDirPath = that.targetDir + path.sep + 'build';
        copier.mkdirsSync(targetBuildDirPath);
        var targetMergeDirPath = that.targetDir + path.sep + 'merge';
        copier.mkdirsSync(targetMergeDirPath);
        var targetThemeDirPath = that.targetDir + path.sep + 'theme';
        copier.mkdirsSync(targetThemeDirPath);
        var projectSourceDirPath = that.args.projectPath;
        console.log("Copying " + projectSourceDirPath + " => " + targetMergeDirPath + " ...");
        if(!that.rt.isExistingDirPath(projectSourceDirPath)){
            throw new Error("There is no prototype at path " + projectSourceDirPath);
        }
        if(!that.rt.isExistingDirPath(themeSourcePath)){
            throw new Error("There is no portal theme at path " + themeSourcePath);
        }
        if(!that.rt.isExistingDirPath(targetMergeDirPath)){
            fs.mkdirSync(targetMergeDirPath);
        }
        copier.copy(projectSourceDirPath, targetMergeDirPath);
        return new Promise(function(resolve, reject){
            var builder = protostarBuilder.createBuilder({
                runtime : that.rt,
                project : that.prj,
                composer :that.cmp,
                targetDir : targetBuildDirPath,
                ignoreExcludeFromBuild : false
            });

            builder.buildPrototype().done(function(){
                console.log("copy " + targetBuildDirPath + " => " + targetMergeDirPath);
                copier.copy(targetBuildDirPath, targetMergeDirPath);
                console.log("copy " + themeSourcePath + " => " + targetThemeDirPath);
                if(!that.rt.isExistingDirPath(targetThemeDirPath)){
                    fs.mkdirSync(targetThemeDirPath);
                }
                copier.copy(themeSourcePath, targetThemeDirPath);
                var mergeConfigPath = targetMergeDirPath + path.sep + 'mergeThemeConfigWar.json';
                console.info("POPULATING PATHS FROM " + mergeConfigPath);
                var mp = that.populateMergePaths(mergeConfigPath, targetMergeDirPath, targetThemeDirPath);
                that.pathsToCopy = mp;
                //console.log("copying the paths");
                copyThePaths(that.pathsToCopy);
                var mergeCfg = that.readPrototypeMergeConfig(mergeConfigPath);
                if(mergeCfg.hasOwnProperty("targetLocalDavPath") && typeof mergeCfg.targetLocalDavPath === 'string'){
                    var mergeDirStaticFilesFallback = that.targetDir + path.sep + 'staticThemeFiles';
                    var localDavPath = mergeCfg.targetLocalDavPath;
                    if(localDavPath === 'auto' || localDavPath === ''){
                        localDavPath = mergeDirStaticFilesFallback;
                    }else{
                        if(!that.rt.isExistingDirPath(localDavPath)){
                            console.info("Target dir for static files does not exist, reverting to " + mergeDirStaticFilesFallback)
                            localDavPath = mergeDirStaticFilesFallback;
                        }
                    }
                }
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
    },
    mergeStatic:function(args){
        var ptm = new PortalThemeMerger(args);
        return ptm.mergeStatic();
    }

};