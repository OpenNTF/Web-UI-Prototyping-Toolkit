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

var utils = require("./utils");
var path = require("path");
var fs = require("./filesystem");
var logger = utils.createLogger({sourceFilePath : __filename});
var copier = require("./copier");
/**
 * Encapsulates access based on runtime information for Protostar such as
 * install dir, active project, ..
 * Example arguments:{
 *   workingDirPath: '/home/spectre',
 *   fullCommandLineArgs: process.argv
 * }
 * These are passed in to facilitate testing
 * @param {{protostarDirPath: String, port: Number, projectDirPath: String, targetDirPath: String, themeDirPath: String, lenient: boolean, cachingEnabled: boolean}} args should contain workingDirPath and fullCommandLineArgs
 * @constructor
 */
function ProtostarRuntime(args){

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
    this.projectConfigPath;

    /**
     * @type {Object}
     */
    this.userConfig;

    /**
     * @type {Object}
     */
    this.projectConfig;

    this.namedPathsConfig;
    this.namedPathsArray;
    this.namedPathsPathMap;
    this.namedPathsUrlMap;

    this.readCache = {
        pathStamps : {

        },
        pathContents: {

        }
    };

    /**
     *
     * @type {utils.ItemCache}
     */
    this.imageCache = new utils.ItemCache(function(image){
        var keyPart;
        try {
            keyPart = image.link.substring(image.link.lastIndexOf('/photos/') + 8);
            image.id = keyPart;
            if(image.media.hasOwnProperty("m") && !image.media.hasOwnProperty("b")&&image.media.m.indexOf("_m.jpg")>0){
                image.media.b = image.media.m.replace("_m.jpg", "_b.jpg");
            }
        } catch (e) {
            console.error(e.stack);
            throw new Error("could not extract key from " + image.link + ": " + e.message);
        }
        return keyPart;
    });

    this.setupRuntime = function(){
        if(this.mode !== 'create'){
            this.validatePaths();
        }
        if(this.projectDirPath){
            /**
             * @type {String}
             */
            this.projectConfigPath = path.join(this.projectDirPath, this.projectConfigFilename);
            this.userConfig = this.readUserConfig();
            this.projectConfig = this.readProjectConfig();
            this.namedPathsConfig = this.getNamedPathsConfigObject();
            this.namedPathsArray = this.getNamedPathConfigsArray();
            this.namedPathsPathMap = this.createNamedPathsPathMap();
            this.namedPathsUrlMap = this.createNamedPathsUrlMap();
        }
    };


    this.setupRuntime();
}

ProtostarRuntime.prototype.validatePaths = function(){
    var that = this;
    for(var pathfield in that){
        if(that.hasOwnProperty(pathfield) && utils.isString(that[pathfield]) && pathfield.toLowerCase().indexOf("path") >0 && pathfield !== "configPath" && pathfield !== 'targetDirPath'){
            /* TODO: Path checks fails although it is working
             if(!that.isExistingPath(that[pathfield])){
             throw new Error("Required path arg " + pathfield + " does not exist: " + that[pathfield]);
             } */
        }
    }
};


/**
 * @return {String}
 */
ProtostarRuntime.prototype.getNodeCommandPath = function(){
    return this.nodeCommandPath;
};

/**
 * @return {Number}
 */
ProtostarRuntime.prototype.getPort = function(){
    return this.port;
};

/**
 *
 * @param {String} fullPath
 * @return {boolean}
 */
ProtostarRuntime.prototype.isExistingPath = function(fullPath){
    return fs.existsSync(fullPath);
};

/**
 *
 * @param {String} fullFilePath
 * @return {boolean}
 */
ProtostarRuntime.prototype.isExistingFilePath = function(fullFilePath){
    return this.isExistingPath(fullFilePath) && fs.statSync(fullFilePath).isFile();
};

/**
 *
 * @param {String} fullDirPath
 * @return {boolean}
 */
ProtostarRuntime.prototype.isExistingDirPath = function(fullDirPath){
    return this.isExistingPath(fullDirPath) && fs.statSync(fullDirPath).isDirectory();
};

/**
 * @param {String[]|String} partsArray
 * @return {boolean}
 */
ProtostarRuntime.prototype.isExistingProjectFilePath = function(partsArray){
    var pf = this.constructProjectPath(partsArray);
    return this.isExistingPath(pf) && fs.statSync(pf).isFile();
};
/**
 * @param {String} fullPath
 * @return {boolean}
 */
