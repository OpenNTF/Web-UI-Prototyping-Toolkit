"use strict";
var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    Promise = require("bluebird"),
    utils = require("./utils"),
    copier = require("./copier"),
    protostarBuilder = require("./protostarBuilder"),
    osTmpdir = require("os-tmpdir"),
    AdmZip = require("adm-zip"),
    lessCompiler = require("./lessCompiler");



function relativize(paths, refDirPath){
    var out = [];
    var rdp = refDirPath;

    if(rdp.charAt(rdp.length-1) !== '/'){
        rdp = rdp + "/";
    }
    paths.forEach(function(p){
        if(p.indexOf(rdp) === 0){
            out.push(p.substring(rdp.length));
        }
    });
    return out;
}

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
            this.createBuiltByProtostarFile(this.targetDir);
            //var projectDir = this.targetDir;

            //this.rt.writeFile(path.join(projectDir, ".protostar-project-built"), "This directory is created by building a Protostar prototype so can be overwritten by protostar.");
        } else {
            logger.info("Created build target directory: " + this.targetDir);
            this.rt.mkdirs(this.targetDir);
            this.rt.writeFile(path.join(this.targetDir, ".protostar-project-built"), "This directory is created by building a Protostar prototype so can be overwritten by protostar.");
        }
    };

    this.createBuiltByProtostarFile = function(projectBuildPath){
        this.rt.writeFile(path.join(projectBuildPath, ".protostar-project-built"), "This directory is created by building a Protostar prototype so can be overwritten by protostar.");
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
        logger.debug("Parsing PortalThemeMerger instance arguments: ", this.args);
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
            logger.debug("Populated merge paths: ", mp);
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
        this.createBuiltByProtostarFile(targetMergeDirPath);
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

    function repeatChars(char, times){
        var out = '';
        for(var i = 0 ; i < times ; i++){
            out += char;
        }
        return out;
    }

    this.packageSelfContainedComponentsDir = function(sourceDirPath, targetComponentsDirPath, fnPrefix){
        console.log("Creating component dirs below " + sourceDirPath + " to " + targetComponentsDirPath);
        if(!this.rt.isExistingDirPath(targetComponentsDirPath)){
            throw new Error("Path does not exist : " + targetComponentsDirPath);
        }
        var easyScriptPortletComponents = [];
        var that = this;
        var children = fs.readdirSync(sourceDirPath);
        var cmpIdx = 0;
        children.forEach(function(dn){
            var childPath= path.resolve(sourceDirPath, dn);
            if(fs.statSync(childPath).isDirectory()){
                var workingDir = targetComponentsDirPath + path.sep + dn;
                cmpIdx += 1;
                var header = "\n\n" + cmpIdx + ". Component dir " + workingDir;
                console.info(header);
                console.info(repeatChars('#', header.length)+"\n");
                try {
                    copier.copy(childPath, workingDir);
                    var easyScriptPortletReady = that.prepareComponentDir(workingDir);
                    if(easyScriptPortletReady){
                        easyScriptPortletComponents.push(dn + ".zip = " + workingDir);
                    }
                    var zip = new AdmZip();
                    zip.addLocalFolder(workingDir, dn);
                    var zipFileName = (typeof fnPrefix === 'string') ? fnPrefix : "";
                    zipFileName = zipFileName + dn + ".zip";
                    var targetZipPath = targetComponentsDirPath + path.sep + zipFileName;

                    zip.writeZip(targetZipPath);
                    console.log("Wrote component zip to " + targetZipPath+".\n");
                } catch (e) {
                    console.error("Could not prepare and create component zip for " + childPath, e);
                    console.error(e.stack);
                    throw e;
                }
            }
        });
        console.log("\nFinished component zip creation for "+cmpIdx+" components. \nFound easy script portlets: ", easyScriptPortletComponents);
    };

    this.prepareComponentDir = function(cmpDir){
        var that = this;
        copier.listDirChildrenFullPathsRecursively(cmpDir).forEach(function(p, idx){
            if(p.indexOf('-') >0 && p.substring(p.lastIndexOf('-')) === '-compiled.css'){
                fs.unlinkSync(p);
            }
        });
        var paths = copier.listDirChildrenFullPathsRecursively(cmpDir);
        var removedIdxs = [];
        var toRemove = [];
        var files = {
            html : [],
            css: [],
            js: []
        };
        var lessPaths = [];
        paths.forEach(function(p, idx){
            var ext = path.extname(p);
            switch (ext){
                case '.less':
                    lessPaths.push(p);
                case '.jade':
                case '.scss':
                    fs.unlinkSync(p);
                    toRemove.push(p);
                    removedIdxs.push(idx);
                    break;
                case '.html':
                    files.html.push(p);
                    break;
                case '.js':
                    files.js.push(p);
                    break;
                case '.css':
                    files.css.push(p);
                    break;
                default:
                    break;
            }
        });
        console.log("Found component files: ", files);
        removedIdxs.reverse();
        removedIdxs.forEach(function(idx){
            paths.splice(idx, 1)
        });

        var relativeFiles = {
            html: relativize(files.html, cmpDir),
            js: relativize(files.js, cmpDir),
            css: relativize(files.css, cmpDir)
        };
        console.log("Relativized component files: ", relativeFiles);
        var allReferenceables = [].concat(relativeFiles.js).concat(relativeFiles.css);
        console.log("Checking for referenceables : ", allReferenceables);
        files.html.forEach(function(htmlPath){
            var html = utils.readTextFileSync(htmlPath);
            allReferenceables.forEach(function(refPath){
                try {
                    var query = refPath + '"';
                    var endIdx = html.indexOf(query);
                    if (endIdx > 0) {
                        var attrName = path.extname(refPath) === ".js" ? "src" : "href";
                        console.log("HTML " + htmlPath + " contains a ref that needs to be encoded to " + refPath);
                        var firstQuoteIdx = html.lastIndexOf('"', endIdx);
                        var closingQuote = html.indexOf('"', firstQuoteIdx + 1);
                        var toReplace = attrName + "=" + html.substring(firstQuoteIdx, closingQuote + 1);
                        var replacement = attrName + '="' + refPath + '"';
                        var outHtml = "" + html;
                        console.log("Replacing '" + toReplace + "' with '" + replacement + "'");
                        var lastCritIdx = outHtml.lastIndexOf(toReplace);
                        while (lastCritIdx >= 0) {
                            var before = outHtml.substring(0, lastCritIdx);
                            var after = outHtml.substring(lastCritIdx + toReplace.length);
                            outHtml = before + replacement + after;
                            lastCritIdx = outHtml.lastIndexOf(toReplace);
                        }
                        if (html !== outHtml) {
                            console.log("Saving modified html to" + htmlPath + " (for " + refPath + ")");
                            utils.writeFile(htmlPath, outHtml);
                        }
                    }
                } catch (e) {
                    console.error("Error during processing " + cmpDir, e);
                    throw e;
                }
            })
        });
        var easy = relativeFiles.html.length === 1 && relativeFiles.js.length <= 1 && relativeFiles.css.length <= 1;
        if(easy){
            var htmlPath = files.html[0];
            var cnt ="";
            var read = false;
            var initCnt = "";
            if(relativeFiles.js.length === 1){
                cnt = utils.readTextFileSync(htmlPath);
                initCnt = "" + cnt;
                read = true;
                var firstJs = relativeFiles.js[0];
                if(cnt.indexOf(firstJs + '"') < 0){
                    var src = firstJs;
                    var scriptTag = '\n'+'<script type="text/javascript" src="' + src + '"></script>'+'\n';
                    console.log("Adding script tag to " + htmlPath + " for " + firstJs);
                    cnt = cnt + scriptTag;
                }
            }
            if(relativeFiles.css.length === 1){
                if(!read){
                    cnt = utils.readTextFileSync(htmlPath);
                    initCnt = "" + cnt;
                }
                var firstCss = relativeFiles.css[0];
                if(cnt.indexOf(firstCss + '"') < 0){
                    var linktag = '<link rel="stylesheet" href="'+firstCss+'"/>';
                    cnt = '\n'+linktag+'\n' + cnt;
                    console.log("Adding css link tag to " + htmlPath + " for " + firstCss);
                }
            }
            if(read && (cnt.length > 0 && (initCnt !== cnt))){
                utils.writeFile(htmlPath, cnt);
            }
            logger.info("Prepared an easy portlet: " + cmpDir);
        }else{
            logger.info("Not an easy portlet: " + cmpDir + ": ", relativeFiles);
        }
        return easy;
    };

    this.compileAllLessFilesPromise = function(cmpDirsParentDirPaths){
        var lessPromises = [];
        cmpDirsParentDirPaths.forEach(function(cmpDirsParentDirPath){
            var lessPaths = copier.listDirChildrenFullPathsRecursively(cmpDirsParentDirPath).filter(function(p){
                return path.extname(p) === '.less';
            });

            function compileLessPromise(srcPath){
                return new Promise(function(resolve, reject){
                    lessCompiler.compilePromise(srcPath, [path.dirname(srcPath)], utils.readTextFileSync(srcPath), path.dirname(srcPath))
                        .done(function(css, sourceMap, depPaths){
                            var baseName = srcPath.substring(0, srcPath.lastIndexOf('.')) + '.css';
                            console.log("Writing CSS for component " + baseName);
                            fs.writeFileSync(baseName, css.toString());
                            resolve();
                        }, function(erss){
                            console.error("Could not generate less for component " + srcPath, erss);
                            resolve();
                        })
                });
            }
            lessPaths.forEach(function (lessPath){
                lessPromises.push(compileLessPromise(lessPath));
            });
        });
        return Promise.all(lessPromises);
    };

    this.createPackageZips = function(cmpDirsArray){
        var that = this;
        return new Promise(function(resolve, reject){
            that.compileAllLessFilesPromise(cmpDirsArray).done(function(){
                console.log("Finished trying to compile all component less files in ", cmpDirsArray);
                cmpDirsArray.forEach(function(prjDirPath, idx){
                    var prefix = cmpDirsArray.length > 1 ? "dir_" + (idx+1) + "_" : "";
                    var cmpSourceDirPath = prjDirPath;
                    var appZipsDir = that.targetDir + path.sep + 'components';
                    copier.mkdirsSync(appZipsDir);
                    if(prefix){
                        that.packageSelfContainedComponentsDir(cmpSourceDirPath, appZipsDir, "dir_" + (idx+1) + "_");
                    }else{
                        that.packageSelfContainedComponentsDir(cmpSourceDirPath, appZipsDir);
                    }
                });
                console.log("Finished packaging component dirs");
                resolve();
            });
        });
    };

    this.mergeComponent = function(componentDirPath){
        var that = this;
        return new Promise(function(resolve, reject){
            that.createPackageZips([componentDirPath]).done(function(){
                console.log("Finished creating component packages for "+componentDirPath);
                resolve();
            });

        });

    };

    this.mergeProject = function(){
        var that = this;
        var themeSourcePath = that.args.themePath;
        this.prepareTargetDirectory();
        var targetBuildDirPath = that.targetDir + path.sep + 'build';
        var targetMergeDirPath = that.targetDir + path.sep + 'merge';
        copier.mkdirsSync(targetMergeDirPath);
        this.createBuiltByProtostarFile(targetMergeDirPath);
        var targetThemeDirPath = that.targetDir + path.sep + 'theme';
        copier.mkdirsSync(targetThemeDirPath);
        var projectSourceDirPath = that.args.projectPath;
        console.log("Copying " + projectSourceDirPath + " => " + targetMergeDirPath + " ...");
        if(!that.rt.isExistingDirPath(projectSourceDirPath)){
            throw new Error("There is no prototype at path " + projectSourceDirPath);
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
                console.log("Copying build directory " + targetBuildDirPath + " to merge working directory " + targetMergeDirPath);
                copier.copy(targetBuildDirPath, targetMergeDirPath);
                console.log("Copying theme source dir " + themeSourcePath + " to  theme working directory " + targetThemeDirPath);
                if(!that.rt.isExistingDirPath(targetThemeDirPath)){
                    fs.mkdirSync(targetThemeDirPath);
                }
                copier.copy(themeSourcePath, targetThemeDirPath);
                var mergeConfigPath = targetMergeDirPath + path.sep + 'mergeThemeConfigWar.json';
                console.info("Populating merge paths from WAR mergeConfig at " + mergeConfigPath);
                var mp = that.populateMergePaths(mergeConfigPath, targetMergeDirPath, targetThemeDirPath);
                that.pathsToCopy = mp;
                copyThePaths(that.pathsToCopy);
                var mergeConfig = that.readPrototypeMergeConfig(mergeConfigPath);
                if(mergeConfig.hasOwnProperty("packageAppDirsParents")){
                    var value = mergeConfig.packageAppDirsParents;
                    var valueType = Object.prototype.toString.call(value);
                    valueType = valueType.substring(valueType.indexOf(' ')+1, valueType.length -1);
                    var cmpDirsArray = [];
                    if(valueType === 'Array' && value.length > 0){
                        cmpDirsArray = value.map(function(p){
                            return path.resolve(targetMergeDirPath, p);
                        });
                    }else if(valueType === 'String' && valueType.length > 0){
                        cmpDirsArray = [path.resolve(targetMergeDirPath, value)];
                    }else{
                        cmpDirsArray = [];
                    }
                    if(cmpDirsArray.length  >0){
                        that.createPackageZips(cmpDirsArray).done(function(){
                            resolve();
                        })
                    }else{
                        resolve();
                    }
                }else{
                    console.info("Don't need to create self contained component dir zips");
                    resolve();
                }

            }, function(){
                console.error("ERROR", arguments)
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