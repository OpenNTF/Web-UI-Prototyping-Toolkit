/**
 * Copyright 2014 IBM Corp.
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var path = require("path");
var fs = require("./filesystem");
var jqueryRunner = require("./jqueryRunner");
var lessCompiler = require("./lessCompiler");
var jadeUtils = require("./jadeUtils");
var utils = require("./utils");
var sassCompiler = require("./sassCompiler");
var deferred = require("deferred");
var AdmZip = require("adm-zip");
var logger = utils.createLogger({sourceFilePath : __filename});

var copier = require("./copier");

function Builder(args) {
    var project, composer, ignoreExcludeFromBuild, targetDir, runtime;
    var cleanupCompiledHtml = true;

    var lessSourceCssTargets = {};
    var sassSourceCssTargets = {};


    function isFilePath(path) {
        return runtime.isExistingFilePath(path);
    }

    function copyDep(source, target) {
        if (source === runtime.constructProjectPath("")) {
            throw new Error("Trying to copy project dir to " + target);
        }

        if(source.indexOf(targetDir) === 0){
            throw new Error("Trying to copy from targetDir !" + source);
        }
        logger.debug("Copy " + source + " => " + target);
        if (!runtime.isExistingPath(source)) {

            var lessPath = source.substring(0, source.lastIndexOf('.')) + '.less';
            var sassPath = source.substring(0, source.lastIndexOf('.')) + '.scss';

            if(path.extname(source) === '.css' && runtime.isExistingPath(lessPath)){

                lessSourceCssTargets[lessPath] = target;
                logger.info("Queued less compilation: ", lessSourceCssTargets);

                return;
            }else if(path.extname(source) === '.css' && runtime.isExistingPath(sassPath)){

                sassSourceCssTargets[sassPath] = target;
                logger.info("Queued sass compilation: ", sassSourceCssTargets);

                return;
            }else{
                logger.error("NON EXISTING: " + source);
                throw new Error("Non existing path! " + source);
            }
        }
        copier.ensureParentDirExists(target);
        if (isFilePath(source)) {
            logger.debug("Copying FILE " + source + " => " + target);
            runtime.writeFile(target, runtime.readFile(source) + "")
        } else {
            logger.debug("Copying DIR " + source + " => " + target);
            copier.copy(source, target);
        }
    }

    this.createZipBuild = function(callback){
        var dirName = path.basename(targetDir);
        this.buildPrototype().done(function(){
            var zip = new AdmZip();
            if(!targetDir) throw new Error("Illegal target dir");
            zip.addLocalFolder(targetDir, dirName);
            callback(zip, targetDir, dirName);
        }, function(errors){
            logger.error("create zip build errors", errors.stack);
            callback();
            throw new Error("Callback errors!");
        });
        //this.buildPrototype(function(){
        //
        //});
    };

    function createCopySourceFromTargetPath(absoluteTargetDepUrl){
        var copySource;
        var atdu = absoluteTargetDepUrl;
        var td = targetDir;
        var withoutTargetDir = atdu.substring(td.length);
        var bowerTargetPrefix = (td + "/ps/ext/");
        var nodeTargetPrefix = (td + "/ps/nm/");
        var internalDepTargetPrefix = td + "/ps/";
        if(atdu.indexOf(bowerTargetPrefix) === 0){
            var bowerDepName = atdu.substring(bowerTargetPrefix.length, atdu.indexOf('/', bowerTargetPrefix.length));
            copySource = runtime.constructAppPath(['bower_components', bowerDepName]);
        }else if(atdu.indexOf(nodeTargetPrefix) === 0){
            var nodeDepName = atdu.substring(nodeTargetPrefix.length, atdu.indexOf('/', nodeTargetPrefix.length));
            copySource = runtime.constructAppPath(['node_modules', nodeDepName]);
        }else if(atdu.indexOf(internalDepTargetPrefix) === 0){
            var internalDepDirname = atdu.substring(internalDepTargetPrefix.length, atdu.indexOf('/', internalDepTargetPrefix.length));
            copySource = runtime.constructAppPath(['core', internalDepDirname]);

        }else if(atdu.indexOf(td + "/ps/dynamic/") === 0){
            throw new Error("todo: build dynamic resources: " + atdu);
        }else if(runtime.isNamedPathUrlPathname(withoutTargetDir)){
            var npName = runtime.resolveUrlPathnameToNamedPathName(withoutTargetDir);
            var np = runtime.getNamedPath(npName);
            copySource = np.path;
        }else if(runtime.isProjectFileUrlPathname(withoutTargetDir)){
            var projectSource;
            var secondSlash  = withoutTargetDir.indexOf('/', 1);
            var projectChild;
            if(secondSlash > 0){
                projectChild = path.dirname(withoutTargetDir).substring(1);//withoutTargetDir.substring(1, secondSlash);
            }else{
                projectChild = withoutTargetDir.substring(1);
            }
            projectSource = runtime.constructProjectPath(projectChild);
            copySource = projectSource;
        }else{
            throw new Error("Uncategorized source file target url path : " + atdu);
        }
        return copySource;
    }

    function createCopyTargetFromTargetPath(absoluteTargetDepUrl){
        var copyTarget;
        var atdu = absoluteTargetDepUrl;
        var td = targetDir;
        var withoutTargetDir = atdu.substring(td.length);
        var bowerTargetPrefix = (td + "/ps/ext/");
        var nodeTargetPrefix = (td + "/ps/nm/");
        var internalDepTargetPrefix = td + "/ps/";
        if(atdu.indexOf(bowerTargetPrefix) === 0){
            var bowerDepName = atdu.substring(bowerTargetPrefix.length, atdu.indexOf('/', bowerTargetPrefix.length));
            copyTarget = bowerTargetPrefix + bowerDepName;
        }else if(atdu.indexOf(nodeTargetPrefix) === 0){
            var nodeDepName = atdu.substring(nodeTargetPrefix.length, atdu.indexOf('/', nodeTargetPrefix.length));
            copyTarget = nodeTargetPrefix + nodeDepName;
        }else if(atdu.indexOf(internalDepTargetPrefix) === 0){
            var internalDepDirname = atdu.substring(internalDepTargetPrefix.length, atdu.indexOf('/', internalDepTargetPrefix.length));
            copyTarget = internalDepTargetPrefix + internalDepDirname;
        }else if(atdu.indexOf(td + "/ps/dynamic/") === 0){
            throw new Error("todo: build dynamic resources: " + atdu);
        }else if(runtime.isNamedPathUrlPathname(withoutTargetDir)){
            var npName = runtime.resolveUrlPathnameToNamedPathName(withoutTargetDir);
            var np = runtime.getNamedPath(npName);
            copyTarget = td + np.url
        }else if(runtime.isProjectFileUrlPathname(withoutTargetDir)){
            var secondSlash  = withoutTargetDir.indexOf('/', 1);

            var projectChild;
            if(secondSlash > 0){
                projectChild = path.dirname(withoutTargetDir);
            }else{
                projectChild = withoutTargetDir;
            }
            copyTarget = td + projectChild;
        }else{
            throw new Error("Uncategorized source file target url path : " + atdu);
        }
        return copyTarget;
    }

    // for each dependency (file necessary for properly viewing built project)
    // sourceFile, targetFile, projectPath, targetDir, type (namedpath, project, appfile, ..)



    function copyDependencyDirs(absoluteTargetDepUrl, copiedDirPathsMap){
        var def = deferred();
        var namedPathUrlPathname = runtime.isNamedPathUrlPathname('/' + absoluteTargetDepUrl);
        logger.debug("COPY DEP DIR " + absoluteTargetDepUrl + ", isnamed url pathname? " + namedPathUrlPathname);
        if(!namedPathUrlPathname){
            var projEquivPath = runtime.constructProjectPath(absoluteTargetDepUrl.substring(targetDir.length+1));
            var lessEquiv = projEquivPath.substring(0, projEquivPath.lastIndexOf('.')) + ".less";
            var sassEquiv = projEquivPath.substring(0, projEquivPath.lastIndexOf('.')) + ".sass";
            logger.debug("proj equiv = " + projEquivPath);
            logger.debug("less equiv = " + lessEquiv);
            logger.debug("sass equiv = " + sassEquiv);
            var shouldCompileLess = projEquivPath.indexOf('.css') === (projEquivPath.length - 4) && !runtime.isExistingFilePath(projEquivPath) && runtime.isExistingFilePath(lessEquiv);
            var shouldCompileSass = projEquivPath.indexOf('.css') === (projEquivPath.length - 4) && !runtime.isExistingFilePath(projEquivPath) && runtime.isExistingFilePath(sassEquiv);
            if(path.extname(projEquivPath) === '.css'){
                logger.debug("Should compile " + projEquivPath + " (" + absoluteTargetDepUrl + ")? " + shouldCompileLess);
            }
            if(shouldCompileLess){
                logger.debug("Compiling lesscss " + lessEquiv + "...");
                lessCompiler.compilePromise(lessEquiv, [path.dirname(lessEquiv) + ""], "" + runtime.readFile(lessEquiv), runtime.constructProjectPath(""))
                    .done(function (css, sourceMap, depPaths) {
                        logger.info("Compiled lesscss" + lessEquiv);
                        ensureWriteCss(absoluteTargetDepUrl, css, sourceMap, depPaths);
                        def.resolve();
                    }, function(error){
                        logger.error("Error while compiling lesscss " + lessEquiv, error.stack);
                        def.reject(error);
                    });
                return def.promise;
            }else if(shouldCompileSass){
                logger.debug("Compiling sass " + sassEquiv + "...");
                sassCompiler.renderSass(runtime.readFile(sassEquiv)+"", [path.dirname(sassEquiv) + ""], path.basename(projEquivPath), function(css, cssmap, stats){
                    logger.info("Compiled sess " + sassEquiv, stats);
                    ensureWriteCss(absoluteTargetDepUrl, css, cssmap, stats);
                    def.resolve();
                });
                return def.promise;
            }
        }

        logger.debug("initiate copy dep for target path " + absoluteTargetDepUrl);
        var atdu = absoluteTargetDepUrl;

        if(absoluteTargetDepUrl.indexOf("://") > 0 || absoluteTargetDepUrl.indexOf("//") === 0){
            logger.info("Not copying external url : " + absoluteTargetDepUrl);
            def.resolve();
            return def.promise;
        }
        if(atdu.indexOf("ps:/") === 0){
            atdu = targetDir + atdu.substring(3);
            logger.info("Corrected ps:attr absolute path " + absoluteTargetDepUrl + " -> " + atdu);
        }else if(absoluteTargetDepUrl.indexOf("ps:") === 0){
            var npNameEndSlash = absoluteTargetDepUrl.indexOf('/', 4);
            var npNamePotential = absoluteTargetDepUrl.substring(3, npNameEndSlash);
            logger.debug("NAMED PATH POTENTIAL : " + npNamePotential);
            if(runtime.isNamedPathName(npNamePotential)){
                atdu = targetDir + runtime.getNamedPath(npNamePotential).url + absoluteTargetDepUrl.substring(npNameEndSlash);
                logger.info("Corrected named path in ps:attr from " + absoluteTargetDepUrl + " -> " + atdu);
            }else{
                throw new Error("Add handling for non-named-link non root ps: link attrs! " + absoluteTargetDepUrl);
            }

        }else  if(atdu.indexOf('./') === 0 || atdu.indexOf('../') === 0){
            throw new Error("TODO relative support : " + atdu);
        } else if(atdu.indexOf('/') !== 0){
            if(runtime.isNamedPathName(atdu.substring(0, atdu.indexOf('/')))){
                atdu = targetDir + '/' + atdu;//.substring(atdu.indexOf('/')+1);
            }else{
                logger.warn("not handling RELATIVE URL : " + atdu);
                def.resolve();
                return def.promise;
            }
        }else if(absoluteTargetDepUrl.indexOf(targetDir) !== 0){
            atdu = targetDir + absoluteTargetDepUrl;
        }

        if (atdu.indexOf(".less?compile") > 0) {
            var urlPathname = atdu.substring(targetDir.length, atdu.length-8);
            var targetPath = atdu.substring(0, atdu.length-8);
            var sourceFilePath = runtime.findFileForUrlPathname(urlPathname);
            if(!copiedDirPathsMap.hasOwnProperty(sourceFilePath)){
                copiedDirPathsMap[sourceFilePath] = targetPath;

                lessCompiler.compilePromise(sourceFilePath, [path.dirname(sourceFilePath) + ""], "" + runtime.readFile(sourceFilePath), runtime.constructProjectPath("")).done(function (css, sourceMap, depPaths) {
                    var cssTargetPath = targetPath; //targetDir + "/ps/nm/" + u;
                    ensureWriteCss(cssTargetPath, css, sourceMap, depPaths);
                    def.resolve();
                }, function(errors){
                    logger.error("LESS ERROR", errors.stack);
                    def.reject(errors);
                });
                return def.promise;
            }else{
                logger.info("Already compiled less " + sourceFilePath + " -> " + targetPath);
                def.resolve();
                return def.promise;
            }
        }else{
            var copySource = createCopySourceFromTargetPath(atdu);
            var copyTarget = createCopyTargetFromTargetPath(atdu);

            if(!copiedDirPathsMap.hasOwnProperty(copySource) && copySource !== runtime.constructProjectPath(".")){
                copiedDirPathsMap[copySource] = copyTarget;
                copyDep(copySource, copyTarget)
            }else{
                logger.debug("Already copied " + copySource + " -> " + copyTarget);
            }
        }
        def.resolve();
        return def.promise;
    }

    var modifyBuiltMarkupWithJQuery = function ($) {
        jqueryRunner.assignUniqueIdsToEditables($);
        if (!ignoreExcludeFromBuild) {
            jqueryRunner.removeMarkupIgnoredForBuild($);
        }
        jqueryRunner.processProtostarAttributes($, function(attrName, attrVal){
            return runtime.determineProtostarAttributeValue(attrName, attrVal, targetDir);
        });
        $("*[data-editable]").attr("contenteditable", "false");
        jqueryRunner.convertAbsoluteToTargetReferences($, targetDir);
        /*metadata.templateTargetPath = createTargetPathForTemplate(metadata.templatePath)
        metadata.targetDir = targetDir;
        jqueryRunner.createPageRelativeReferences($, targetDir, metadata);*/