ProtostarRuntime.prototype.isAppPath = function(fullPath){
    return fullPath.indexOf(this.protostarDirPath) === 0;
};
/**
 * @param {String} fullPath
 * @return {boolean}
 */
ProtostarRuntime.prototype.isProjectPath = function(fullPath){
    return fullPath.indexOf(this.projectDirPath) === 0;
};

/**
 * @param {String} urlPathName
 * @return {boolean}
 */
ProtostarRuntime.prototype.isProjectFileUrlPathname = function(urlPathName){
    return this.isProjectPath(this.projectDirPath + urlPathName);
};

/**
 *
 * @param {String} fullProjectPath
 * @return {String}
 */
ProtostarRuntime.prototype.createTemplateReferenceFromFullPath = function (fullProjectPath) {
    if (this.isAppPath(fullProjectPath)) {
        return this.toRelativeAppPath(fullProjectPath).substring(1);
    } else if (this.isProjectPath(fullProjectPath)) {
        return this.toRelativeProjectPath(fullProjectPath);//.substring(1);
    } else {
        throw new Error("Unmapped path type for toRelative: " + fullProjectPath);
    }
};

/**
 * @param {String} fullPath
 * @return {string}
 */
ProtostarRuntime.prototype.createHtmlFileDisplayName = function(fullPath){
    var fileUrl = this.createUrlPathForFile(fullPath);
    var displayPath = fileUrl.substring(1, fileUrl.lastIndexOf('.'));
    if (displayPath.length > 6 && displayPath.substring(displayPath.length - 6) === '/index') {
        displayPath = displayPath.substring(0, displayPath.length - 6);
    }
    return displayPath;
};

/**
 *
 * @param {String} fullPath
 * @return {String}
 */
ProtostarRuntime.prototype.createUrlPathForFile = function (fullPath) {
    var lastDot = fullPath.lastIndexOf(".");
    if(lastDot < 2 || lastDot < (fullPath.length -5)){
        throw new Error("fullPath without extension: " + fullPath);
    }
    var fileUrl = -1;
    if(!utils.isString(fullPath)){
        throw new Error("Illegal path to encode to url (non-string): " + fullPath);
    }
    if (this.isProjectPath(fullPath)) {
        fileUrl = "/" + this.toRelativePath(fullPath, this.projectDirPath);
    }
    if (fileUrl === -1 && this.isNamedPathChild(fullPath)) {
        var namedPathName = this.extractNamedPath(fullPath);
        var thePath = namedPathName.path;
        fileUrl = namedPathName.url + fullPath.substring(thePath.length);
    }
    var psCorePath = this.constructAppPath("core");//path.join(this.appDir, "core");
    if (fileUrl === -1 && fullPath.indexOf(psCorePath) === 0) {
        fileUrl = "/ps" + fullPath.substring(psCorePath.length);
    }
    var bowerPath = this.constructAppPath("bower_components");
    if (fileUrl === -1 && fullPath.indexOf(bowerPath) === 0) {
        fileUrl = "/ps/ext" + fullPath.substring(bowerPath.length);
    }
    var npmPath = this.constructAppPath("node_modules");
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
};

/**
 * @param {String[]|String} partsArray
 * @return {boolean}
 */
ProtostarRuntime.prototype.isExistingProjectDirPath = function(partsArray){
    var pf = this.constructProjectPath(partsArray);
    return this.isExistingDirPath(pf);
};
/**
 * @param {String[]|String} partsArray
 * @return {boolean}
 */
ProtostarRuntime.prototype.isExistingAppFilePath = function(partsArray){
    var pf = this.constructAppPath(partsArray);
    return this.isExistingFilePath(pf);
};
/**
 * @param {String[]|String} partsArray
 * @return {boolean}
 */
ProtostarRuntime.prototype.isExistingAppDirPath = function(partsArray){
    var pf = this.constructAppPath(partsArray);
    return this.isExistingDirPath(pf);
};
/**
 * @param {String[]|String} partsArray
 * @return {boolean}
 */
ProtostarRuntime.prototype.isExistingAppPath = function(partsArray){
    var pf = this.constructAppPath(partsArray);
    return this.isExistingPath(pf);
};

/**
 * @param {String[]|String} partsArray
 * @return {boolean}
 */
ProtostarRuntime.prototype.isExistingProjectPath = function(partsArray){
    var pf = this.constructProjectPath(partsArray);
    return this.isExistingPath(pf);
};



