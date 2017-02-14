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
'use strict';
const utils = require("./utils");
const logger = utils.createLogger({sourceFilePath : __filename});
const path = require("path");
const fs = require("./filesystem");
const copier = require("./copier");
const CachedTextFile = require('./CachedTextFile');
const NamedPathsConfig = require('./NamedPathsConfig');
const ItemCache = require('./ItemCache');
class ProtostarRuntime {
    constructor(args) {

        /**
         * @type {boolean}
         */
        this.lenient = args.lenient || true;

        /**
         * @type {boolean}
         */
        this.cachingEnabled = args.cachingEnabled || false;

        if(typeof args.protostarDirPath !== 'string')
            throw new Error("missing protostarDirPath");

        /**
         * @type {String}
         */
        this.protostarDirPath  = args.protostarDirPath;

        /**
         * @type {String}
         */
        this.defaultConfigPath = path.join(this.protostarDirPath, "core", "config", "defaults.json");

        /**
         * @type {String}
         */
        this.configPath = path.join(this.protostarDirPath, "core", "config", "config.json");

        /**
         * @type {Number}
         */
        this.port = (process.env["VCAP_APP_PORT"] || args.port || 8888);

        /**
         * @type {String}
         */
        this.projectConfigFilename = args.projectConfig || 'prototype.json';

        /**
         * @type {String}
         */
        this.mode = args.mode;

        /**
         * @type {String}
         */
        this.projectDirPath = args.projectDirPath;

        /**
         * @type {String}
         */
        this.targetDirPath = args.targetDirPath;

        /**
         * @type {String}
         */
        this.themeDirPath = args.themeDirPath;



        /**
         * @type {String}
         */
        this.projectConfigPath = path.resolve(this.projectDirPath, this.projectConfigFilename);

        this.projectConfigReader = new CachedTextFile(this.projectConfigPath);

        this.namedPathsConfig = new NamedPathsConfig(this.projectConfigReader);

        /**
         * @type {Object}
         */
        this.userConfig = {};

        /**
         * @type {Object}
         */
        this.projectConfig = {};

        this.launchTime = args.launchTime || new Date().getTime();

        /**
         *
         * @type {ItemCache}
         */
        this.imageCache = new ItemCache(function(image){
            let keyPart;
            try {
                keyPart = image.link.substring(image.link.lastIndexOf('/photos/') + 8);
                image.id = keyPart;
                if(image.media.hasOwnProperty("m") && !image.media.hasOwnProperty("b") && image.media.m.indexOf("_m.jpg")>0){
                    image.media.b = image.media.m.replace("_m.jpg", "_b.jpg");
                }
            } catch (e) {
                console.error(e.stack);
                throw new Error("could not extract key from " + image.link + ": " + e.message);
            }
            return keyPart;
        });
    }

    /**
     * @return {String}
     */
    getNodeCommandPath() {
        return this.nodeCommandPath;
    }

    /**
     * @return {Number}
     */
    getPort() {
        return this.port;
    }

    /**
     *
     * @param {String} fullPath
     * @return {boolean}
     */
    isExistingPath(fullPath) {
        return fs.existsSync(fullPath);
    }

    /**
     *
     * @param {String} fullFilePath
     * @return {boolean}
     */
    isExistingFilePath(fullFilePath) {
        return this.isExistingPath(fullFilePath) && fs.statSync(fullFilePath).isFile();
    }

    /**
     *
     * @param {String} fullDirPath
     * @return {boolean}
     */
    isExistingDirPath(fullDirPath) {
        return this.isExistingPath(fullDirPath) && fs.statSync(fullDirPath).isDirectory();
    }

    /**
     * @param {String[]|String} partsArray
     * @return {boolean}
     */
    isExistingProjectFilePath(partsArray) {
        const pf = this.constructProjectPath(partsArray);
        return this.isExistingPath(pf) && fs.statSync(pf).isFile();
    }