//        return '<!doctype html>\n' + $("html")[0].outerHTML;
        var doctype = '<!doctype html>';
        return /*doctype + '\n' +*/ $.html();
        //return doctype + '\n' + window.document.documentElement.outerHTML; //$("html")[0].outerHTML;
    };

    var modifyBuiltMarkupToRelativeWithJQuery = function ($, window, metadata) {
        try{
            jqueryRunner.assignUniqueIdsToEditables($);
            if (!ignoreExcludeFromBuild) {
                jqueryRunner.removeMarkupIgnoredForBuild($);
            }
            jqueryRunner.processProtostarAttributes($, function(attrName, attrVal){
                return runtime.determineProtostarAttributeValue(attrName, attrVal, targetDir);
            });
            $("*[data-editable]").attr("contenteditable", "false");
            jqueryRunner.convertAbsoluteToTargetReferences($, targetDir);
            metadata.templateTargetPath = createTargetPathForTemplate(metadata.templatePath);
            metadata.targetDir = targetDir;
            jqueryRunner.createPageRelativeReferences($, targetDir, metadata);
            var doctype = '<!doctype html>';
            return /*doctype + '\n' +*/ $.html();
        }catch(jqfe){
            logger.error("Error while running modifyBuiltMarkupToRelativeWithJQuery", jqfe.stack);
            throw jqfe;
        }
    };

    var postProcessComposed = function (markup) {
        return (function(){
            var def = deferred();
            if(markup.content.trim().length > 1){
                jqueryRunner.runJQuery(markup.content, modifyBuiltMarkupWithJQuery, function (result, errors) {
                    //var args = {};
                    if(errors){
                        def.reject(errors);
                    }else{
                        def.resolve(result);
                    }
                    //done(result, errors, args);
                }, markup.metadata);
            }else{
                //done(markup.content, null, undefined);
                def.resolve(markup.content);
            }
            return def.promise;
        })(markup);
    };

    var postProcessComposedForRelative = function (markup) {
        return (function(){
            var def = deferred();
            if(markup.content.trim().length > 1){
                jqueryRunner.runJQuery(markup.content, modifyBuiltMarkupToRelativeWithJQuery, function (result, errors) {
                    if(errors){
                        def.reject(errors);
                    }else{
                        def.resolve(result);
                    }
                }, markup.metadata);
            }else{
                def.resolve(markup.content);
            }
            return def.promise;
        })(markup);

    };

    var targetDirExists = function(){
        var exists = false;
        if (runtime.isExistingPath(targetDir)) {
            if(runtime.isExistingDirPath(targetDir)){
                exists = true;
            }else{
                throw new Error("Build targetDir path exists but it's no directory: " + targetDir);
            }
        }
        return exists;
    };

    var emptyTargetDir = function(){
        var files = runtime.listDir(targetDir);
        files.forEach(function (f) {
            var fp = targetDir + "/" + f;
            if (runtime.isExistingDirPath(fp)) {
                copier.deleteRecursively(fp);
            } else {
                runtime.deleteFile(fp);
            }
        });
        logger.info("Emptied " + targetDir);
    };

    function ensureWriteCss(targetPath, css, sourceMap, deps) {
        if(targetPath.indexOf("/tmp/dsv//tmp")=== 0) throw new Error();
        copier.ensureParentDirExists(targetPath);
        logger.info("Writing css to " + targetPath);
        logger.debug("DEPS = ",deps);
        runtime.writeFile(targetPath, "" + css);
        if(targetPath.indexOf('.less') === (targetPath.length-5)){
            var dir = path.dirname(targetPath);
            var baseFileName = path.basename(targetPath);
            baseFileName= baseFileName.substring(0, baseFileName.lastIndexOf('.'));
            var basePath = dir + '/' + baseFileName;
            var cssPath = basePath +  ".css";
            runtime.writeFile(cssPath, "" + css);
            var sourceMapPath = basePath +  ".css.map";
            runtime.writeFile(sourceMapPath, "" + sourceMap);
            if(deps){
                runtime.writeFile(basePath + ".deps.json", JSON.stringify(deps));
            }
        }else if(targetPath.indexOf('.css') === (targetPath.length - 4)){
            var cssPath = targetPath;
            runtime.writeFile(cssPath, "" + css);
            var sourceMapPath = targetPath + ".map";
            runtime.writeFile(sourceMapPath, "" + sourceMap);
            if(deps){
                runtime.writeFile(targetPath + ".deps.json", JSON.stringify(deps));
            }
        }

    }

    var createConcatHtmlDocument = function(htmlDocumentMarkups){
        var concat = "";
        htmlDocumentMarkups.forEach(function (doc) {
            concat += doc;
        });
        concat = concat.replace(new RegExp('\\<!doctype[^>]*\\>', 'g'), '');
        concat = concat.replace(new RegExp('\\<!DOCTYPE[^>]*\\>', 'g'), '');
        concat = concat.replace(new RegExp('\\<html[^>]*\\>', 'g'), '');
        concat = concat.replace(new RegExp('\\</html\\>', 'g'), '');
        concat = concat.replace(new RegExp('\\<head[^>]*\\>', 'g'), '');
        concat = concat.replace(new RegExp('\\</head\\>', 'g'), '');
        concat = concat.replace(new RegExp('\\<body[^>]*\\>', 'g'), '');
        concat = concat.replace(new RegExp('\\</body\\>', 'g'), '');
        return concat;
    };

    var createTargetPathForTemplate = function(templatePath){
        return targetDir + runtime.createUrlPathForFile(templatePath);
    };

    var copyProjectDependencies = function(){
        var projectConfig = runtime.readProjectConfig();
        if(utils.nestedPathExists(projectConfig, "build", "resourceDirs", "project") && utils.getObjectType(projectConfig.build.resourceDirs.project) === 'Array'){
            projectConfig.build.resourceDirs.project.forEach(function(projPath){
                copyDep(runtime.constructProjectPath(projPath), targetDir + "/" + projPath);
            });
        }else{
            logger.warn("No resourceDirs defined in prototype.json at build.resourceDirs");
        }
    };

    var finalRun = function(compiledTemplates, callBack){
        var outFiles = [];
        var written = 0;
        for (var tp in compiledTemplates) {
            var ct = compiledTemplates[tp];
            outFiles.push(ct);
            var targetFilePath = createTargetPathForTemplate(ct.path);//"/" + ct.name;
            runtime.mkdirs(path.dirname(targetFilePath));
            logger.debug("Writing file to " + targetFilePath);
            if (cleanupCompiledHtml) {
                logger.debug("Removing comments from " + path.basename(targetFilePath));
                var removedComments = utils.removeAllHtmlComments(ct.compiled);
                logger.debug("Beautifying " + path.basename(targetFilePath));
                var beautified = utils.beautifyHtml(removedComments).replace(/^\s*[\r\n]/gm, "");
                runtime.writeFile(targetFilePath, beautified);
            } else {
                runtime.writeFile(targetFilePath, ct.compiled);
            }
            logger.debug("Wrote built file " + targetFilePath);
            written++;
            if(written%10 === 0){
                logger.info("Wrote " + written + "/" + compiledTemplates.length + " pages");
            }
        }
        logger.info("Finished compiling " + compiledTemplates.length + " templates");
        logger.debug("CALLBACK ==== " + callBack.toString());
        callBack(outFiles);
    };


    var afterPostProcessing = function(compiledTemplates, callBack){
        var outFiles = [];
        for (var tp in compiledTemplates) {
            var ct = compiledTemplates[tp];
            outFiles.push(ct);
            var targetFilePath = createTargetPathForTemplate(ct.path);//"/" + ct.name;
            runtime.mkdirs(path.dirname(targetFilePath));
        }
        var markups = [];
        outFiles.forEach(function (of) {
            markups.push(of.compiled);
        });
        var concat = createConcatHtmlDocument(markups);
        jqueryRunner.runJQuery(concat, function ($) {
            var config = {
                script:"src",
                link:"href",
                img:"src"
            };
            return jqueryRunner.collectReferenceAttributeValues($, config);
        }, function (result) {
            logger.info("Found unique dependency links in pages : ", result);
            var out = result;
            if(!fs.existsSync(targetDir + "/ps"))
            runtime.mkdir(targetDir + "/ps");
            if(!fs.existsSync(targetDir + "/ps/ext"))
            runtime.mkdir(targetDir + "/ps/ext");
            if(!fs.existsSync(targetDir + "/ps/assets"))
            runtime.mkdir(targetDir + "/ps/assets");
            if(!fs.existsSync(targetDir + "/ps/nm"))
            runtime.mkdir(targetDir + "/ps/nm");
            copyProjectDependencies();
            var copiedMap = {};
            var promises = [];
            for (var scriptDepUrl in out.script) {
                promises.push(copyDependencyDirs(scriptDepUrl, copiedMap));
            }
            //var cssPromises = [];
            for (var linkDepUrl in out.link) {
                promises.push(copyDependencyDirs(linkDepUrl, copiedMap));

            }
            for (var imgDepUrl in out.img) {
                promises.push(copyDependencyDirs(imgDepUrl, copiedMap));
            }

            for (var queuedLess in lessSourceCssTargets){
                promises.push(compileLess(queuedLess, lessSourceCssTargets[queuedLess]));
            }
            for (var queuedSass in sassSourceCssTargets){
                promises.push(compileSass(queuedSass, sassSourceCssTargets[queuedSass]));
            }
            deferred.apply(this, promises)(function(){
                logger.info("All copies are done !");
                makeBuildRelative(compiledTemplates, function(){
                    compileThemes(callBack);
                });
            });
        });
    };

    var compileLess = function(sourcePath, targetPath){
        var def = deferred();
        lessCompiler.compilePromise(sourcePath, [path.dirname(sourcePath) + ""], "" + runtime.readFile(sourcePath), runtime.constructProjectPath(""))
            .done(function (css, sourceMap, depPaths) {
                logger.info("Compiled " + sourcePath);
                ensureWriteCss(targetPath, css, sourceMap, depPaths);
                def.resolve();
            }, function(error){
                logger.error("Error while compiling " + sourcePath, error.stack);
                def.reject(error);
            });
        return def.promise;
    };
    var compileSass = function(sourcePath, targetPath){
        var def = deferred();
        sassCompiler.renderSass(runtime.readFile(sourcePath)+"", [path.dirname(sourcePath) + ""], path.basename(sourcePath), function(css, cssmap, stats){
            logger.info("Compiled " + sourcePath, stats);
            ensureWriteCss(targetPath, css, cssmap, stats);
            def.resolve();
        });
        return def.promise;
    };

    var compileThemes = function(callBack){
        var projectConfig = runtime.readProjectConfig();
        if(utils.nestedPathExists(projectConfig, "theming", "enabled") && typeof projectConfig.theming.enabled === 'boolean' && projectConfig.theming.enabled){
            var entryPoint = project.resolveProjectFile(projectConfig.theming.entryPoint);
            var themeNames = projectConfig.theming.themeNames;
            var defaultThemeName = projectConfig.theming.defaultThemeName;
            var themeNameVar = projectConfig.theming.themeNameVar;
            var compileThemes = projectConfig.theming.compileThemes;
            var compileDefaultThemeOnly = projectConfig.theming.compileDefaultThemeOnly;
            logger.info("DEFAULT THEME NAME = " + defaultThemeName);
            logger.info("ENTRY POINT = " + entryPoint);
            var done = 0;
            function compileTheme(themeName){
                return (function(themeName){
                    var def = deferred();
                    logger.info("THEME NAME = " + themeName);
                    lessCompiler.compilePromise(entryPoint, [path.dirname(entryPoint) + ""], "" + runtime.readFile(entryPoint), runtime.constructProjectPath(""),  {
                        globalVars: {themeName:themeName},
                        modifyVars: {themeName:themeName}
                    }).done(function (css, sourceMap, depPaths) {
                            done++;
                            logger.info("Finished compiling THEME "+done+"/"+themeNames.length+" = " + themeName);
                            var cssTargetPath = targetDir + "/" + projectConfig.theming.entryPoint; //targetDir + "/ps/nm/" + u;
                            ensureWriteCss(cssTargetPath + "-" + themeName + ".css", css, sourceMap, depPaths);
                            def.resolve();
                        }, function(error){
                            logger.error("LESS compilation error", error.stack);
                            def.reject(error);
                    });
                    return def.promise;
                })(themeName);
            }

            deferred.map(themeNames, function(themeName){
                return compileTheme(themeName);
            })(function(){
                logger.info("AFinished compiling THEME = ");
                callBack();
            });
        }else{
            logger.info("Theming not enabled for project");
            callBack();
        }
    };

    var prepareTargetDirectory = function(){
        if(typeof targetDir !== 'string'){
            throw new Error("Illegal targetDir: " + targetDir);
        }
        if (targetDirExists()) {
            if(!runtime.isExistingFilePath(path.join(targetDir, ".protostar-project-built"))){
                throw new Error("targetDir probably wasnt created by protostar (doesnt contain file .protostar-project-built) so refusing to delete/overwrite! " + targetDir);
            }
            emptyTargetDir();
            runtime.writeFile(path.join(targetDir, ".protostar-project-built"), "This directory is created by building a Protostar prototype so can be overwritten by protostar.");
        } else {
            logger.info("Created build target directory: " + targetDir);
            runtime.mkdirs(targetDir);
            runtime.writeFile(path.join(targetDir, ".protostar-project-built"), "This directory is created by building a Protostar prototype so can be overwritten by protostar.");
        }
    };

    var shouldIncludeNamedPathsInCompilation = function(projectConfig){
        var includeNamedPathsInCompilation = false;
        if(utils.nestedPathExists(projectConfig, "build", "includeNamedPaths") && utils.hasPropertyOfType(projectConfig.build, "includeNamedPaths", "Boolean")){

            includeNamedPathsInCompilation = projectConfig.build.includeNamedPaths;
            logger.info("Include named paths in compilation? " + includeNamedPathsInCompilation);
        }
        return includeNamedPathsInCompilation;
    };

    var determineExcludedPaths = function(projectConfig){
        var excludedPaths = [];
        if(utils.nestedPathExists(projectConfig, "build", "excludedPaths") && utils.hasPropertyOfType(projectConfig.build, "excludedPaths", "Array")){
            projectConfig.build.excludedPaths.forEach(function(ep){
                var excludedPath;
                if(ep.indexOf("/") === 0){
                    excludedPath = ep;
                }else{
                    excludedPath = path.normalize(runtime.constructProjectPath(ep));
                }
                logger.info("Excluding path from build: " + excludedPath);
                excludedPaths.push(excludedPath);
            });
        }
        return excludedPaths;
    };

    var buildPrototype = function () {
        return (function(){
            var def = deferred();
            project.updateDynamic();
            var jadeTemplates = project.listProjectJadeTemplatePaths();
            logger.info("Found " + jadeTemplates.length + " JADE templates. Compiling ...");
            jadeTemplates.forEach(function(jt){
                logger.debug("Compiling JADE template found: " + jt);
                var result = jadeUtils.jadeFileToHtmlFile(jt);
                logger.debug("Compiled JADE to HTML first : " + result.path);
            });
            logger.info("Compiled " + jadeTemplates.length + " JADE templates.")
            prepareTargetDirectory();
            var projectConfig = runtime.readProjectConfig();
            var includeNamedPathsInCompilation = shouldIncludeNamedPathsInCompilation(projectConfig);
            var templates = project.listAllTemplatePaths();
            var excludedPaths = determineExcludedPaths(projectConfig);
            var compiledTemplates = {};
            var count = 0;
            var relativeCount = 0;
            templates.forEach(function (pagePath) {
                var includePage = true;
                excludedPaths.forEach(function(ep){
                    if(pagePath.indexOf(ep) === 0){
                        includePage = false;
                    }
                });
                if(includePage && (includeNamedPathsInCompilation || !runtime.isNamedPathChild(pagePath))){
                    var pageContents = runtime.readFile(pagePath);
                    if(pageContents.indexOf('{%') < 0 && pageContents.indexOf('%}')){
                        var pageContentsCompiled = composer.composeTemplate(pagePath, pageContents);
                        logger.debug("Compiled for build: " + pagePath + " with metadata:", pageContentsCompiled.metadata);
                        postProcessComposed(pageContentsCompiled).done(function(pageContentsPostProcessed){
                            compiledTemplates[pagePath] = {
                                name: pagePath,
                                path: pagePath,
                                compiled: pageContentsPostProcessed,
                                pageContents: pageContents,
                                pageContentsCompiled: pageContentsCompiled,
                                pageContentsPostProcessed: pageContentsPostProcessed
                            };
                            count += 1;
                            if (count === templates.length) {
                                logger.info("DONE all " + templates.length + " templates are compiled!");

                                afterPostProcessing(compiledTemplates, function(){
                                    var jtp = project.listProjectJadeTemplatePaths();
                                    var deleted = jadeUtils.deleteCompiledFilesForTemplates(jtp);
                                    def.resolve(compiledTemplates);
                                });
                            }
                        }, function(errors){
                            logger.info("Errors :: ", errors.stack);
                            def.reject(errors);
                        });
                    }else{
                        logger.info("Not building file with jekyll directives: " + pagePath);
                        count +=1;
                        relativeCount+=1;
                        if (count === templates.length) {
                            logger.info("DONE all " + templates.length + " templates are compiled!");

                            afterPostProcessing(compiledTemplates, function(){
                                var jtp = project.listProjectJadeTemplatePaths();
                                var deleted = jadeUtils.deleteCompiledFilesForTemplates(jtp);
                                def.resolve(compiledTemplates);
                                //callBack()
                            });
                        }
                    }
                }else{
                    logger.info("Not including page template in named path: " + pagePath);
                    count +=1;
                    relativeCount+=1;
                    if (count === templates.length) {
                        logger.info("DONE all " + templates.length + " templates are compiled!");
                        afterPostProcessing(compiledTemplates, function(){
                            var jtp = project.listProjectJadeTemplatePaths();
                            var deleted = jadeUtils.deleteCompiledFilesForTemplates(jtp);
                            def.resolve(compiledTemplates);
                            //callBack()
                        });
                    }
                }
            });
            return def.promise;
        })();
    };

    var makeBuildRelative = function(compiledTemplates, callBack){
        var allTemplatePaths = Object.keys(compiledTemplates);
        logger.debug("TEMPLATE PATHS FOR RELATIVE : ", allTemplatePaths);
        var relativizeCompiledTemplate = function(templatePath){
            return function(){
                var def = deferred();
                var ct = compiledTemplates[templatePath];
                postProcessComposedForRelative(ct.pageContentsCompiled).done(function(contentsPostProcessedRelative){
                    def.resolve({
                        path : templatePath,
                        compiled : contentsPostProcessedRelative
                    })
                }, function(errors){
                    logger.error("making build relative threw errors!", errors.stack);
                    def.reject(errors);

                });
                return def.promise;
            }(templatePath);
        };
        var defAllTemplatePaths = function(){
            return function(){
                var def = deferred();
                def.resolve(allTemplatePaths);
                return def.promise;
            }();

        };
        defAllTemplatePaths().map(relativizeCompiledTemplate).done(function(data){
            logger.debug("FINISHED RELATIVEZE : ", data);
            finalRun(data, callBack);
        }, function(errors){
            logger.error("ERROR RELATIVEZE : ", errors.stack);
            callBack();
        })
    };
    this.buildPrototype = buildPrototype;
    var parseArgs = function (args) {
        runtime = args.runtime;
        project = args.project;
        composer = args.composer;
        targetDir = args.targetDir || runtime.getTargetDirPath();
        ignoreExcludeFromBuild = args.ignoreExcludeFromBuild || false;
    };
    parseArgs(args);
}

module.exports = {
    createBuilder: function (args) {
        return new Builder(args);
    }
};