ProtostarRuntime.prototype.clearReadCache = function(){
    for(var p in this.readCache.pathStamps){
        delete this.readCache.pathStamps[p];
    }
    for(var cp in this.readCache.pathContents){
        delete this.readCache.pathContents[cp];
    }
};


/**
 * @param {String} fullPath
 * @return {String}
 */
ProtostarRuntime.prototype.readFile = function(fullPath){
    var st = this.statFile(fullPath);
    var maxCachedFileSize = 1024*1024; // 1MB
    if(st.size > maxCachedFileSize){
        logger.warn("File is too large to cache: " + fullPath);
        return utils.readTextFileSync(fullPath);
    }
    var now = "" + st.mtime.getTime();
    if(!this.readCache.pathStamps.hasOwnProperty(fullPath) || this.readCache.pathStamps[fullPath] !== now){
        logger.debug("READ " + fullPath);
        this.readCache.pathStamps[fullPath] = now;
        this.readCache.pathContents[fullPath] = utils.readTextFileSync(fullPath);
        return this.readCache.pathContents[fullPath];
    }else{
        return this.readCache.pathContents[fullPath];
    }
};

/**
 * @param {String} fullPath
 * @param {String} contents
 * @param [options]
 */
ProtostarRuntime.prototype.writeFile = function(fullPath, contents, options){
    utils.writeFile(fullPath, contents, options);
};
/**
 * @param {String} fullPath
 */

ProtostarRuntime.prototype.deleteFile = function(fullPath){
    fs.unlinkSync(fullPath);
};
/**
 * @param {String} dirPath
 */
ProtostarRuntime.prototype.mkdir = function(dirPath){
    fs.mkdirSync(dirPath);
};
/**
 * @param {String} fullDirPath
 * @return {boolean}
 */
ProtostarRuntime.prototype.mkdirs = function(fullDirPath){
    var created = false;
    if (!this.isExistingDirPath(fullDirPath)) {
        copier.mkdirsSync(fullDirPath);
        //wrench.mkdirSyncRecursive(fullDirPath);
        created = true;
    }
    return created;
};
/**
 * @param {String} fullPath
 * @param {String} contents
 * @param [options]
 */
ProtostarRuntime.prototype.writeFileCreatingParents = function(fullPath, contents, options){
    this.mkdirs(path.dirname(fullPath));
    this.writeFile(fullPath, contents, options);
};
/**
 * @return {boolean}
 */
ProtostarRuntime.prototype.isProjectConfigPresent = function(){
    return this.isExistingFilePath(this.projectConfigPath);
};
/**
 * @return {{}}
 */
ProtostarRuntime.prototype.readProjectConfig = function () {
    if (this.isProjectConfigPresent()) {
        var projectConfig = JSON.parse(this.readFile(this.projectConfigPath));
        logger.debug("Read projectConfig from "+this.projectConfigPath);
        return   projectConfig;
    } else {
        logger.debug("There is no project config at " + this.projectConfigPath);
        return {};
    }
};

/**
 *
 * @param {String} baseDir
 * @param {String[]|String} args
 * @return {String}
 */
var constructChildPath = function(baseDir, args){
    if(!utils.isString(baseDir)){
        throw new Error("baseDir arg should be string: " + baseDir);
    }
    var constructed;
    var argsType = utils.getObjectType(args);
    switch(argsType){
        case "String":
            constructed = path.join(baseDir, args);
            break;
        case "Array":
            var theArray = args;
            theArray.splice(0,0, baseDir);
            constructed = path.join.apply(undefined, theArray);
            break;
        case "Arguments":
            throw new Error("Arguments not supported for args");
        default:
            throw new Error("Unknown or missing args; type=" + argsType  + ": "  + args);
    }
    logger.debug('constructed: ' + constructed);
    return constructed;

};

/**
 * @param {String[]|String} partsArray
 * @return {String}
 */

ProtostarRuntime.prototype.readProjectFile = function(partsArray){
    return this.readFile(this.constructProjectPath(partsArray));
};
/**
 * @param {String[]|String} partsArray
 * @return {String}
 */
ProtostarRuntime.prototype.readAppFile = function(partsArray){
    var fullPath = this.constructAppPath(partsArray);
    return this.readFile(fullPath);
};

/**
 *
 * @param fullFilePath
 * @return {fs.Stats}
 */
