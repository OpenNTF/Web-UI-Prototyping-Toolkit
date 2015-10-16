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

var utils = require("./utils");
var wcmTagParser = require("./wcmTagParser");
var htmlProducerFactory = require("./htmlProducer");
var BowerUtils = require("./bowerUtils").BowerUtils;
var fsops = require("fsops");
var logger = utils.createLogger({sourceFilePath : __filename});
var copier = require("./copier");
var maxTemplateFileDepth = 3;

var ignoredNames = [".git",
    ".idea",
    "node_modules",
    "bower_components",
    ".workspace",
    ".settings"];


function Project(args) {
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = args.runtime;
    /**
     * @type {TemplateComposer}
     */
    this.composer = args.composer;
    this.lessParserAdditionalArgs = {
        globalVars: {'themeName':'flatly'},
        modifyVars: {'themeName':'flatly'}
    };

    /**
     * @type {htmlProducer.HtmlProducer}
     */
    this.htmlProducer = htmlProducerFactory.createHtmlProducer({
        runtime: this.runtime
    });

    /**
     * @param {String} pathName
     * @return {String}
     */
    this.resolveProjectFile = function (pathName) {
        return this.runtime.constructProjectPath(pathName);
    };

    /**
     *
     * @param {String} pathName
     * @return {boolean}
     */
    this.projectPathExists = function (pathName) {
        return this.runtime.isExistingProjectPath(pathName);
    };
    /**
     *
     * @param {String} fileName
     * @param {String} content
     * @param [args]
     */
    this.writeDynamicFile = function (fileName, content, args) {
        this.runtime.writeFile(this.runtime.constructProjectPath(["_dynamic" , fileName]), content, args);
    };

    /**
     *
     * @param {String} projectPath
     * @return {String}
     */
    this.readFile = function (projectPath) {
        return this.runtime.readProjectFile(projectPath);
    };

    /**
     *
     * @param {String} projectPath
     * @param {String} content
     * @param [args]
     */
    this.writeFile = function (projectPath, content, args) {
        this.runtime.writeFileCreatingParents(projectPath, content, args);
    };

    /**
     * @param {String} fileName
     * @return {boolean}
     */
    this.isHtmlFilename = function (fileName) {
        return path.extname(fileName) === ".html";
    };


    /**
     * @return {String[]}
     */
    this.listProjectTemplatePaths = function(){
        var dirPath = this.runtime.constructProjectPath("");
        var bu = new BowerUtils(dirPath);
        var bowerDirPath = bu.getBowerDirectoryPath();
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return that.runtime.isProjectPath(filepath) && filepath.indexOf(bowerDirPath) !== 0 && !that.runtime.isNamedPathChild(filepath) && fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };

    /**
     * @return {String[]}
     */
    this.listProjectJadeTemplatePaths = function(){
        var dirPath = this.runtime.constructProjectPath("");
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return that.runtime.isProjectPath(filepath) && !that.runtime.isNamedPathChild(filepath) && fileStat.isFile() && (path.extname(filename) === '.jade');
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };

    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */
    this.listTemplatePaths = function (dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("")
        }
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };

    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */
    this.listAllTemplatePaths = function (dirPath) {
        var theProjectDir = this.runtime.constructProjectPath("");
        if (!dirPath) {
            dirPath = theProjectDir
        }
        var htmlFiles = this.listProjectTemplatePaths();
        var that = this;
        var pathsIdx = {};

        htmlFiles.forEach(function (p) {
            pathsIdx[p] = 1;
        });
        logger.info("All HTML paths: ", pathsIdx);
        htmlFiles.forEach(function (p) {
            var cc;
            if(that.runtime.cachingEnabled){
                var composeTemplateCached = that.composer.composeTemplateCached(p);
                cc = composeTemplateCached.content;
                if(cc.indexOf('<html') < 0 || cc.indexOf('</html>') < 0 || cc.indexOf('{%') >=0){
                    delete pathsIdx[p];
                }
            }else{
                if(!that.composer.composesToFullHtmlTemplate(p)){
                    delete pathsIdx[p];
                }
            }
        });
        logger.debug("All HTML paths that have <html and </html>: ", pathsIdx);
        var reffed = this.listAllReferencedPaths(dirPath);
        reffed.forEach(function (r) {
            if (pathsIdx.hasOwnProperty(r)) {
                delete pathsIdx[r];
            }
        });
        logger.debug("Only those that aren't referenced from anywhere: ", pathsIdx);
        var layouts = this.listAllLayouts(dirPath);
        layouts.forEach(function (r) {
            if (pathsIdx.hasOwnProperty(r)) {
                delete pathsIdx[r];
            }
        });
        logger.debug("Only non-layouts: ", pathsIdx);
        var templateFileNames = [];
        for (var pth in pathsIdx) {
            if (pathsIdx.hasOwnProperty(pth)) {
                templateFileNames.push(pth);
            }
        }
        templateFileNames.sort();
        logger.debug("All template paths: ", templateFileNames);
        var fil = [];
        var t = this;
        var projectPath = t.runtime.constructProjectPath("");
        templateFileNames.forEach(function(tp){
            var rp = path.relative(projectPath, tp);
            if(rp.split(path.sep).length <= maxTemplateFileDepth){
                fil.push(tp);
            }
        });
        return fil;
    };

    /**
     *
     * @param {String} fullPath
     * @return {String}
     */
    this.toRelativePath = function (fullPath) {
        return this.runtime.toRelativeProjectPath(fullPath);
    };

    /**
     *
     * @param {String} fullPath
     * @return {boolean}
     */
    this.isInSubdir = function (fullPath) {
        return this.runtime.isProjectPath(fullPath) && this.toRelativePath(fullPath).indexOf("/") > 0;
    };

    /**
     * @return {{}}
     */
    this.getUserConfig = function(){
        return this.userConfig;
    };

    /**
     * @param {String} [dirPath]
     * @param {String[]} [dropPointTypes]
     * @return {String[]}
     */

    this.listPathsWithReferences = function (dirPath, dropPointTypes) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("");
        }
        var that = this;
        var dpTypes = dropPointTypes || this.runtime.userConfig.dropPointTypes;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            },
            fileContentFilter: function (content, fileName, filepath, fileStat) {
                return that.composer.findAllDropPoints(filepath, content, dpTypes).length > 0;
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };
    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */

    this.listAllLayouts = function (dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("");
        }
        var that = this;
        var lister = utils.createRecursiveDirLister({
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            },
            fileContentFilter: function (content, fileName, filepath, fileStat) {
                return content.indexOf('<!-- content:') >= 0;
            }
        });
        var matches = lister.listRecursive(dirPath);
        this.sortPathNames(matches);
        matches.sort();
        return matches;
    };

    this.sortString = function (a, b) {
        if (a < b) {
            return -1;
        } else if (a > b) {
            return 1;
        } else {
            return 0;
        }
    };
    /**
     *
     * @param {String[]} paths
     */
    this.sortPathNames = function (paths) {
        var that = this;
        paths.sort(function (a, b) {
            var ps = that.sortString(a.path, b.path);
            if (ps === 0) {
                ps = that.sortString(a.name, b.name);
            }
            return ps;
        });
    };
    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */

    this.listAllReferencedPaths = function (dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("")
        }
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        var out = [];
        var done = {};
        matches.forEach(function (filePath) {
            var content = that.runtime.readFile(filePath);
            var dropPoints = that.composer.findAllDropPoints(filePath, content, ["layout", "file", "wrap"]);
            for (var di = 0; di < dropPoints.length; di += 1) {
                var dp = dropPoints[di];
                try{
                    var resolvedPath = that.runtime.resolveFilePathForPlaceHolder(dp);
                    if(that.runtime.isDebug()){
                        logger.info("Path " + filePath + " references " + resolvedPath);
                    }
                    if (!done.hasOwnProperty(resolvedPath)) {
                        done[resolvedPath] = 1;
                        out.push(resolvedPath);
                    }
                }catch(e){
                    logger.error("Could not process drop point " + dp.getType()+ ":" + dp.getName(), e.stack);
                    logger.error("Skipping..");
                    //logger.trace();
                }
            }
        });
        out.sort();
        return out;
    };

    /**
     *
     * @param {String} fileName
     * @return {boolean}
     */
    this.isCompiledTemplateFilename = function (fileName) {
        return fileName.indexOf('-compiled.html') > 0;
    };

    /**
     *
     * @param fullPath
     * @return {String}
     */
    this.toFileUrl = function (fullPath) {
        return this.runtime.createUrlPathForFile(fullPath);
    };

    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */
    this.listCompiledTemplatePaths = function (dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("")
        }
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isCompiledTemplateFilename(filename);
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };
    this.updateDynamic = function () {
        var dynamicDirPath = this.runtime.constructProjectPath("_dynamic");
        if(!this.runtime.isExistingDirPath(dynamicDirPath)){
            this.runtime.mkdirs(dynamicDirPath);
        }
        var st = new Date().getTime();
        var files = this.listAllTemplatePaths();//listPathsWithReferences();
        console.log("Listed all template paths in " + (new Date().getTime() - st) + "ms");
        this.runtime.writeFile(this.runtime.constructProjectPath(["_dynamic", "list-referencing-bare.html"]), this.htmlProducer.createBareListingEntriesMarkup(files, function($){
            //$("li").addClass("wpthemeNavListItem wpthemeLeft");

            //$("a").addClass("wpthemeLeft");
            //$("a").eq(0).addClass("wpthemeFirst");
        }));
        this.runtime.writeFile(this.runtime.constructProjectPath(["_dynamic", "list-compiled-bare.html"]), this.htmlProducer.createBareListingEntriesMarkup(this.listCompiledTemplatePaths()));
    };

    this.createProjectWcmMarkupInfo = function(){
        var htmlFiles = fsops.listRecursively(this.runtime.constructProjectPath('')).filter(function(p){
            return path.extname(p) === '.html';
        });
        var t = this;
        var wcmMarkupFilesInfo = {};
        htmlFiles.forEach(function (tp) {
            var link = t.runtime.createUrlPathForFile(tp);

            var htmlFile = t.runtime.readFile(tp);
            if(wcmTagParser.isWcmMarkup(htmlFile)){
                wcmMarkupFilesInfo[link] = wcmTagParser.createIbmWcmMarkupFragmentInfo(link, htmlFile);
            }
        });
        return wcmMarkupFilesInfo;
    };

    this.logWcmMarkupFilesInProjectInfo = function(){
        var wcmMarkupFilesInfo = this.createProjectWcmMarkupInfo();
        var wcmPaths = Object.keys(wcmMarkupFilesInfo).sort();
        wcmPaths.forEach(function(wp, idx){
            var pi = wcmMarkupFilesInfo[wp];
            var tlt = pi.getAllTags();
            var n = idx+1;
            console.log("" + n + ". " + wp + ": ");
            tlt.forEach(function(t){
                if(t.isNested()){
                    var ref = "  " + t.sourceStart + ":" + t.sourceEnd;
                    console.log("          - " + t.name + (!t.hasBody() ? "" : " ... [/" + t.name + "]") + ref);
                }else{
                    var ref = "  " + t.startIdx + ":" + t.endIdx;
                    console.log("  - [" + t.name + " ...]" + (!t.hasBody() ? "" : " ... [/" + t.name + "]") + ref);
                }
            });
        });
    };


    /**
     * @return {String}
     */
    this.readViewScriptsMarkup = function readViewScriptsMarkup() {
        return this.runtime.readAppFile(["core", "assets", "viewScripts.html"]);
    }
}

module.exports = {
    createProject: function (args) {
        return new Project(args);
    },
    Project:Project
};