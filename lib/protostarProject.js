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
"use strict";
const path = require("path");
const Handlebars = require("handlebars");
const utils = require("./utils");
const WcmTagParser = require("./wcmTagParser");
const HtmlProducer = require("./htmlProducer");
const BowerUtils = require("./bowerUtils");
const RecursiveDirLister = require('./RecursiveDirLister');
const fsops = require("fsops");
const logger = utils.createLogger({sourceFilePath: __filename});
const copier = require("./copier");
const maxTemplateFileDepth = 3;
const fs = require("fs");
const jadeUtils = require("./jadeUtils");
const projectCommands = require("./projectCommands");
const lessCompiler = require("./lessCompiler");
const ignoredNames = [".git",
    ".idea",
    "node_modules",
    "bower_components",
    ".workspace",
    ".settings"];

class Project {
    /**
     *
     * @param {{runtime: ProtostarRuntime, composer: TemplateComposer}}args
     * @constructor
     */
    constructor(args) {
        /**
         * @type {ProtostarRuntime}
         */
        this.runtime = args.runtime;
        /**
         * @type {TemplateComposer}
         */
        this.composer = args.composer;
        this.lessParserAdditionalArgs = {
            globalVars: {'themeName':'specify theming.defaultThemeName in prototype.json'},
            modifyVars: {'themeName':'specify theming.defaultThemeName in prototype.json'}
        };

        /**
         * @type {htmlProducer.HtmlProducer}
         */
        this.htmlProducer = new HtmlProducer({
            runtime: this.runtime
        });

        try{
            const pcfg = this.runtime.readProjectConfig();
            if(utils.hasPropertyOfType(pcfg, "theming", 'Object') && pcfg.theming.hasOwnProperty("enabled") && pcfg.theming.enabled === true){
                const varname = pcfg.theming.themeNameVar;
                const defaultTheme = pcfg.theming.defaultThemeName || pcfg.theming.themeNames[0];
                this.lessParserAdditionalArgs.globalVars[varname] = defaultTheme;
                this.lessParserAdditionalArgs.modifyVars[varname] = defaultTheme;
            }
        }catch(e){
            logger.error("Could not read default theme name var from prototype.json although theming is marked as enabled", e.stack);
        }
    }

    deleteIntermediaryFiles() {
        const jtp = this.listProjectJadeTemplatePaths();
        const deletedJadeFiles = jadeUtils.deleteCompiledFilesForTemplates(jtp);
        console.log("Deleted compiled JADE files ", deletedJadeFiles);
        const projDir = this.runtime.constructProjectPath("");
        const lessFilePaths = copier.listDirChildrenFullPathsRecursively(projDir).filter(p =>{
            const suffix = "-compiled.css";
            return p.indexOf(suffix) === (p.length - suffix.length);
        });
        const deletedCssFiles = lessCompiler.deleteAllCompiledCssFiles(lessFilePaths);
        console.log("Deleted compiled css files ", deletedCssFiles);
    }

    /**
     * @param {String} pathName
     * @return {String}
     */
    resolveProjectFile(pathName) {
        return this.runtime.constructProjectPath(pathName);
    }

    /**
     *
     * @param {String} pathName
     * @return {boolean}
     */
    projectPathExists(pathName) {
        return this.runtime.isExistingProjectPath(pathName);
    }

    /**
     *
     * @param {String} fileName
     * @param {String} content
     * @param [args]
     */
    writeDynamicFile(fileName, content, args) {
        this.runtime.writeFile(this.runtime.constructProjectPath(["_dynamic" , fileName]), content, args);
    }

    /**
     *
     * @param {String} projectPath
     * @return {String}
     */
    readFile(projectPath) {
        return this.runtime.readProjectFile(projectPath);
    }

    /**
     *
     * @param {String} projectPath
     * @param {String} content
     * @param [args]
     */
    writeFile(projectPath, content, args) {
        this.runtime.writeFileCreatingParents(projectPath, content, args);
    }

    /**
     * @param {String} fileName
     * @return {boolean}
     */
    isHtmlFilename(fileName) {
        return path.extname(fileName) === ".html";
    }

