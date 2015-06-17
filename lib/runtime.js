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
var jadeUtils = require("./jadeUtils");
var wrench = require("wrench");
var logger = utils.createLogger({sourceFilePath : __filename});
/**
 * Encapsulates access based on runtime information for Protostar such as
 * install dir, active project, ..
 * Example arguments:{
 *   workingDirPath: '/home/spectre',
 *   fullCommandLineArgs: process.argv
 * }
 * These are passed in to facilitate testing
 * @param args should contain workingDirPath and fullCommandLineArgs
 * @constructor
 */
function ProtostarRuntime(args){
    var instance = this;
    this.parseArgs = function(args){
        if(!utils.isString(args.workingDir)){
            throw new Error("Illegal workingDirPath arg: " + args.workingDir);
        }
        if(!utils.isArray(args.args) || args.args.length < 2){
            throw new Error("Illegal fullCommandLineArgs arg, should be array of length 2 at least (like process.argv): " + args.fullCommandLineArgs);
        }
        this.lenient = true;
        this.cachingEnabled = false;
        this.debug = true;
        this.strict = true;
        if(utils.hasPropertyOfType(args, "debug", "Boolean")){
            this.debug = args.debug;
        }
        if(utils.hasPropertyOfType(args, "strict", "Boolean")){
            this.strict = args.strict;
        }
        this.workingDirPath = args.workingDir;
        this.fullCommandLineArgs = args.args;
        this.nodeCommandPath = path.normalize(this.fullCommandLineArgs[0]);
        logger.info("node path = " + this.nodeCommandPath);

        this.protostarScriptPath = path.normalize(this.fullCommandLineArgs[1]);
        logger.info("protostar script path = " + this.protostarScriptPath);
        this.protostarDirPath  = path.join(__dirname, "..");
        this.defaultConfigPath = path.join(this.protostarDirPath, "core", "config", "defaults.json");
        this.configPath = path.join(this.protostarDirPath, "core", "config", "config.json");
        this.cmdLineArgs = this.fullCommandLineArgs.slice(2);
        this.port = (process.env.VCAP_APP_PORT || 8888);
        this.projectConfigFilename = args.projectConfig || 'prototype.json';

        this.parseCommandLineArgs();
        if(this.mode !== 'create'){
            this.validatePaths();
        }
        if(this.projectDirPath){
            this.projectConfigPath = path.join(this.projectDirPath, this.projectConfigFilename);
            this.userConfig = this.readUserConfig();
            this.projectConfig = this.readProjectConfig();
            this.namedPathsConfig = this.getNamedPathsConfigObject();
            this.namedPathsArray = this.getNamedPathConfigsArray();
            this.namedPathsPathMap = this.createNamedPathsPathMap();
            this.namedPathsUrlMap = this.createNamedPathsUrlMap();
            if(this.debug){
                logger.info("Instantiated ProtostarRuntime: ", this);
            }
        }
    };

    this.getNodeCommandPath = function(){
        return this.nodeCommandPath;
    };

    this.getPort = function(){
        return this.port;
    };

    this.isExistingPath = function(fullPath){
        return fs.existsSync(fullPath);
    };

    this.isExistingFilePath = function(fullFilePath){
        return this.isExistingPath(fullFilePath) && fs.statSync(fullFilePath).isFile();
    };

    this.isExistingDirPath = function(fullDirPath){
        return this.isExistingPath(fullDirPath) && fs.statSync(fullDirPath).isDirectory();
    };

    this.isExistingProjectFilePath = function(partsArray){
        var pf = this.constructProjectPath(partsArray);
        return this.isExistingPath(pf) && fs.statSync(pf).isFile();
    };
    this.isAppPath = function(fullPath){
        return fullPath.indexOf(this.protostarDirPath) === 0;
    };
    this.isProjectPath = function(fullPath){
        return fullPath.indexOf(this.projectDirPath) === 0;
    };

    this.isProjectFileUrlPathname = function(urlPathName){
        return this.isProjectPath(this.projectDirPath + urlPathName);
    };

    this.createTemplateReferenceFromFullPath = function (fullProjectPath) {
        if (this.isAppPath(fullProjectPath)) {
            return this.toRelativeAppPath(fullProjectPath).substring(1);
        } else if (this.isProjectPath(fullProjectPath)) {
            return this.toRelativeProjectPath(fullProjectPath);//.substring(1);
        } else {
            throw new Error("Unmapped path type for toRelative: " + fullProjectPath);
        }
    };

    this.createHtmlFileDisplayName = function(fullPath){
        var fileUrl = this.createUrlPathForFile(fullPath);
        var displayPath = fileUrl.substring(1, fileUrl.lastIndexOf('.'));
        if (displayPath.length > 6 && displayPath.substring(displayPath.length - 6) === '/index') {
            displayPath = displayPath.substring(0, displayPath.length - 6);
        }
        return displayPath;
    };

    this.createUrlPathForFile = function (fullPath) {
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
        return fileUrl;
    };


    this.isExistingProjectDirPath = function(partsArray){
        var pf = this.constructProjectPath(partsArray);
        return this.isExistingDirPath(pf);
    };
    this.isExistingAppFilePath = function(partsArray){
        var pf = this.constructAppPath(partsArray);
        return this.isExistingFilePath(pf);
    };
    this.isExistingAppDirPath = function(partsArray){
        var pf = this.constructAppPath(partsArray);
        return this.isExistingDirPath(pf);
    };
    this.isExistingAppPath = function(partsArray){
        var pf = this.constructAppPath(partsArray);
        return this.isExistingPath(pf);
    };

    this.isExistingProjectPath = function(partsArray){
        var pf = this.constructProjectPath(partsArray);
        return this.isExistingPath(pf);
    };

    var readCache = {
        pathStamps : {

        },
        pathContents: {

        }
    };

    this.clearReadCache = function(){
        for(var p in readCache.pathStamps){
            delete readCache.pathStamps[p];
        }
        for(var cp in readCache.pathContents){
            delete readCache.pathContents[cp];
        }
    };


    this.readFile = function(fullPath){
        var st = this.statFile(fullPath);
        var maxCachedFileSize = 1024*1024; // 1MB
        if(st.size > maxCachedFileSize){
            logger.warn("File is too large to cache: " + fullPath);
            return utils.readTextFileSync(fullPath);
        }
        var now = "" + st.mtime.getTime();
        if(!readCache.pathStamps.hasOwnProperty(fullPath) || readCache.pathStamps[fullPath] !== now){
            logger.debug("READ " + fullPath);
            readCache.pathStamps[fullPath] = now;
            readCache.pathContents[fullPath] = utils.readTextFileSync(fullPath);
            return readCache.pathContents[fullPath];
        }else{
            return readCache.pathContents[fullPath];
        }
    };

    this.writeFile = function(fullPath, contents, options){
        utils.writeFile(fullPath, contents, options);
    };
    this.deleteFile = function(fullPath){
        fs.unlinkSync(fullPath);
    };

    this.mkdir = function(dirPath){
        fs.mkdirSync(dirPath);
    };

    this.mkdirs = function(fullDirPath){
        var created = false;
        if (!this.isExistingDirPath(fullDirPath)) {
            wrench.mkdirSyncRecursive(fullDirPath);
            created = true;
        }
        return created;
    };
    this.writeFileCreatingParents = function(fullPath, contents, options){
        this.mkdirs(path.dirname(fullPath));
        this.writeFile(fullPath, contents, options);
    };
    this.isProjectConfigPresent = function(){
        return this.isExistingFilePath(this.projectConfigPath);
    };
    this.readProjectConfig = function () {
        if (this.isProjectConfigPresent()) {
            var projectConfig = JSON.parse(this.readFile(this.projectConfigPath));
            logger.debug("Read projectConfig from "+this.projectConfigPath);
            return   projectConfig;
        } else {
            logger.debug("There is no project config at " + this.projectConfigPath);
            return {};
        }
    };

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
        if(instance.isDebug()){
            logger.info('constructed: ' + constructed);
        }
        return constructed;

    };

    this.readProjectFile = function(partsArray){
        return this.readFile(this.constructProjectPath(partsArray));
    };
    this.readAppFile = function(partsArray){
        var fullPath = this.constructAppPath(partsArray);
        return this.readFile(fullPath);
    };

    this.statPath = function(fullFilePath){
        return fs.statSync(fullFilePath);
    };
    this.statFile = this.statPath;
    this.statDir = this.statPath;

    this.listProjectDir = function(){
        return this.listDir(this.constructProjectPath(arguments));
    };
    this.listDir = function(dirFullPath){
        return fs.readdirSync(dirFullPath);
    };
    this.listAppDir = function(partsArray){
        return this.listDir(this.constructAppPath(partsArray));
    };

    this.constructAppPath = function(partsArray){
        return constructChildPath(this.protostarDirPath, partsArray);
    };
    this.constructProjectPath = function(partsArray){
        return constructChildPath(this.projectDirPath, partsArray);
    };

    this.getInfo = function(){
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

    this.isDebug = function(){
        return this.debug;
    };

    this.isStrict = function(){
        return this.strict;
    };


    this.parseCommandLineArgs = function(){
        //todo: modes workspace,prodserver,..
        var cmdArgs = this.cmdLineArgs;
        var argCount = cmdArgs.length;

        var firstArg = cmdArgs[0];
        switch (firstArg){
            case 'help':
                this.mode = 'help';
                logger.info('Usage: protostar <command> <args>\n' +
                    'Following commands are available:\n' +
                    'protostar help                                    Displays this help\n' +
                    'protostar dev <projectDir>                        Starts the Protostar development environment with the project directory at <projectDir>\n' +
                    'protostar build <projectDir> <targetDir>          Creates a prebuilt version of the project located at directory <projectDir> at given <targetDir>\n' +
                    'protostar create <templateName> <newProjectDir>   Creates a new project directory at <newProjectDir> using passed <templateName>');
                break;
            case 'create':
                this.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
                this.mode = 'create';
                this.projectTemplate = 'default';
                if(cmdArgs.length > 2){
                    this.projectTemplate = cmdArgs[2];
                }
                break;
            case 'dev':
            case 'prod':
                this.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
                this.mode = "devserver";
                if(argCount === 3){
                    var portArg = cmdArgs[2];

                    if (parseInt(portArg, 10) == portArg) {
                        this.port = parseInt(portArg, 10);
                        logger.info("Setting port to " + config.port);
                    }else{
                        throw new Error("Illegal port argument provided; try 'protostar <projectDir> <portnumber>' or 'protostar <projectDir>' port passed:" + portArg);
                    }
                }
                break;
            case 'build':
                this.mode = "build";
                this.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
                this.targetDirPath = utils.normalizePathCmdLine(cmdArgs[2]);
                break;
            default:
           // old way of invoking
                        if(argCount === 3){
            if(cmdArgs[0] ==='build'){
                this.mode = "build";
                this.projectDirPath = utils.normalizePathCmdLine(cmdArgs[1]);
                this.targetDirPath = utils.normalizePathCmdLine(cmdArgs[2]);
            }
        }else if(argCount === 1 || argCount === 2){
            this.projectDirPath = utils.normalizePathCmdLine(cmdArgs[0]);
            this.mode = "devserver";
            if(argCount === 2){
                var portArg = cmdArgs[1];

                if (parseInt(portArg, 10) == portArg) {
                    this.port = parseInt(portArg, 10);
                    logger.info("Setting port to " + config.port);
                }else{
                    throw new Error("Illegal port argument provided; try 'protostar <projectDir> <portnumber>' or 'protostar <projectDir>' port passed:" + portArg);
                }
            }
        }else{
            throw new Error("Please launch protostar properly: 'protostar <projectDir>' or 'protostar <projectDir> <port>'");

        }

//                throw new Error("Uknown command: " + firstArg);
        }
        this.launchServer = this.mode === 'devserver';
    };
    this.getRuntimeMode = function(){
        return this.mode;
    };
    this.validatePaths = function(){
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

    this.readDefaultConfigText = function(){
        return "" + this.readFile(this.defaultConfigPath);
    };
    this.readUserConfigText = function(){
        return "" + this.readFile(this.configPath);
    };

    this.userConfigExists = function(){
        return this.isExistingFilePath(this.configPath);
    };

    this.readUserConfig = function(){
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
     * @param fullPath
     * @param basePath
     * @returns {string}
     */
    this.toRelativePath = function (fullPath, basePath) {
        if (!utils.isString(fullPath)) {
            throw new Error("Invalid non-string fullPath: " + fullPath);
        }
        if (!utils.isString(basePath)) {
            throw new Error("Invalid non-string basePath: " + basePath);
        }
        var relative = fullPath.substring(basePath.length).substring(1);
        return   relative;
    };
    this.toRelativeProjectPath = function (fullPath) {
        if(!this.isProjectPath(fullPath)){
            throw new Error("Not a project path: " + fullPath);
        }
        return this.toRelativePath(fullPath, this.projectDirPath);
    };
    this.toRelativeAppPath = function (fullPath) {
        if(!this.isAppPath(fullPath)){
            throw new Error("Not an app path: " + fullPath);
        }
        return this.toRelativePath(fullPath, this.protostarDirPath);
    };

    this.isInternalBowerDepUrlPathname = function(urlPathName){
        return urlPathName.indexOf("/ps/ext/") === 0;
    };
    this.isInternalNodeDepUrlPathname = function(urlPathName){
        return urlPathName.indexOf("/ps/nm/") === 0;
    };
    this.isInternalUrlPathname = function(urlPathName){
        return urlPathName.indexOf("/ps/") === 0;
    };


    this.findFileForUrlPathname = function (urlPartName) {
        var filePath = false;
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
        return filePath;
    };

    this.getTargetDirPath = function(){
        return this.targetDirPath;
    };

    this.resolveFilePathForPlaceHolder = function(placeholder){
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
//        if(!filePath && this.isInternalAssetUrlPathname(phName)){
//            filePath = this.constructAppPath(["core", phName.substring(4) + ext]);
//        }
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
                }else{
                    logger.error("File for placeholder doesn't exists: " + filePath, placeholder);
                    console.trace("File for placeholder doesn't exists: " + filePath);
                    throw new Error("File for placeholder doesn't exists: " + filePath);
                }
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

    this.isNamedPathsEnabled = function(){
        return this.projectConfig.hasOwnProperty('project') && this.projectConfig.project.hasOwnProperty('namedPaths') && typeof this.projectConfig.project.namedPaths === 'object';
    };

    this.getNamedPathsConfigObject = function(){
        if(this.isNamedPathsEnabled()){
            return this.projectConfig.project.namedPaths;
        } else {
            logger.info("There are no named paths. config=", this.projectConfig);
            return {};
        }
    };

    this.initNamedPath = function(namedPath, name){
        namedPath.name = name;
        if(!utils.hasPropertyOfType(namedPath, "url", "String") || !utils.hasPropertyOfType(namedPath, "path", "String")){
            logger.error("Invalid named path:", namedPath);
            throw new Error("Named path " + name + " is missing url and/or path fields");
        }
        var thePath = namedPath.path;
        if (thePath.indexOf('/') !== 0) {
            namedPath.path = path.normalize(this.projectDirPath + "/" + thePath);
        }
        return namedPath;
    };

    this.getNamedPathConfigsArray = function () {
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

    this.resolveNamedPathUrl = function (name) {
        return this.getNamedPath(name).url;
    };

    this.getNamedPath = function (name ) {
        var cfg = this.projectConfig;
        if (utils.nestedPathExists(cfg, "project", "namedPaths", name)) {
            if (cfg.project.namedPaths.hasOwnProperty(name)) {
                return this.initNamedPath(cfg.project.namedPaths[name], name);
            } else {
                logger.info("There is no such named path : " + name + "  config=", cfg);
                throw new Error("Not a named path: " + name);
            }
        } else {
            logger.info("Not a named path : " + name + "  config=", cfg);
            throw new Error("Not a named path: " + name);
        }
    };
    this.validateNamedPaths = function(namedPaths){
        namedPaths.forEach(function(namedPath){
            if(!fs.existsSync(namedPath.path)){
                logger.error("Named path doesn't exist : ", namedPath.path);
                throw new Error("Named path " + namedPath.name + " doesn't exist, check prototype.json ");
            }
        })
    };
    this.isNamedPathName = function (name) {
        return  this.namedPathsConfig.hasOwnProperty(name);
    };

    this.extractNamedPathUrlChild = function (url) {
        var paths = this.namedPathsArray;
        var found = false;
        paths.forEach(function (np) {
            if (url === np.url || url.indexOf(np.url) === 0) {
                found = np;
            }
        });
        return found;
    };

    this.isNamedPathChild = function (fullPath) {
        var paths = this.namedPathsArray;
        var found = false;
        paths.forEach(function (np) {
            if (fullPath.indexOf(np.path) === 0) {
                found = true;
            }
        });
        return found;
    };

    this.isNamedPathUrlPathname = function (urlPathname) {
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

    this.extractNamedPath = function (fullPath) {
        var paths = this.namedPathsArray;
        var namedPath = false;
        paths.forEach(function (np) {
            if (fullPath.indexOf(np.path) === 0) {
                namedPath = np;
            }
        });
        return namedPath;
    };

    this.createNamedPathsUrlMap = function(){
        var map =  {};
        if(this.isNamedPathsEnabled()){
            this.namedPathsArray.forEach(function(np){
                map[np.url] = np.name;
            });
        }
        return map;
    };

    this.resolveUrlPathnameToNamedPathName = function(urlPathname){
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

    this.resolveUrlPathnameToNamedPathFile = function(urlPathname){
        var filePath = false;
        if(urlPathname.length >= 2){
            var secSlash = urlPathname.indexOf("/", 1);
            if(secSlash > 0){
                var namedPathUrl = urlPathname.substring(0, secSlash);
                if(this.namedPathsUrlMap.hasOwnProperty(namedPathUrl)){
                    var namedPathName = this.namedPathsUrlMap[namedPathUrl];

                    filePath = this.getNamedPath(namedPathName).path + urlPathname.substring(namedPathUrl.length);
                }
            }
        }
        return filePath;
    };

    this.resolveUrlPathnameToProjectFile = function(urlPathname){
        return this.constructProjectPath(urlPathname.substring(1));
    };

    this.createNamedPathsPathMap = function(){
        var map =  {};
        if(this.isNamedPathsEnabled()){
            this.namedPathsArray.forEach(function(np){
                map[np.path] = np.name;
            });
        }
        return map;
    };

    this.determineProtostarAttributeValue = function(attrName, attrValue, prefix){
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
    this.parseArgs(args);
}


module.exports = {
    /**
     * Creates a ProtostarRuntime instance
     *  * Example arguments:{
     *   workingDirPath: '/home/spectre',
     *   fullCommandLineArgs: process.argv
     * }
     * @returns {ProtostarRuntime}
     */
    createRuntime: function(args){
        return new ProtostarRuntime(args);
    }

};
