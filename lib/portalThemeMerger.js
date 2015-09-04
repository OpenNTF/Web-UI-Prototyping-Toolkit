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

    this.copyReplace = function(cp){
        var t = this.rt;
        return new Promise(function(resolve,reject){
            var isDir = t.isExistingDirPath(cp.source);
            if(isDir){
                wrench.rmdirSyncRecursive(cp.target);
            }
            ncp(cp.source, cp.target, function(err){
                if(err){
                    console.error("FAILED to copy " + cp.source + " -> " + cp.target);
                    reject(err);
                    return;
                }
                console.log("SUCCESSFULLY copied " + cp.source + " -> " + cp.target);
                resolve(cp);
            });

            //fsp.statAsync(cp.source).then(function(stat){
            //    if(stat.isDirectory()){
            //
            //    }
            //}).catch(function(errors){
            //    console.error("ERrors while copying : " + errors, cp);
            //});

        });
    };
    this.copyPaths = function(copyPaths){
        var crp = this.copyReplace;
        //return Promise.map(copyPaths, this.copyReplace);
        return Promise.map(copyPaths, function(cp){
            return crp(cp.source, cp.target);/*.then(function(c){
             console.log("PROM COPIED ", c);
             });*/
        });
        //return new Promise(function(resolve, reject){
        //    var idx = 0;
        //    while((idx+1) < copyPaths.length){
        //        var cp = copyPaths[idx];
        //        var copyPromise = copyReplace(cp.source, cp.target);
        //
        //    }
        //
        //});

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
        var exists = false;
        if (this.rt.isExistingPath(this.targetDir)) {
            if(this.rt.isExistingDirPath(this.targetDir)){
                exists = true;
            }else{
                throw new Error("Build targetDir path exists but it's no directory: " + this.targetDir);
            }
        }
        return exists;
    };

    this.emptyTargetDir = function(){
        var files = this.rt.listDir(this.targetDir);
        var td = this.targetDir;
        files.forEach(function (f) {
            var fp = td + "/" + f;
            if (runtime.isExistingDirPath(fp)) {
                wrench.rmdirSyncRecursive(fp, false);
            } else {
                runtime.deleteFile(fp);
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

    this.parseArgs();

    this.mergeProject = function(successCb, errorCb){
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
        //var processedIdx = 0;
        //function processIdx(idx){
        //    var src = cpPaths[idx].source;
        //    var trg = cpPaths[idx].target;
        //    if(rt.isExistingPath(src)){
        //        if(rt.isExistingDirPath(src)){
        //            wrench.rmdirSyncRecursive(trg);
        //        }else{
        //
        //        }
        //        console.log("NCP " + src + ' -> ' + trg);
        //        ncp(src, trg, function(pe){
        //            if(pe){
        //                throw new Error(pe);
        //            }
        //            cb();
        //        });
        //    }
        //}
        //function cb(){
        //    console.log("COPIED : ", cpPaths[processedIdx]);
        //    processedIdx++;
        //    if(cpPaths.length >= (processedIdx+1)){
        //        processIdx(processedIdx);
        //    }else{
        //        successCb();
        //    }
        //
        //}

        function populateMergePaths(mergeConfigPath){
            if(rt.isExistingFilePath(mergeConfigPath)){
                var mergeConfig = JSON.parse(rt.readFile(mergeConfigPath))
                var mergePaths = mergeConfig.mergePaths;
                for(var prototypePath in mergePaths){
                    var themePath = mergePaths[prototypePath];
                    console.log('Need to copy ' + prototypePath + ' -> ' + themePath);
                    var sourcePath;
                    if(prototypePath === '<root>'){
                        sourcePath = mergeDir;
                    }else{
                        sourcePath = mergeDir + path.sep + prototypePath;
                    }
                    var targetPath = themeCopyDir + path.sep + themePath;
                    cpPaths.push({
                        source:sourcePath,
                        target:targetPath
                    });

                }
                console.log("POPULATED MERGE PATHS = ", cpPaths);
            }
        }

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
        //var crp = this.copyReplace;
        var cpp = this.copyPaths;
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
                    return copyMerge(tp, themeCopyDir);
                }).then(function(){
                    var mergeConfigPath = mergeDir + path.sep + 'mergeThemeConfig.json';
                    populateMergePaths(mergeConfigPath);
                    return cpp(cpPaths).then(function(){
                        console.log("PROM COPIED ALL");
                        successCb();
                    })/*.catch(function(errors){
                        console.error("PROM COPY ERROR", errors);
                        errorCb(errors);
                    });*/
                }).catch(function(errors){
                    console.error("copy steps error", errors);
                    errorCb(errors);
                });

                //ncp(buildDir, mergeDir, function(err){
                //    if(err){
                //        console.error("Could not overwrite/copy from build to merge", err);
                //        throw new Error("Could not overwrite/copy from build to merge");
                //    }
                //    console.log("Copied build dir over merge dir : " +buildDir + " -> " + mergeDir);
                //    console.log("Creating theme copy of " +tp + " at " + themeCopyDir);
                //    ncp(tp, themeCopyDir, function(err2){
                //        if(err2){
                //            throw new Error("error creating theme copy");
                //        }
                //        console.log("Created theme copy of " +tp + " at " + themeCopyDir);
                //        var mergeConfigPath = mergeDir + path.sep + 'mergeThemeConfig.json';
                //        populateMergePaths(mergeConfigPath);
                //        copyPaths(cpPaths).then(function(){
                //            console.log("PROM COPIED ALL");
                //            successCb();
                //        }).catch(function(errors){
                //            console.error("PROM COPY ERROR", errors);
                //            errorCb();
                //        });
                //        //if(rt.isExistingFilePath(mergeConfigPath)){
                //        //    var mergeConfig = JSON.parse(rt.readFile(mergeConfigPath))
                //        //    var mergePaths = mergeConfig.mergePaths;
                //        //    for(var prototypePath in mergePaths){
                //        //        var themePath = mergePaths[prototypePath];
                //        //        console.log('Need to copy ' + prototypePath + ' -> ' + themePath);
                //        //        var sourcePath;
                //        //        if(prototypePath === '<root>'){
                //        //            sourcePath = mergeDir;
                //        //        }else{
                //        //            sourcePath = mergeDir + path.sep + prototypePath;
                //        //        }
                //        //        var targetPath = themeCopyDir + path.sep + themePath;
                //        //        cpPaths.push({
                //        //            source:sourcePath,
                //        //            target:targetPath
                //        //        });
                //        //
                //        //    }
                //        //
                //        //    if(cpPaths.length >= (processedIdx+1)){
                //        //
                //        //        processIdx(processedIdx);
                //        //        //while(cpPaths.length >= (processedIdx+1)){
                //        //        //
                //        //        //    processedIdx(processedIdx, function(){
                //        //        //
                //        //        //    });
                //        //        //}
                //        //        //ncp(cpPaths[processedIdx].source, cpPaths[processedIdx].target, function(pe){
                //        //        //    if(pe){
                //        //        //        throw new Error(pe);
                //        //        //    }
                //        //        //});
                //        //    }
                //        //
                //        //}
                //        //successCb();
                //    });
                //
                //
                //
                //});

            }, function(errors){
                console.log("BUILD ERROR " + errors);
                errorCb(errors);
            });
        });
    };

}


module.exports = {

    merge:function(args, successCb, errorCb){
        var ptm = new PortalThemeMerger(args);
        ptm.mergeProject(successCb, errorCb);
    }

};