    /**
     * @return {String[]}
     */
    listProjectTemplatePaths() {
        const dirPath = this.runtime.constructProjectPath("");
        const bu = new BowerUtils(dirPath);
        const bowerDirPath = bu.getBowerDirectoryPath();
        const that = this;
        const lister = new RecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return that.runtime.isProjectPath(filepath) && filepath.indexOf(bowerDirPath) !== 0 && !that.runtime.namedPathsConfig.isNamedPathChild(filepath) && fileStat.isFile() && (that.isHtmlFilename(filename) || utils.endsWith(filename, ".jade") || utils.endsWith(filename, ".hbs")) && !that.isCompiledTemplateFilename(filename);
            }
        });
        const matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    }

    /**
     * @return {String[]}
     */
    listProjectJadeTemplatePaths() {
        const dirPath = this.runtime.constructProjectPath("");
        const that = this;
        const lister = new RecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return that.runtime.isProjectPath(filepath) && !that.runtime.namedPathsConfig.isNamedPathChild(filepath) && fileStat.isFile() && (path.extname(filename) === '.jade');
            }
        });
        const matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    }

    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */
    listTemplatePaths(dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("");
        }
        const that = this;
        const lister = new RecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            }
        });
        const matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    }

    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */
    listAllTemplatePaths(dirPath) {
        const theProjectDir = this.runtime.constructProjectPath("");
        if (!dirPath) {
            dirPath = theProjectDir;
        }

        const bowerUtils = new BowerUtils(dirPath);
        const bowerDirPath = bowerUtils.getBowerDirectoryPath();
        // var self = this;

        const namedPaths = this.runtime.namedPathsConfig.getNamedPathConfigsArray().map(function (np) {
            return np.path;
        });
        console.log("Excluding named: ", namedPaths);
        let c;
        if(fs.existsSync(bowerDirPath)){
            namedPaths.push(path.basename(bowerDirPath));
            c = copier.listDirChildrenFullPathsRecursively(dirPath, namedPaths);
        }else{
            c = copier.listDirChildrenFullPathsRecursively(dirPath,namedPaths);
        }

        const cs = utils.checksum(c.join());


        if(this.lastChecksum && this.lastChecksum === cs){
            return this.lastPaths;
        }
        const htmlFiles = this.listProjectTemplatePaths();
        this.lastChecksum = cs;
        const that = this;
        const pathsIdx = {};

        htmlFiles.forEach(function (p) {
            pathsIdx[p] = 1;
        });
        logger.debug("All HTML paths: ", pathsIdx);
        htmlFiles.forEach(function (p) {
            let cc;
            if(that.runtime.cachingEnabled){
                const composeTemplateCached = that.composer.composeTemplateCached(p);
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
        const reffed = this.listAllReferencedPaths(dirPath);
        reffed.forEach(function (r) {
            if (pathsIdx.hasOwnProperty(r)) {
                delete pathsIdx[r];
            }
        });
        logger.debug("Only those that aren't referenced from anywhere: ", pathsIdx);
        const layouts = this.listAllLayouts(dirPath);
        layouts.forEach(function (r) {
            if (pathsIdx.hasOwnProperty(r)) {
                delete pathsIdx[r];
            }
        });
        logger.debug("Only non-layouts: ", pathsIdx);
        const templateFileNames = [];
        for (let pth in pathsIdx) {
            if (pathsIdx.hasOwnProperty(pth)) {
                templateFileNames.push(pth);
            }
        }
        templateFileNames.sort();
        logger.debug("All template paths: ", templateFileNames);
        const fil = [];
        const t = this;
        const projectPath = t.runtime.constructProjectPath("");
        templateFileNames.forEach(function(tp){
            const rp = path.relative(projectPath, tp);
            if(rp.split(path.sep).length <= maxTemplateFileDepth){
                fil.push(tp);
            }
        });
        this.lastPaths = fil;
        return fil;
    }

    /**
     *
     * @param {String} fullPath
     * @return {String}
     */
    toRelativePath(fullPath) {
        return this.runtime.toRelativeProjectPath(fullPath);
    }

    /**
     *
     * @param {String} fullPath
     * @return {boolean}
     */
    isInSubdir(fullPath) {
        return this.runtime.isProjectPath(fullPath) && this.toRelativePath(fullPath).indexOf("/") > 0;
    }

    /**
     * @return {{}}
     */
    getUserConfig() {
        return this.userConfig;
    }

    /**
     * @param {String} [dirPath]
     * @param {String[]} [dropPointTypes]
     * @return {String[]}
     */
    listPathsWithReferences(dirPath, dropPointTypes) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("");
        }
        const that = this;
        const dpTypes = dropPointTypes || this.runtime.userConfig.dropPointTypes;
        const lister = new RecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            },
            fileContentFilter: function (content, fileName, filepath, fileStat) {
                return that.composer.findAllDropPoints(filepath, content, dpTypes).length > 0;
            }
        });
        const matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    }

    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */
    listAllLayouts(dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("");
        }
        const that = this;
        const lister = new RecursiveDirLister({
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            },
            fileContentFilter: function (content, fileName, filepath, fileStat) {
                return content.indexOf('<!-- content:') >= 0;
            }
        });
        const matches = lister.listRecursive(dirPath);
        this.sortPathNames(matches);
        matches.sort();
        return matches;
    }

    sortString(a, b) {
        if (a < b) {
            return -1;
        } else if (a > b) {
            return 1;
        } else {
            return 0;
        }
    }

    /**
     *
     * @param {String[]} paths
     */
    sortPathNames(paths) {
        const that = this;
        paths.sort(function (a, b) {
            let ps = that.sortString(a.path, b.path);
            if (ps === 0) {
                ps = that.sortString(a.name, b.name);
            }
            return ps;
        });
    }

    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */
    listAllReferencedPaths(dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("");
        }
        const that = this;
        const lister = new RecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            }
        });
        const matches = lister.listRecursive(dirPath);
        matches.sort();
        const out = [];
        const done = {};
        matches.forEach(function (filePath) {
            const content = that.runtime.readFile(filePath);
            const dropPoints = that.composer.findAllDropPoints(filePath, content, ["layout", "file", "wrap"]);
            for (let di = 0; di < dropPoints.length; di += 1) {
                const dp = dropPoints[di];
                try{
                    const resolvedPath = that.runtime.resolveFilePathForPlaceHolder(dp);
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
    }

    /**
     *
     * @param {String} fileName
     * @return {boolean}
     */
    isCompiledTemplateFilename(fileName) {
        return fileName.indexOf('-compiled.html') > 0;
    }

    /**
     *
     * @param fullPath
     * @return {String}
     */
    toFileUrl(fullPath) {
        return this.runtime.createUrlPathForFile(fullPath);
    }

    /**
     * @param {String} [dirPath]
     * @return {String[]}
     */
    listCompiledTemplatePaths(dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("");
        }
        const that = this;
        const lister = new RecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isCompiledTemplateFilename(filename);
            }
        });
        const matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    }

    updateDynamic() {
        const dynamicDirPath = this.runtime.constructProjectPath("_dynamic");
        if(!this.runtime.isExistingDirPath(dynamicDirPath)){
            this.runtime.mkdirs(dynamicDirPath);
        }
        const writeDynamicFiles = false;
        if(writeDynamicFiles){
            const st = new Date().getTime();
            const files = this.listAllTemplatePaths();//listPathsWithReferences();
            logger.debug("Listed all template paths in " + (new Date().getTime() - st) + "ms");
            const processLinkJQueryFn = null;
            /*
            processLinkJQueryFn = function($){
                $("li").addClass("wpthemeNavListItem wpthemeLeft");
                $("a").addClass("wpthemeLeft");
                $("a").eq(0).addClass("wpthemeFirst");
            };
            */
            this.runtime.writeFile(this.runtime.constructProjectPath(["_dynamic", "list-referencing-bare.html"]), this.htmlProducer.createBareListingEntriesMarkup(files, processLinkJQueryFn));
            this.runtime.writeFile(this.runtime.constructProjectPath(["_dynamic", "list-compiled-bare.html"]), this.htmlProducer.createBareListingEntriesMarkup(this.listCompiledTemplatePaths()));
        }
        const commandsJsonPath = path.resolve(dynamicDirPath, "projectCommands.json");
        if(!this.commandInfoWrittenOnce || !fs.existsSync(commandsJsonPath)){
            this.commandInfoWrittenOnce = true;
            fs.writeFileSync(commandsJsonPath, JSON.stringify(projectCommands.createCommandInfo()));
            const modelPath = path.resolve(dynamicDirPath, "projectCommandsModel.json");
            const cmdPresModel = projectCommands.createCommandPresentationModel();
            fs.writeFileSync(modelPath, JSON.stringify(cmdPresModel));
            const tpl = fs.readFileSync(path.resolve(this.runtime.protostarDirPath, 'core', 'assets', 'menuTemplate-hb.html'), 'utf8');
            const compiled = Handlebars.compile(tpl);
            const markup = compiled(cmdPresModel);
            const commandsMenuMarkupPath = path.resolve(dynamicDirPath, "commandsMenu.html");
            fs.writeFileSync(commandsMenuMarkupPath, markup);
        }
    }

    isLibraryDirPresent() {
        const brcp = this.runtime.constructProjectPath('.bowerrc');
        if(fs.existsSync(brcp)){
            const brc = JSON.parse(this.runtime.readFile(brcp));
            if(brc.hasOwnProperty("directory")){
                const configuredLibDir = this.runtime.constructProjectPath(brc.directory);
                const exists = fs.existsSync(configuredLibDir);
                console.log("Does libdir " + configuredLibDir + " exist ? " + exists);
                return exists;
            }
        }
        return !!fs.existsSync(this.runtime.constructProjectPath('bower_components'));

    }

    getLibraryDirPath() {
        const brcp = this.runtime.constructProjectPath('.bowerrc');
        if(fs.existsSync(brcp)){
            const brc = JSON.parse(this.runtime.readFile(brcp));
            if(brc.hasOwnProperty("directory")){
                const configuredLibDir = this.runtime.constructProjectPath(brc.directory);
                const exists = fs.existsSync(configuredLibDir);
                console.log("Does libdir " + configuredLibDir + " exist ? " + exists);
                if(exists){
                    return brc.directory;
                }
            }
        }
        if(fs.existsSync(this.runtime.constructProjectPath('bower_components'))){
            return 'bower_components';
        }
        throw new Error("There is no library dir, check with isLibraryDirPresent first");
    }

    /**
     *
     * @return {IbmWcmMarkupFragmentInfo}
     */
    createProjectWcmMarkupInfo() {
        let htmlFilePaths = fsops.listRecursively(this.runtime.constructProjectPath('')).filter(function (p) {
            return path.extname(p) === '.html';
        });
        if(fs.existsSync(this.runtime.constructProjectPath('.bowerrc'))){
            const bowerRcData = JSON.parse(this.runtime.readFile(this.runtime.constructProjectPath('.bowerrc')));
            if(bowerRcData.hasOwnProperty("directory")){
                const depsDir = this.runtime.constructProjectPath(bowerRcData.directory);
                htmlFilePaths = htmlFilePaths.filter(function(f){
                    return f.indexOf(depsDir) !== 0;
                });
            }
        }
        const t = this;
        const wcmMarkupFilesInfo = {};
        const wcmTagParser = new WcmTagParser();

        htmlFilePaths.forEach(function (tp) {
            const link = t.runtime.createUrlPathForFile(tp);

            const htmlFile = t.runtime.readFile(tp);
            if(wcmTagParser.isWcmMarkup(htmlFile)){
                wcmMarkupFilesInfo[link] = wcmTagParser.createIbmWcmMarkupFragmentInfo(link, htmlFile);
            }
        });
        return wcmMarkupFilesInfo;
    }

    logWcmMarkupFilesInProjectInfo() {
        const wcmMarkupFilesInfo = this.createProjectWcmMarkupInfo();
        const wcmPaths = Object.keys(wcmMarkupFilesInfo).sort();
        wcmPaths.forEach(function(wp, idx){
            const pi = wcmMarkupFilesInfo[wp];
            const tlt = pi.getAllTags();
            const n = idx + 1;
            console.log("" + n + ". " + wp + ": ");
            tlt.forEach(function(t){
                let ref;
                if(t.isNested()){
                    ref = "  " + t.sourceStart + ":" + t.sourceEnd;
                    console.log("          - " + t.name + (!t.hasBody() ? "" : " ... [/" + t.name + "]") + ref);
                }else{
                    ref = "  " + t.startIdx + ":" + t.endIdx;
                    console.log("  - [" + t.name + " ...]" + (!t.hasBody() ? "" : " ... [/" + t.name + "]") + ref);
                }
            });
        });
    }

    /**
     * @return {String}
     */
    readViewScriptsMarkup() {
        return this.runtime.readAppFile(["core", "assets", "viewScripts.html"]);
    }
}


// module.exports = {
//     Project:Project
// };
module.exports = Project;