ProtostarRuntime.prototype.statPath = function(fullFilePath){
    return fs.statSync(fullFilePath);
};
ProtostarRuntime.prototype.statFile = ProtostarRuntime.prototype.statPath;
ProtostarRuntime.prototype.statDir = ProtostarRuntime.prototype.statPath;

/**
 * @return {String[]}
 */

ProtostarRuntime.prototype.listProjectDir = function(){
    return this.listDir(this.constructProjectPath(arguments));
};
/**
 * @param {String} dirFullPath
 * @return {String[]}
 */
ProtostarRuntime.prototype.listDir = function(dirFullPath){
    return fs.readdirSync(dirFullPath);
};
/**
 * @param {String[]|String} partsArray
 * @return {String}
 */

ProtostarRuntime.prototype.listAppDir = function(partsArray){
    return this.listDir(this.constructAppPath(partsArray));
};
/**
 * @param {String[]|String} partsArray
 * @return {String}
 */

ProtostarRuntime.prototype.constructAppPath = function(partsArray){
    return constructChildPath(this.protostarDirPath, partsArray);
};
/**
 * @param {String[]|String} partsArray
 * @return {String}
 */
ProtostarRuntime.prototype.constructProjectPath = function(partsArray){
    return constructChildPath(this.projectDirPath, partsArray);
};

ProtostarRuntime.prototype.getInfo = function(){
    var infoTypes = {"String":1, "Number":1, "Array":1};
    var info = {};
    for(var prop in this){
        if(this.hasOwnProperty(prop)){
            if(infoTypes.hasOwnProperty(utils.getObjectType(this[prop]))){
                info[prop] = this[prop];
            }
        }
    }
    return info;
};

/**
 * @return {boolean}
 */
ProtostarRuntime.prototype.isDebug = function(){
    return this.debug;
};


/**
 * @return {String}
 */
ProtostarRuntime.prototype.getRuntimeMode = function(){
    return this.mode;
};


/**
 * @return {String}
 */
ProtostarRuntime.prototype.getThemeDirPath = function(){
    return this.themeDirPath;
};
/**
 * @return {String}
 */
ProtostarRuntime.prototype.getProjectDirPath = function(){
    return this.themeDirPath;
};
/**
 * @return {String}
 */
ProtostarRuntime.prototype.readDefaultConfigText = function(){
    return "" + this.readFile(this.defaultConfigPath);
};
/**
 * @return {String}
 */
ProtostarRuntime.prototype.readUserConfigText = function(){
    return "" + this.readFile(this.configPath);
};

/**
 * @return {boolean}
 */
ProtostarRuntime.prototype.userConfigExists = function(){
    return this.isExistingFilePath(this.configPath);
};

/**
 * @return {Object}
 */
ProtostarRuntime.prototype.readUserConfig = function(){
    var configTxt;
    if(this.userConfigExists()){
        configTxt = this.readUserConfigText();
    }else{
        configTxt = this.readDefaultConfigText();
        this.writeFile(this.configPath, configTxt);
    }
    var config;
    try{
        config = JSON.parse(configTxt);
    }catch(ParseException){
        logger.error("Invalid content in global config.json : " + configTxt, ParseException.stack);
        config = this.readDefaultConfigText();
        this.writeFile(this.configPath, config);
        logger.info("Created new global config based on defaults at " + this.configPath);
    }
    return config;
};

/**
 * Creates rootless (doesnt start with slash) path relative to passed basedir
 * eg making /home/spectre relative to /home -> spectre
 * @param {String} fullPath
 * @param {String} basePath
 * @returns {string}
 */
ProtostarRuntime.prototype.toRelativePath = function (fullPath, basePath) {
    if (!utils.isString(fullPath)) {
        throw new Error("Invalid non-string fullPath: " + fullPath);
    }
    if (!utils.isString(basePath)) {
        throw new Error("Invalid non-string basePath: " + basePath);
    }
    var relative = fullPath.substring(basePath.length).substring(1);
    return relative;
};
/**
 *
 * @param {String} fullPath
 * @return {string}
 */
ProtostarRuntime.prototype.toRelativeProjectPath = function (fullPath) {
    if(!this.isProjectPath(fullPath)){
        throw new Error("Not a project path: " + fullPath);
    }
    return this.toRelativePath(fullPath, this.projectDirPath);
};
/**
 *
 * @param {String} fullPath
 * @return {string}
 */