    /**
     * @param {String} fullPath
     * @return {boolean}
     */
    isAppPath(fullPath) {
        return fullPath.indexOf(this.protostarDirPath) === 0;
    }

    /**
     * @param {String} fullPath
     * @return {boolean}
     */
    isProjectPath(fullPath) {
        return fullPath.indexOf(this.projectDirPath) === 0;
    }

    /**
     * @param {String} urlPathName
     * @return {boolean}
     */
    isProjectFileUrlPathname(urlPathName) {
        return this.isProjectPath(this.projectDirPath + urlPathName);
    }

    /**
     *
     * @param {String} fullProjectPath
     * @return {String}
     */
    createTemplateReferenceFromFullPath(fullProjectPath) {
        if (this.isAppPath(fullProjectPath)) {
            return this.toRelativeAppPath(fullProjectPath).substring(1);
        } else if (this.isProjectPath(fullProjectPath)) {
            return this.toRelativeProjectPath(fullProjectPath);//.substring(1);
        } else {
            throw new Error("Unmapped path type for toRelative: " + fullProjectPath);
        }
    }

    /**
     * @param {String} fullPath
     * @return {string}
     */
    createHtmlFileDisplayName(fullPath) {
        const fileUrl = this.createUrlPathForFile(fullPath);
        let displayPath = fileUrl.substring(1, fileUrl.lastIndexOf('.'));
        if (displayPath.length > 6 && displayPath.substring(displayPath.length - 6) === '/index') {
            displayPath = displayPath.substring(0, displayPath.length - 6);
        }
        return displayPath;
    }

    /**
     *
     * @param {String} fullPath
     * @return {String}
     */
    createUrlPathForFile(fullPath) {
        let lastDot = fullPath.lastIndexOf(".");
        if(lastDot < 2 || lastDot < (fullPath.length -5)){
            throw new Error("fullPath without extension: " + fullPath);
        }
        let fileUrl = -1;
        if(!utils.isString(fullPath)){
            throw new Error("Illegal path to encode to url (non-string): " + fullPath);
        }
        if (this.isProjectPath(fullPath)) {
            fileUrl = "/" + this.toRelativePath(fullPath, this.projectDirPath);
        }
        if (fileUrl === -1 && this.namedPathsConfig.isNamedPathChild(fullPath)) {
            const namedPathName = this.namedPathsConfig.extractNamedPath(fullPath);
            const thePath = namedPathName.path;
            fileUrl = namedPathName.url + fullPath.substring(thePath.length);
        }
        const psCorePath = this.constructAppPath("core");//path.join(this.appDir, "core");
        if (fileUrl === -1 && fullPath.indexOf(psCorePath) === 0) {
            fileUrl = "/ps" + fullPath.substring(psCorePath.length);
        }
        const bowerPath = this.constructAppPath("bower_components");
        if (fileUrl === -1 && fullPath.indexOf(bowerPath) === 0) {
            fileUrl = "/ps/ext" + fullPath.substring(bowerPath.length);
        }
        const npmPath = this.constructAppPath("node_modules");
        if (fileUrl === -1 && fullPath.indexOf(npmPath) === 0) {
            fileUrl = "/ps/nm" + fullPath.substring(npmPath.length);
        }
        if (fileUrl === -1)
            throw new Error("Cannot encode url for path : " + fullPath);
        if(this.isDebug()){
            logger.info("url for file " + fullPath + " => " + fileUrl);
        }

        lastDot = fileUrl.lastIndexOf(".");
        if(lastDot < 2 || lastDot < (fileUrl.length -5)){
            throw new Error("file url  without extension for path "+fullPath+": " + fileUrl);
        }
        return fileUrl.split('\\').join('/');
    }

    /**
     * @param {String[]|String} partsArray
     * @return {boolean}
     */
    isExistingProjectPath(partsArray) {
        const pf = this.constructProjectPath(partsArray);
        return this.isExistingPath(pf);
    }

