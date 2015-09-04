var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    wrench = require("wrench"),
    protostarBuilder = require("./protostarBuilder"),
    ncp = require("ncp").ncp,
    utils = require("./utils"),
    Promise = require("bluebird");//,
    //fsp = Promise.promisifyAll(require("fs"));


var logger = utils.createLogger({sourceFilePath : __filename});


function copyMerge(sourcePath, targetPath){
    console.log("copy merge " + sourcePath + " => " + targetPath);
    return new Promise(function(resolve,reject){
        ncp(sourcePath, targetPath, function(err){
            if(err){
                console.error("COPY MERGE error " + sourcePath + " => " + targetPath);
                console.error(err);
                reject(err);
                return;
            }
            console.log("OK copy merge " + sourcePath + " => " + targetPath);
            resolve({
                source:sourcePath,
                target:targetPath
            });
        })
    });
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


function PortalThemeMerger(args) {
    this.args = args;
    this.targetDir = '';
    this.rt;
    this.prj;
    this.cmp;
    this.pathsToCopy = [];

    this.isDirPath = function(filePath){
        try{
            var out = fs.statSync(filePath).isDirectory();
            return out;
        }catch(e){
            return false;
        }
    };

    this.copyReplace = function(cp){
        console.log("copy replacing ", cp);
        var that = this;
        return new Promise(function(resolve,reject){
            console.log("check dir");
            var isDir = that.isDirPath(cp.source);
            if(isDir){
                console.log("rmrf dir");
                wrench.rmdirSyncRecursive(cp.target);
            }
            console.log("performing copy for " + cp.source);
            ncp(cp.source, cp.target, function(err){
                if(err){
                    console.error("FAILED to copy " + cp.source + " -> " + cp.target);
                    reject(err);
                    return;
                }
                console.log("SUCCESSFULLY copied " + cp.source + " -> " + cp.target);
                resolve(cp);
            });
        });
    };
    this.copyPaths = function(copyPaths){
        var that = this;
        console.log("copying " + copyPaths.length + " paths: ", copyPaths);
        //var crp = this.copyReplace;
        return Promise.map(copyPaths, function(cp){
            return that.copyReplace(cp);
        });
    };


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
        return this.isDirPath(this.targetDir);
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
        this.targetDir = this.args.targetDir;
        this.rt = this.args.runtime;
        this.prj = this.args.project;
        this.cmp = this.args.composer;

        if(!this.rt) throw new Error("missing runtime arg");
        if(!this.prj) throw new Error("missing project arg");
        if(!this.cmp) throw new Error("missing composer arg");
        //if(!this.rt) throw new Error("missing runtime arg");
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
            console.log("POPULATED MERGE PATHS = ", mp);
        }
        return mp;
    };


    this.mergeProject = function(successCb, errorCb){
        var that = this;
        this.prepareTargetDirectory();
        var buildDir = this.targetDir + path.sep + 'build';
        var mergeDir = this.targetDir + path.sep + 'merge';
        var themeCopyDir = this.targetDir + path.sep + 'theme';
        var pp = this.args.projectPath;
        var md = mergeDir;

        console.log("Copying " + pp + " => " + md + " ...");
        var rt = this.rt;
        var prj = this.prj;
        var cmp = this.cmp;
        var tp = this.args.themePath;
        var cpPaths = this.pathsToCopy;


        if(!rt.isExistingDirPath(pp)){
            console.error("There is no prototype at path " + pp);
            errorCb("There is no prototype at path " + pp);
            return;
        }
        if(!rt.isExistingDirPath(tp)){
            console.error("There is no portal theme at path " + tp);
            errorCb("There is no portal theme at path " + tp);
            return;
        }
        wrench.copyDirRecursive(pp, md, function(){
            console.log("Copied " + pp + " => " + md);
            var builder = protostarBuilder.createBuilder({
                runtime : rt,
                project : prj,
                composer :cmp,
                targetDir : buildDir,
                ignoreExcludeFromBuild : false
            });

            builder.buildPrototype().done(function(){
                console.log("BUILT " + pp + " => " + buildDir);
                console.log("Copying build dir over merge dir : " +buildDir + " -> " + mergeDir);

                copyMerge(buildDir, mergeDir).then(function(){
                    console.log("Creating theme copy at " + themeCopyDir);
                    return copyMerge(tp, themeCopyDir).catch(function(errz){
                        console.error("Could not merge ", errz);
                    });
                }).then(function(){
                    var mergeConfigPath = mergeDir + path.sep + 'mergeThemeConfig.json';
                    var mp = that.populateMergePaths(mergeConfigPath, mergeDir, themeCopyDir);
                    that.pathsToCopy = mp;
                    console.log("copying the paths");
                    return that.copyPaths(mp).then(function(){
                        console.log("PROM COPIED ALL");
                        successCb();
                    }).catch(function(cpErrs){
                        console.error("fail copy ", cpErrs);
                        errorCb();
                    });
                }).catch(function(errors){
                    console.error("copy steps error", errors);
                    errorCb(errors);
                });
            }, function(errors){
                console.log("BUILD ERROR " + errors);
                errorCb(errors);
            });
        });
    };
    this.parseArgs();
}

module.exports = {

    merge:function(args, successCb, errorCb){
        var ptm = new PortalThemeMerger(args);
        ptm.mergeProject(successCb, errorCb);
    }

};