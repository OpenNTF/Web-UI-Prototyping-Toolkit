'use strict';
const utils = require("./utils");
const logger = utils.createLogger({sourceFilePath : __filename});
const path = require("path");
const fs = require("fs");

class NamedPathsConfig{
    /**
     *
     * @param {CachedTextFile} configReader
     */
    constructor(configReader){
        this.configReader = configReader;
        if(!this.configReader) throw new Error("missing config reader");
        this.namedPathsConfig = {};
        this.namedPathsArray = [];
        this.namedPathsPathMap = {};
        this.namedPathsUrlMap = {};
    }
    /**
     * @return {boolean}
     */
    isNamedPathsEnabled() {
        let cfg = this.readConfig();
        //this.projectConfig;
        return cfg.hasOwnProperty('project') && cfg.project.hasOwnProperty('namedPaths') && typeof cfg.project["namedPaths"] === 'object';
    }
    readConfig(){
        var cfgt  = this.configReader.read();
        let cfg;
        if(cfgt){
            cfg = JSON.parse(cfgt);
        }else{
            cfg = {};
        }
        return cfg;
    }

    /**
     *
     * @return {Object.<String, {path: String, url: String}>}
     */
    getNamedPathsConfigObject() {
        if(this.isNamedPathsEnabled()){
            return this.readConfig().project["namedPaths"];
        } else {
            logger.info("There are no named paths. config=", this.readConfig());
            return {};
        }
    }

    /**
     *
     * @param {{path:String,url:String}} namedPath
     * @param {String} name
     * @return {{name:String, path:String,url:String}}
     */
    initNamedPath(namedPath, name) {
        namedPath.name = name;
        if(!utils.hasPropertyOfType(namedPath, "url", "String") || !utils.hasPropertyOfType(namedPath, "path", "String")){
            logger.error("Invalid named path:", namedPath);
            throw new Error("Named path " + name + " is missing url and/or path fields");
        }
        const thePath = namedPath.path.split('/').join(path.sep);
        if (thePath.indexOf(path.sep) !== 0 && thePath.indexOf(':\\') !== 1) {
            namedPath.path = path.normalize(this.projectDirPath + path.sep + thePath);
        }
        console.log("inited named path = ", namedPath);
        return namedPath;
    }

    getNamedPathConfigsArray() {
        const paths = [];
        for (let nm in this.namedPathsConfig) {
            if (utils.hasPropertyOfType(this.namedPathsConfig, nm, "Object")) {
                const namedPath = this.namedPathsConfig[nm];
                paths.push(this.initNamedPath(namedPath, nm));
            }
        }
        this.validateNamedPaths(paths);
        return paths;
    }

    /**
     *
     * @param {String} name
     * @return {String}
     */
    resolveNamedPathUrl(name) {
        return this.getNamedPath(name).url;
    }

    /**
     *
     * @param {String} name
     * @return {{path: String, url: String}}
     */
    getNamedPath(name ) {
        const cfg = this.readConfig();
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
    }

    validateNamedPaths(namedPaths) {
        namedPaths.forEach(function(namedPath){
            if(!fs.existsSync(namedPath.path)){
                logger.error("Named path doesn't exist : ", namedPath.path);
                throw new Error("Named path " + namedPath.name + " doesn't exist, check prototype.json ");
            }
        });
    }

    isNamedPathName(name) {
        return this.namedPathsConfig.hasOwnProperty(name);
    }

    extractNamedPathUrlChild(url) {
        const paths = this.namedPathsArray;
        let found = false;
        paths.forEach(function (np) {
            if (url === np.url || url.indexOf(np.url) === 0) {
                found = np;
            }
        });
        return found;
    }

    /**
     *
     * @param {String} fullPath
     * @return {boolean}
     */
    isNamedPathChild(fullPath) {
        const paths = this.namedPathsArray;
        let found = false;
        if(paths){
            paths.forEach(function (np) {
                if (fullPath.indexOf(np.path) === 0) {
                    found = true;
                }
            });
        }
        return found;
    }

    /**
     *
     * @param {String} urlPathname
     * @return {boolean}
     */
    isNamedPathUrlPathname(urlPathname) {
        let found = false;
        if(urlPathname.length >= 2){
            const secSlash = urlPathname.indexOf("/", 1);
            const npUrlPotential = urlPathname.substring(0, secSlash);
            if(this.namedPathsUrlMap && this.namedPathsUrlMap.hasOwnProperty(npUrlPotential)){
                found = true;
            }else{
                    logger.debug("No entry in named paths url map for "+ npUrlPotential);
            }
        }
        return found;
    }

    extractNamedPath(fullPath) {
        const paths = this.namedPathsArray;
        let namedPath = false;
        paths.forEach(function (np) {
            if (fullPath.indexOf(np.path) === 0) {
                namedPath = np;
            }
        });
        return namedPath;
    }

    /**
     *
     * @return {Object.<String,String>}
     */
    createNamedPathsUrlMap() {
        const map = {};
        if(this.isNamedPathsEnabled()){
            this.namedPathsArray.forEach(function(np){
                map[np.url] = np.name;
            });
        }
        return map;
    }

    /**
     *
     * @param {String} urlPathname
     * @return {String}
     */
    resolveUrlPathnameToNamedPathName(urlPathname) {
        let name = false;
        if(urlPathname.length >= 2){
            const secSlash = urlPathname.indexOf("/", 1);
            if(secSlash > 0){
                const namedPathUrl = urlPathname.substring(0, secSlash);
                if(this.namedPathsUrlMap.hasOwnProperty(namedPathUrl)){
                    const namedPathName = this.namedPathsUrlMap[namedPathUrl];
                    name = namedPathName;
                }
            }
        }
        if(name === false){
            throw new Error("Could not construct named path filepath for urlpathname " + urlPathname);
        }
        return name;
    }

    /**
     *
     * @param {String} urlPathname
     * @return {String|boolean}
     */
    resolveUrlPathnameToNamedPathFile(urlPathname) {
        let filePath = false;
        if(urlPathname.length >= 2){
            const secSlash = urlPathname.indexOf("/", 1);
            if(secSlash > 0){
                const namedPathUrl = urlPathname.substring(0, secSlash);
                if(this.namedPathsUrlMap.hasOwnProperty(namedPathUrl)){
                    const namedPathName = this.namedPathsUrlMap[namedPathUrl];
                    const np = this.getNamedPath(namedPathName).path;
                    filePath =  np + urlPathname.substring(namedPathUrl.length);
                }
            }
        }
        if(filePath.indexOf('c:',1)>0){
            throw new Error("Illegal path: " + filePath);
        }
        return filePath;
    }



    /**
     *
     * @return {Object.<String, String>}
     */
    createNamedPathsPathMap() {
        const map = {};
        if(this.isNamedPathsEnabled()){
            this.namedPathsArray.forEach(function(np){
                map[np.path] = np.name;
            });
        }
        return map;
    }
}

module.exports = NamedPathsConfig;