    preProcessServerSideIncludes(filePath, fileContent) {
        let oc = fileContent;
        if (path.extname(filePath) === '.html') {
            const regexp = /<!--\s*#include\s+virtual="[^"]+"\s*-->/;
            let myArray;
            let proc = '' + fileContent;
            while ((myArray = regexp.exec(proc)) !== null) {
                const match = myArray[0];
                const fileTag = '<!-- file:' + match.substring(match.indexOf('"') + 2, match.lastIndexOf('"') - 5) + ' -->';
                proc = utils.replaceAll(proc, match, fileTag);
            }
            oc = proc;
        }
        return oc;
    }
    /**
     * @param {String} fullPath
     * @return {String}
     */
    readFile(fullPath) {
            return this.preProcessServerSideIncludes(fullPath, utils.readTextFileSync(fullPath));
    }

    /**
     * @param {String} fullPath
     * @param {String} contents
     * @param [options]
     */
    writeFile(fullPath, contents, options) {
        utils.writeFile(fullPath, contents, options);
    }

    /**
     * @param {String} fullPath
     */
    deleteFile(fullPath) {
        fs.unlinkSync(fullPath);
    }

    /**
     * @param {String} dirPath
     */
    mkdir(dirPath) {
        fs.mkdirSync(dirPath);
    }

    /**
     * @param {String} fullDirPath
     * @return {boolean}
     */
    mkdirs(fullDirPath) {
        let created = false;
        if (!this.isExistingDirPath(fullDirPath)) {
            copier.mkdirsSync(fullDirPath);
            //wrench.mkdirSyncRecursive(fullDirPath);
            created = true;
        }
        return created;
    }

    /**
     * @param {String} fullPath
     * @param {String} contents
     * @param [options]
     */
    writeFileCreatingParents(fullPath, contents, options) {
        this.mkdirs(path.dirname(fullPath));
        this.writeFile(fullPath, contents, options);
    }

    /**
     * @return {boolean}
     */
    isProjectConfigPresent() {
        return this.isExistingFilePath(this.projectConfigPath);
    }

    /**
     * @return {{}}
     */
    readProjectConfig() {

        if (this.isProjectConfigPresent()) {
            // console.log("reader path = ", this.projectConfigReader.path);
            let txt = this.projectConfigReader.read();
            // var projectConfig = JSON.parse(this.readFile(this.projectConfigPath));
            // console.log("prjcfg text = ", txt);
            // logger.debug("Read projectConfig from "+this.projectConfigPath);
            const projectConfig = JSON.parse(txt);
            return   projectConfig;
        } else {
            logger.debug("There is no project config at " + this.projectConfigPath);
            return {};
        }
    }

    /**
     * @param {String[]|String} partsArray
     * @return {String}
     */
    readProjectFile(partsArray) {
        return this.readFile(this.constructProjectPath(partsArray));
    }

    /**
     * @param {String[]|String} partsArray
     * @return {String}
     */
    readAppFile(partsArray) {
        let fullPath;
        if(arguments.length > 1 && typeof arguments[1] === 'string'){
            const args = Array.prototype.slice.call(arguments);
            fullPath = this.constructAppPath(args);
        }else{
            fullPath = this.constructAppPath(partsArray);

        }
        return this.readFile(fullPath);

    }

    /**
     *
     * @param fullFilePath
     * @return {fs.Stats}
     */
    statPath(fullFilePath) {
        return fs.statSync(fullFilePath);
    }

    /**
     * @param {String} dirFullPath
     * @return {String[]}
     */
    listDir(dirFullPath) {
        return fs.readdirSync(dirFullPath);
    }

    /**
     * @param {String[]|String} partsArray
     * @return {String}
     */
    constructAppPath(partsArray) {
        return utils.constructChildPath(this.protostarDirPath, partsArray);
    }

    /**
     *
     * @param {String} urlPathname
     * @return {String}
     */
    resolveUrlPathnameToProjectFile(urlPathname) {
        return this.constructProjectPath(urlPathname.substring(1));
    }