ProtostarRuntime.prototype.toRelativeAppPath = function (fullPath) {
    if(!this.isAppPath(fullPath)){
        throw new Error("Not an app path: " + fullPath);
    }
    return this.toRelativePath(fullPath, this.protostarDirPath);
};

/**
 *
 * @param {String} urlPathName
 * @return {boolean}
 */
ProtostarRuntime.prototype.isInternalBowerDepUrlPathname = function(urlPathName){
    return urlPathName.indexOf("/ps/ext/") === 0;
};
/**
 *
 * @param {String} urlPathName
 * @return {boolean}
 */
ProtostarRuntime.prototype.isInternalNodeDepUrlPathname = function(urlPathName){
    return urlPathName.indexOf("/ps/nm/") === 0;
};

/**
 *
 * @param {String} urlPathName
 * @return {boolean}
 */
ProtostarRuntime.prototype.isInternalUrlPathname = function(urlPathName){
    return urlPathName.indexOf("/ps/") === 0;
};

/**
 *
 * @param {String} upn
 * @return {String|boolean}
 */
ProtostarRuntime.prototype.findFileForUrlPathname = function (upn) {
    var filePath = false;
    var urlPartName = upn;//.split('/').join(path.sep);

    if(this.isNamedPathUrlPathname(urlPartName)){
        filePath = this.resolveUrlPathnameToNamedPathFile(urlPartName);
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
};

/**
 * @return {String}
 */
ProtostarRuntime.prototype.getTargetDirPath = function(){
    return this.targetDirPath;
};


/**
 *
 * @param {utils.Placeholder} placeholder
 * @return {String}
 */
ProtostarRuntime.prototype.resolveExactFilePathForPlaceHolder = function(placeholder){
    var phName = placeholder.getName();
    if(this.isDebug()){
        logger.info("Resolving placeholder reference type=" + placeholder.getType() + " name=" +placeholder.getName());
    }
    var filePath = false;
    var npPotential = phName.substring(0, phName.indexOf('/', 1));
    if(this.isNamedPathName(npPotential)){
        var np = this.getNamedPath(npPotential);
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
};


/**
 *
 * @param {utils.Placeholder} placeholder
 * @return {String}
 */
ProtostarRuntime.prototype.resolveFilePathForPlaceHolder = function(placeholder){
    var phName = placeholder.getName();
    if(this.isDebug()){
        logger.info("Resolving placeholder reference type=" + placeholder.getType() + " name=" +placeholder.getName());
    }
    var ext = false;
    switch(placeholder.getType()){
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
            throw new Error ("Unknown type of placeholder, cannot determine suffix:  " + placeholder.getType());
    }

    var filePath = false;
    var npPotential = phName.substring(0, phName.indexOf('/', 1));
    if(this.isNamedPathName(npPotential)){
        var np = this.getNamedPath(npPotential);
        filePath = np.path  + phName.substring(phName.indexOf('/', 1))+ ext//this.resolveUrlPathnameToNamedPathFile(urlPartName);
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
        throw new Error("Could not find filePath for placeholder of type " + placeholder.getType() + " named " + phName);
    }
    if(filePath.indexOf("//")>0){
        throw new Error("Illegal double slash url for filepath for placeholder  of type " + placeholder.getType() + " named " + phName + " => " + filePath);
    }
    if(!this.isExistingPath(filePath)){
        logger.debug("Received a request for a path that doesn't exist, what shall we do : " + filePath);
        if(path.basename(path.dirname(filePath)) === '_dynamic'){
            logger.info("Creating temp _dynamic file at " + filePath);
            this.writeFile(filePath, "");
        }else{
            var jadeFp = filePath.substring(0, filePath.lastIndexOf('.')) + '.jade';
            logger.debug("Checking jade path : " + jadeFp);
            if(fs.existsSync(jadeFp)){
                return jadeFp;
            }
            var hbsFp = filePath.substring(0, filePath.lastIndexOf('.')) + '.hbs';
            logger.debug("Checking hbs path : " + hbsFp);
            if(fs.existsSync(hbsFp)){
                return hbsFp;
            }

            var mdFile = filePath.substring(0, filePath.lastIndexOf(".")) + ".md";
            if(this.isExistingFilePath(mdFile)){
                return mdFile;
            }
            logger.error("File for placeholder doesn't exists: " + filePath, placeholder);
            console.trace("File for placeholder doesn't exists: " + filePath);
            throw new Error("File for placeholder doesn't exists: " + filePath);
        }
    }else{
        if(ext === '.html'){
            var jadeFp = filePath.substring(0, filePath.lastIndexOf('.')) + ".jade";
            if(fs.existsSync(jadeFp)){
                return jadeFp;
            }
        }
    }
    return filePath;
};

/**
 * @return {boolean}
 */
ProtostarRuntime.prototype.isNamedPathsEnabled = function(){
    return this.projectConfig.hasOwnProperty('project') && this.projectConfig.project.hasOwnProperty('namedPaths') && typeof this.projectConfig.project["namedPaths"] === 'object';
};

/**
 *
 * @return {Object.<String, {path: String, url: String}>}
 */
ProtostarRuntime.prototype.getNamedPathsConfigObject = function(){
    if(this.isNamedPathsEnabled()){
        return this.projectConfig.project["namedPaths"];
    } else {
        logger.info("There are no named paths. config=", this.projectConfig);
        return {};
    }
};

/**
 *
 * @param {{path:String,url:String}} namedPath
 * @param {String} name
 * @return {{name:String, path:String,url:String}}
 */
ProtostarRuntime.prototype.initNamedPath = function(namedPath, name){
    namedPath.name = name;
    if(!utils.hasPropertyOfType(namedPath, "url", "String") || !utils.hasPropertyOfType(namedPath, "path", "String")){
        logger.error("Invalid named path:", namedPath);
        throw new Error("Named path " + name + " is missing url and/or path fields");
    }
    var thePath = namedPath.path.split('/').join(path.sep);
    if (thePath.indexOf(path.sep) !== 0 && thePath.indexOf(':\\') !== 1) {
        namedPath.path = path.normalize(this.projectDirPath + path.sep + thePath);
    }
    return namedPath;
};

ProtostarRuntime.prototype.getNamedPathConfigsArray = function () {
    var paths = [];
    for (var nm in this.namedPathsConfig) {
        if (utils.hasPropertyOfType(this.namedPathsConfig, nm, "Object")) {
            var namedPath = this.namedPathsConfig[nm];
            paths.push(this.initNamedPath(namedPath, nm));
        }
    }
    this.validateNamedPaths(paths);
    return paths;
};

/**
 *
 * @param {String} name
 * @return {String}
 */
ProtostarRuntime.prototype.resolveNamedPathUrl = function (name) {
    return this.getNamedPath(name).url;
};

/**
 *
 * @param {String} name
 * @return {{path: String, url: String}}
 */
ProtostarRuntime.prototype.getNamedPath = function (name ) {
    var cfg = this.projectConfig;
    if (utils.nestedPathExists(cfg, "project", "namedPaths", name)) {
        if (cfg.project["namedPaths"].hasOwnProperty(name)) {
            return this.initNamedPath(cfg.project["namedPaths"][name], name);
        } else {
            logger.info("There is no such named path : " + name + "  config=", cfg);
            throw new Error("Not a named path: " + name);
        }
    } else {
        logger.info("Not a named path : " + name + "  config=", cfg);
        throw new Error("Not a named path: " + name);
    }
};
ProtostarRuntime.prototype.validateNamedPaths = function(namedPaths){
    namedPaths.forEach(function(namedPath){
        if(!fs.existsSync(namedPath.path)){
            logger.error("Named path doesn't exist : ", namedPath.path);
            throw new Error("Named path " + namedPath.name + " doesn't exist, check prototype.json ");
        }
    })
};
ProtostarRuntime.prototype.isNamedPathName = function (name) {
    return  this.namedPathsConfig.hasOwnProperty(name);
};

ProtostarRuntime.prototype.extractNamedPathUrlChild = function (url) {
    var paths = this.namedPathsArray;
    var found = false;
    paths.forEach(function (np) {
        if (url === np.url || url.indexOf(np.url) === 0) {
            found = np;
        }
    });
    return found;
};


/**
 *
 * @param {String} fullPath
 * @return {boolean}
 */
ProtostarRuntime.prototype.isNamedPathChild = function (fullPath) {
    var paths = this.namedPathsArray;
    var found = false;
    paths.forEach(function (np) {
        if (fullPath.indexOf(np.path) === 0) {
            found = true;
        }
    });
    return found;
};

/**
 *
 * @param {String} urlPathname
 * @return {boolean}
 */
ProtostarRuntime.prototype.isNamedPathUrlPathname = function (urlPathname) {
    var found = false;
    if(urlPathname.length >= 2){
        var secSlash = urlPathname.indexOf("/", 1);
        var npUrlPotential = urlPathname.substring(0, secSlash);
        if(this.namedPathsUrlMap.hasOwnProperty(npUrlPotential)){
            found = true;
        }else{
            if(this.isDebug())
                logger.info("No entry in named paths url map for "+ npUrlPotential);
        }
    }
    return found;
};


ProtostarRuntime.prototype.extractNamedPath = function (fullPath) {
    var paths = this.namedPathsArray;
    var namedPath = false;
    paths.forEach(function (np) {
        if (fullPath.indexOf(np.path) === 0) {
            namedPath = np;
        }
    });
    return namedPath;
};

/**
 *
 * @return {Object.<String,String>}
 */
ProtostarRuntime.prototype.createNamedPathsUrlMap = function(){
    var map =  {};
    if(this.isNamedPathsEnabled()){
        this.namedPathsArray.forEach(function(np){
            map[np.url] = np.name;
        });
    }
    return map;
};

/**
 *
 * @param {String} urlPathname
 * @return {String}
 */
ProtostarRuntime.prototype.resolveUrlPathnameToNamedPathName = function(urlPathname){
    var name = false;
    if(urlPathname.length >= 2){
        var secSlash = urlPathname.indexOf("/", 1);
        if(secSlash > 0){
            var namedPathUrl = urlPathname.substring(0, secSlash);
            if(this.namedPathsUrlMap.hasOwnProperty(namedPathUrl)){
                var namedPathName = this.namedPathsUrlMap[namedPathUrl];
                name = namedPathName;
            }
        }
    }
    if(name === false){
        throw new Error("Could not construct named path filepath for urlpathname " + urlPathname);
    }
    return name;
};

/**
 *
 * @param {String} urlPathname
 * @return {String|boolean}
 */
ProtostarRuntime.prototype.resolveUrlPathnameToNamedPathFile = function(urlPathname){
    var filePath = false;
    if(urlPathname.length >= 2){
        var secSlash = urlPathname.indexOf("/", 1);
        if(secSlash > 0){
            var namedPathUrl = urlPathname.substring(0, secSlash);
            if(this.namedPathsUrlMap.hasOwnProperty(namedPathUrl)){
                var namedPathName = this.namedPathsUrlMap[namedPathUrl];
                var np = this.getNamedPath(namedPathName).path;
                filePath =  np + urlPathname.substring(namedPathUrl.length);
            }
        }
    }
    if(filePath.indexOf('c:',1)>0){
        throw new Error("Illegal path: " + filePath);
    }
    return filePath;
};

/**
 *
 * @param {String} urlPathname
 * @return {String}
 */
ProtostarRuntime.prototype.resolveUrlPathnameToProjectFile = function(urlPathname){
    return this.constructProjectPath(urlPathname.substring(1));
};

/**
 *
 * @return {Object.<String, String>}
 */
ProtostarRuntime.prototype.createNamedPathsPathMap = function(){
    var map =  {};
    if(this.isNamedPathsEnabled()){
        this.namedPathsArray.forEach(function(np){
            map[np.path] = np.name;
        });
    }
    return map;
};

ProtostarRuntime.prototype.determineProtostarAttributeValue = function(attrName, attrValue, prefix){
    var origVal = attrValue;
    var val = origVal.substring(3);
    logger.info("Processing : " + val);
    var newVal;
    if(val.indexOf('./') !== 0 && val.indexOf('../') !== 0){
        if (val.indexOf("/ps/") === 0) {
            newVal = val;
        } else if (val.charAt(0) !== '.' && val.charAt(0) !== '/') {
            var dirName = val.substring(0, val.indexOf('/'));
            var namedPathUrl = this.resolveNamedPathUrl(dirName);
            newVal = namedPathUrl + val.substring(val.indexOf('/'));
        }else {
            newVal = val;
        }
        logger.info("Encoded ps:attr " + origVal + " -> " + newVal);
        var pf = "";
        if(typeof prefix === 'string'){
            pf = prefix;
        }
        newVal = pf + newVal;
    }else{
        throw new Error("Relative link in ps: attribute : "+ attrName + "='" + attrValue +"' with optional prefix=" + prefix);
    }
    return newVal;
};

module.exports = {
    ProtostarRuntime:ProtostarRuntime

};