    /**
     * @param {String[]|String} partsArray
     * @return {String}
     */
    constructProjectPath(partsArray) {
        return utils.constructChildPath(this.projectDirPath, partsArray);
    }

    /**
     * @return {boolean}
     */
    isDebug() {
        return this.debug;
    }

    /**
     * @return {String}
     */
    getRuntimeMode() {
        return this.mode;
    }

    /**
     * @return {String}
     */
    getThemeDirPath() {
        return this.themeDirPath;
    }

    /**
     * @return {String}
     */
    readDefaultConfigText() {
        return "" + this.readFile(this.defaultConfigPath);
    }

    /**
     * @return {String}
     */
    readUserConfigText() {
        return "" + this.readFile(this.configPath);
    }

    /**
     * @return {boolean}
     */
    userConfigExists() {
        return this.isExistingFilePath(this.configPath);
    }

    /**
     * @return {Object}
     */
    readUserConfig() {
        let configTxt;
        if(this.userConfigExists()){
            configTxt = this.readUserConfigText();
        }else{
            configTxt = this.readDefaultConfigText();
            this.writeFile(this.configPath, configTxt);
        }
        let config;
        try{
            config = JSON.parse(configTxt);
        }catch(ParseException){
            logger.error("Invalid content in global config.json : " + configTxt, ParseException.stack);
            config = this.readDefaultConfigText();
            this.writeFile(this.configPath, config);
            logger.info("Created new global config based on defaults at " + this.configPath);
        }
        return config;
    }

    /**
     * Creates rootless (doesnt start with slash) path relative to passed basedir
     * eg making /home/spectre relative to /home -> spectre
     * @param {String} fullPath
     * @param {String} basePath
     * @returns {string}
     */
    toRelativePath(fullPath, basePath) {
        if (!utils.isString(fullPath)) {
            throw new Error("Invalid non-string fullPath: " + fullPath);
        }
        if (!utils.isString(basePath)) {
            throw new Error("Invalid non-string basePath: " + basePath);
        }
        const relative = fullPath.substring(basePath.length).substring(1);
        return relative;
    }

    /**
     *
     * @param {String} fullPath
     * @return {string}
     */
    toRelativeProjectPath(fullPath) {
        if(!this.isProjectPath(fullPath)){
            throw new Error("Not a project path: " + fullPath);
        }
        return this.toRelativePath(fullPath, this.projectDirPath);
    }

    /**
     *
     * @param {String} fullPath
     * @return {string}
     */
    toRelativeAppPath(fullPath) {
        if(!this.isAppPath(fullPath)){
            throw new Error("Not an app path: " + fullPath);
        }
        return this.toRelativePath(fullPath, this.protostarDirPath);
    }

    /**
     *
     * @param {String} urlPathName
     * @return {boolean}
     */
    isInternalBowerDepUrlPathname(urlPathName) {
        return urlPathName.indexOf("/ps/ext/") === 0;
    }

    /**
     *
     * @param {String} urlPathName
     * @return {boolean}
     */
    isInternalNodeDepUrlPathname(urlPathName) {
        return urlPathName.indexOf("/ps/nm/") === 0;
    }

    /**
     *
     * @param {String} urlPathName
     * @return {boolean}
     */
    isInternalUrlPathname(urlPathName) {
        return urlPathName.indexOf("/ps/") === 0;
    }

    /**
     *
     * @param {String} upn
     * @return {String|boolean}
     */
    findFileForUrlPathname(upn) {
        let filePath = false;
        const urlPartName = upn;//.split('/').join(path.sep);

        if(this.namedPathsConfig.isNamedPathUrlPathname(urlPartName)){
            filePath = this.namedPathsConfig.resolveUrlPathnameToNamedPathFile(urlPartName);
        }
        if(!filePath && this.isInternalBowerDepUrlPathname(urlPartName)){
            filePath = this.constructAppPath(["bower_components", urlPartName.substring(8)]);
        }
        if(!filePath && this.isInternalNodeDepUrlPathname(urlPartName)){
            filePath = this.constructAppPath(["node_modules", urlPartName.substring(7)]);
        }
        if(!filePath && this.isInternalUrlPathname(urlPartName)){
            filePath = this.constructAppPath(["core", urlPartName.substring(4)]);
        }
        if(!filePath && this.isProjectFileUrlPathname(urlPartName)){
            filePath = this.resolveUrlPathnameToProjectFile(urlPartName);
        }
        if(utils.getObjectType(filePath) === 'Boolean'){
            throw new Error("Could not find filePath for urlPathname " + urlPartName);
        }
        if(filePath.indexOf("//")>0){
            throw new Error("Illegal double slash url for urlPathName " + urlPartName + " => " + filePath);
        }
        filePath = filePath.split('/').join(path.sep);
        return filePath;
    }

    /**
     * @return {String}
     */
    getTargetDirPath() {
        return this.targetDirPath;
    }

    /**
     *
     * @param {Placeholder} placeholder
     * @return {String}
     */
    resolveExactFilePathForPlaceHolder(placeholder) {
        const phName = placeholder.getName();
        if(this.isDebug()){
            logger.info("Resolving placeholder reference type=" + placeholder.getType() + " name=" +placeholder.getName());
        }
        let filePath = false;
        const npPotential = phName.substring(0, phName.indexOf('/', 1));
        if(this.namedPathsConfig.isNamedPathName(npPotential)){
            const np = this.namedPathsConfig.getNamedPath(npPotential);
            filePath = np.path  + phName.substring(phName.indexOf('/', 1));
        }
        if(!filePath && this.isInternalBowerDepUrlPathname(phName)){
            filePath = this.constructAppPath(["bower_components", phName.substring(8)]);
        }
        if(!filePath && this.isInternalNodeDepUrlPathname(phName)){
            filePath = this.constructAppPath(["node_modules", phName.substring(7)]);
        }
    //        if(!filePath && this.isInternalAssetUrlPathname(phName)){
    //            filePath = this.constructAppPath(["core", phName.substring(4) + ext]);
    //        }
        if(!filePath && this.isInternalUrlPathname(phName)){
            filePath = this.constructAppPath(["core", phName.substring(4)]);
        }
        if(!filePath && this.isProjectFileUrlPathname("/" + phName)){
            filePath = this.resolveUrlPathnameToProjectFile("/" + phName );
        }
        if(utils.getObjectType(filePath) === 'Boolean'){
            throw new Error("Could not find filePath for placeholder of type " + placeholder.getType() + " named " + phName);
        }
        if(filePath.indexOf("//")>0){
            throw new Error("Illegal double slash url for filepath for placeholder  of type " + placeholder.getType() + " named " + phName + " => " + filePath);
        }
        if(!this.isExistingPath(filePath)){
            throw new Error("File for placeholder doesn't exists: " + filePath);
        }
        return filePath;
    }

    /**
     *
     * @param {Placeholder} placeholder
     * @return {String}
     */
    resolveFilePathForPlaceHolder(placeholder) {
        const phName = placeholder.name;
        if(this.isDebug()){
            logger.info("Resolving placeholder reference type=" + placeholder.type + " name=" +placeholder.name);
        }
        let ext = false;
        switch(placeholder.type){
            case 'layout':
            case 'file':
            case 'hb':
            case 'wrap':
                ext = ".html";
                if(phName.indexOf('./') === 0 || phName.indexOf('../') === 0){
                    logger.error("Relative placeholder: ", placeholder);
                    throw new Error("TODO : relative file references");
                }
                break;
            case 'linkCss':
                ext = ".css";
                break;
            case 'linkScript':
                ext = ".js";
                break;
            default:
                throw new Error ("Unknown type of placeholder, cannot determine suffix:  " + placeholder.type);
        }

        let filePath = false;
        const npPotential = phName.substring(0, phName.indexOf('/', 1));
        if(this.namedPathsConfig.isNamedPathName(npPotential)){
            const np = this.namedPathsConfig.getNamedPath(npPotential);
            filePath = np.path  + phName.substring(phName.indexOf('/', 1))+ ext; //this.resolveUrlPathnameToNamedPathFile(urlPartName);
        }
        if(!filePath && this.isInternalBowerDepUrlPathname(phName)){
            filePath = this.constructAppPath(["bower_components", phName.substring(8) + ext]);
        }
        if(!filePath && this.isInternalNodeDepUrlPathname(phName)){
            filePath = this.constructAppPath(["node_modules", phName.substring(7) + ext]);
        }
        if(!filePath && this.isInternalUrlPathname(phName)){
            filePath = this.constructAppPath(["core", phName.substring(4) + ext]);
        }
        if(!filePath && this.isProjectFileUrlPathname("/" + phName)){
            filePath = this.resolveUrlPathnameToProjectFile("/" + phName + ext);
        }
        if(utils.getObjectType(filePath) === 'Boolean'){
            throw new Error("Could not find filePath for placeholder of type " + placeholder.type + " named " + phName);
        }
        if(filePath.indexOf("//")>0){
            throw new Error("Illegal double slash url for filepath for placeholder  of type " + placeholder.type + " named " + phName + " => " + filePath);
        }
        if(!this.isExistingPath(filePath)){
            logger.debug("Received a request for a path that doesn't exist, what shall we do : " + filePath);
            if(path.basename(path.dirname(filePath)) === '_dynamic'){
                logger.info("Creating temp _dynamic file at " + filePath);
                this.writeFile(filePath, "");
            }else{
                let jadeFp = filePath.substring(0, filePath.lastIndexOf('.')) + '.jade';
                logger.debug("Checking jade path : " + jadeFp);
                if(fs.existsSync(jadeFp)){
                    return jadeFp;
                }
                const hbsFp = filePath.substring(0, filePath.lastIndexOf('.')) + '.hbs';
                logger.debug("Checking hbs path : " + hbsFp);
                if(fs.existsSync(hbsFp)){
                    return hbsFp;
                }

                const mdFile = filePath.substring(0, filePath.lastIndexOf(".")) + ".md";
                if(this.isExistingFilePath(mdFile)){
                    return mdFile;
                }
                logger.error("File for placeholder doesn't exists: " + filePath, placeholder);
                console.trace("File for placeholder doesn't exists: " + filePath);
                throw new Error("File for placeholder doesn't exists: " + filePath);
            }
        }else{
            if(ext === '.html'){
                let jadeFp = filePath.substring(0, filePath.lastIndexOf('.')) + ".jade";
                if(fs.existsSync(jadeFp)){
                    return jadeFp;
                }
            }
        }
        return filePath;
    }
    determineProtostarAttributeValue(attrName, attrValue, prefix) {
        const origVal = attrValue;
        const val = origVal.substring(3);
        logger.info("Processing : " + val);
        let newVal;
        if(val.indexOf('./') !== 0 && val.indexOf('../') !== 0){
            if (val.indexOf("/ps/") === 0) {
                newVal = val;
            } else if (val.charAt(0) !== '.' && val.charAt(0) !== '/') {
                const dirName = val.substring(0, val.indexOf('/'));
                const namedPathUrl = this.namedPathsConfig.resolveNamedPathUrl(dirName);
                newVal = namedPathUrl + val.substring(val.indexOf('/'));
            }else {
                newVal = val;
            }
            logger.info("Encoded ps:attr " + origVal + " -> " + newVal);
            let pf = "";
            if(typeof prefix === 'string'){
                pf = prefix;
            }
            newVal = pf + newVal;
        }else{
            throw new Error("Relative link in ps: attribute : "+ attrName + "='" + attrValue +"' with optional prefix=" + prefix);
        }
        return newVal;
    }
}

module.exports = ProtostarRuntime;