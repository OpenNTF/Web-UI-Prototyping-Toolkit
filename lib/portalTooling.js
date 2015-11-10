"use strict";
var path = require("path");
var fs = require("fs");
var http = require("http");
var copier = require("./copier");
var utils = require("./utils");
var protostarBuilder = require("./protostarBuilder");
var logger = utils.createLogger({sourceFilePath : __filename});

module.exports = {};
var portalTooling = module.exports;

var dxsyncRequiredConfigProperties = [
    "username",
    "password",
    "contenthandlerPath",
    "host",
    "secure",
    "port",
    "theme"
];

var scriptPortletRequiredConfigProperties = [
    "mainHtmlFile",
    "portalUser",
    "portalPassword",
    "scriptPortletServer",
    "virtualPortalID",
    "wcmContentID",
    "wcmContentTitle"
];

var portalConfigRequiredProperties = {
    "username": "string",
    "password": "string",
    "contextRoot": "string",
    "host": "string",
    "secure": "boolean",
    "port": "string"
};

/**
 *
 * @param {Object.<String,Object.<String,String|boolean>>} arg
 * @constructor
 */
portalTooling.PortalConfig = function(arg){
    /**
     * @type String
     */
    this.host = arg.host;
    /**
     * @type String
     */
    this.port = arg.port;
    /**
     * @type String
     */
    this.contextRoot = arg.contextRoot;
    /**
     * @type String
     */
    this.virtualPortalContext = arg.virtualPortalContext;
    /**
     * @type boolean
     */
    if(!arg.hasOwnProperty("secure")){
        arg.secure = false;
    }else{
        this.secure = arg.secure;
    }
    /**
     * @type String
     */
    this.username = arg.username;
    /**
     * @type String
     */
    this.password = arg.password;

    /**
     * @type String
     */
    this.listScriptPortletsUrlPathname = arg.listScriptPortletsUrlPathname;

    /**
     * @type String
     */
    this.virtualPortalInfoUrlPathname = arg.virtualPortalInfoUrlPathname;
};

/**
 *
 * @param {String} themeDirName
 * @return {{}}
 */
portalTooling.PortalConfig.prototype.createThemeSyncConfig = function(themeDirName){
    var o ={};
    for(var k  in this){
        o[k] = this[k];
    }
    o.contenthandlerPath = this.contextRoot + '/mycontenthandler';
    o.theme = themeDirName;
    o.password = utils.encryptDXSync(o.password);
    return o;
};

/**
 *
 * @param {String} wcmContentID
 * @param {String} virtualPortalID
 * @param {String} wcmContentTitle
 * @param {String} mainHtmlFile
 * @return {{}}
 */
portalTooling.PortalConfig.prototype.createScriptPortletSyncConfig = function(wcmContentID, virtualPortalID, wcmContentTitle, mainHtmlFile){
    var o = {};
    o.portalUser = this.username;
    o.portalPassword = this.password;
    o.scriptPortletServer = (this.secure ? 'https' : 'http') + ':\/\/' + this.host + ":" + this.port;
    o.virtualPortalID = virtualPortalID;
    o.wcmContentID = wcmContentID;
    o.wcmContentTitle = wcmContentTitle;
    o.mainHtmlFile = mainHtmlFile;
    return o;
};

/**
 *
 * @param {String} dirPath
 * @return {{ok: boolean, messages: String[], missingFields: String[], dir: String}}
 */
portalTooling.validateScriptPortletDirSettings = function(dirPath){
    var messages = [];
    var missing = [];
    var spConfigPath = path.resolve(dirPath, "sp-config.json");
    if (fs.existsSync(spConfigPath)) {
        var spConfig = JSON.parse(fs.readFileSync(spConfigPath, "utf8"));
        scriptPortletRequiredConfigProperties.forEach(function (a) {
            if (!spConfig.hasOwnProperty(a) || typeof spConfig[a] !== 'string') {
                missing.push(a);
            }
        });
        if (missing.length > 0) {
            messages.push("Script Portlet push : missing required string properties in sp-config.json file at " + spConfigPath + " : " + missing.join(', '));
        }
    } else {
        var msg = "Script Portlet push : there is no sp-config.json file at " + spConfigPath;
        messages.push(msg);
    }
    return {
        ok : messages.length < 1,
        messages : messages,
        missingFields: missing,
        dir : dirPath
    };
};
/**
 *
 * @param {String} dirPath
 * @return {{ok: boolean, messages: String[], missingFields: String[], dir: String}}
 */
portalTooling.validateThemeSyncDirSettings = function(dirPath){
    var dxsCfgPath = path.resolve(dirPath, ".settings");
    var missingFields = [];
    var messages = [];
    if(fs.existsSync(dxsCfgPath)){
        var dxsCfg = JSON.parse(fs.readFileSync(dxsCfgPath, "utf8"));
        dxsyncRequiredConfigProperties.forEach(function(field){
                if(!dxsCfg.hasOwnProperty(field) || (typeof dxsCfg[field]!== 'string' && typeof dxsCfg[field] !== 'boolean') || dxsCfg[field].length < 1){
                    missingFields.push(field);
                }
            });
        if(missingFields.length > 0){
            var msg = "Missing config properties on " + dxsCfgPath + ": " + missingFields.join(", ");
            messages.push(msg);
        }
    }else{
        messages.push("There is not settings file at " + dxsCfgPath);
    }
    return {
        ok : messages.length <1,
        messages : messages,
        missingFields: missingFields,
        dir : dirPath
    };
};
/**
 *
 * @param {String} dxSyncDir
 * @param {String} cmd
 * @param {String} dxsyncPath
 * @param {Function} cb
 */
var runDxSyncCommand = function(dxSyncDir, cmd, dxsyncPath, cb){
    var dirVal = portalTooling.validateThemeSyncDirSettings(dxSyncDir);
    if(!dirVal.ok){
        console.error("Dir with invalid theme sync config passed: " + dxSyncDir, dirVal);
        cb(dirVal, dxSyncDir);
        return;
    }
    var env = process.env;
    env.PATH += ":" + path.dirname(process.argv[0]);
    var exec = require('child_process').exec;
    var command = dxsyncPath + " " + cmd;
    console.log("Running " + command + " from dir " + dxSyncDir + "...");
    exec(command, {
        cwd: dxSyncDir
    }, function(error, stdout, stderr) {
        console.log("ran "+cmd+" command : " + command);
        console.log("stdout: " + stdout);
        console.log("stderr: " + stderr);
        if(error){
            console.error("Failed! ", error);
            cb(error, dxSyncDir, stdout, stderr);
        }else{
            console.info("Success: " + stdout);
            cb(undefined, dxSyncDir, stdout, stderr);
        }
    });
};
/**
 *
 * @param {String} dxSyncDir
 * @param {String} dxsyncPath
 * @param {Function} cb
 */
portalTooling.pushThemeDirToWebDav = function(dxSyncDir, dxsyncPath, cb){
    runDxSyncCommand(dxSyncDir, 'push', dxsyncPath, cb);
};

/**
 *
 * @param {String} dxSyncDir
 * @param {String} dxsyncPath
 * @param {Function} cb
 */
portalTooling.pullThemeFromWebDavToDir = function(dxSyncDir, dxsyncPath, cb){
    runDxSyncCommand(dxSyncDir, 'pull', dxsyncPath, cb);
};

/**
 * Returns true if the project or user config have a portalConfig child object with required values filled
 *
 * @param {Project} project
 * @return {boolean}
 */
portalTooling.isDefaultPortalConfigured= function(project){
    var pocfg = portalTooling.getDefaultPortalConfig(project);
    var configured = true;
    for(var nm in portalConfigRequiredProperties){
        var keyType = portalConfigRequiredProperties[nm];
        if(!pocfg.hasOwnProperty(nm) || typeof pocfg[nm] !== keyType || (keyType === 'string' && pocfg[nm].trim().length < 1)){
            configured = false;
        }
    }
    return configured;
};

/**
 * Returns the default portal config determined by checking
 * - portalConfig in config.json for protostar
 * - augmenting/overriding with portalConfig in prototype.json for the active project
 * @param {Project} project
 * @return {portalTooling.PortalConfig}
 */
portalTooling.getDefaultPortalConfig = function(project){
    var cfg = project.runtime.readUserConfig();
    var pocfg;
    if(cfg.hasOwnProperty("portalConfig")){
        pocfg = cfg.portalConfig;
    }else{
        pocfg = {};
    }
    var projectCfg = project.runtime.readProjectConfig();
    if(projectCfg.hasOwnProperty("portalConfig")){
        var ocfg = projectCfg.portalConfig;
        for(var pn in ocfg){
            pocfg[pn] = ocfg[pn];
        }
    }
    return new (portalTooling.PortalConfig)(pocfg);
};

/**
 * @param {Project} project
 * @return {boolean}
 */
portalTooling.isDxSyncPathConfigured= function(project){
    var userCfg = project.runtime.readUserConfig();
    return userCfg.hasOwnProperty("dxSyncPath") && fs.existsSync(userCfg["dxSyncPath"]);
};

/**
 * @param {Project} project
 * @return {boolean}
 */
portalTooling.isScriptPortletPushPathConfigured= function(project){
    var userCfg = project.runtime.readUserConfig();
    return userCfg.hasOwnProperty("scriptPortletPushPath") && fs.existsSync(userCfg["scriptPortletPushPath"]);
};

/**
 *
 * @param {portalTooling.PortalConfig} portalConfig
 * @param {String} webdavPath
 * @return {String}
 */
portalTooling.createWebDavFilesZipDownloadURL= function(portalConfig, webdavPath){
    // http://omnius:10039/wps/mycontenthandler/dav/fs-type1/themes/bootstrapDemoTheme/?mime-type=application/zip
    var schema = portalConfig.secure ? 'https' : 'http';
    var port = portalConfig.port === '80' ? '' : ':' + portalConfig.port;
    var relPath = webdavPath.indexOf('/') === 0 ? webdavPath.substring(1) : webdavPath;
    if(relPath.charAt(relPath.length - 1) !== '/'){
        relPath = relPath + '/';
    }
    return schema + '://' + portalConfig.host + port + portalConfig.contextRoot + '/mycontenthandler/dav/fs-type1/' + relPath + '?mime-type=application/zip';
};

/**
 * @param {Project} project
 * @return {boolean}
 */
portalTooling.isThemeSyncDirConfigured = function(project){
    var pcfg = project.runtime.readProjectConfig();
    return pcfg.hasOwnProperty("dxSyncDir") && fs.existsSync(pcfg["dxSyncDir"]);
};

/**
 * @param {Project} project
 * @return String
 */
portalTooling.getThemeSyncDirPath = function(project){
    var pcfg = project.runtime.readProjectConfig();
    if(!pcfg.hasOwnProperty("dxSyncDir")){
        throw new Error("dxSyncDir path is not provided for project " + project.runtime.projectDirPath);
    }
    return pcfg["dxSyncDir"];
};

/**
 * @param {Project} project
 */
portalTooling.getDxSyncExecutablePath = function(project){
    var cfg = project.runtime.readUserConfig();
    if(!cfg.hasOwnProperty("dxSyncPath")){
        throw new Error("dxSyncPath path is not in config " + project.runtime.configPath);
    }
    return cfg["dxSyncPath"];
};

/**
 * @param {Project} project
 */
portalTooling.getScriptPortletPushExecutablePath = function(project){
    var cfg = project.runtime.readUserConfig();
    if(!cfg.hasOwnProperty("scriptPortletPushPath")){
        throw new Error("scriptPortletPushPath path is not in config " + project.runtime.configPath);
    }
    return cfg["scriptPortletPushPath"];
};

/**
 *
 * @param {String} dirPath
 * @return {Object.<String,Object.<String,String|boolean>>}
 */
portalTooling.getAllScriptPortletConfigs = function(dirPath){
    var spDirs = portalTooling.listProjectScriptPortletDirs(dirPath);
    var out = {};
    spDirs.forEach(function(spd){
        var spcp = path.resolve(spd, 'sp-config.json');
        var cfg = JSON.parse(fs.readFileSync(spcp, 'utf8'));
        out[spd] = cfg;
    });
    return out;
};

/**
 *
 * @param {String} dirPath
 * @return {String[]}
 */
portalTooling.listProjectScriptPortletDirs= function(dirPath){
    var out = [];
    var dirsWithSpConfigFiles = copier.listDirChildrenFullPathsRecursively(dirPath).filter(function(p){
        return path.basename(p) === 'sp-config.json';
    }).map(function(p){
        return path.dirname(p).substring(dirPath.length +1);
    });
    out = out.concat(dirsWithSpConfigFiles);
    out.sort();
    return out;
};

/**
 *
 * @param {portalTooling.PortalConfig} portalConfig
 * @param {Function} cb
 */
portalTooling.listRemoteScriptPortlets= function(portalConfig, cb){
    var apps = portalConfig.listScriptPortletsUrlPathname;
    var vpinfo = portalConfig.virtualPortalInfoUrlPathname;

    var appsInfo = false;
    var vpInfo = false;

    var checkDone = function(){
        if(typeof appsInfo !== 'boolean' && typeof vpInfo !== 'boolean'){
            if(typeof appsInfo === 'string' && typeof vpInfo === 'string'){
                console.log("Successfully retrieved remote portlets and vp info");
                if(cb){
                    cb(undefined, JSON.parse(appsInfo), JSON.parse(vpInfo), portalConfig);
                }
            }else{
                if(cb){
                    var err;
                    if(typeof appsInfo !== 'string'){
                        err = appsInfo;
                    }else{
                        err = vpInfo;
                    }
                    console.error("Failed to retrieve remote apps and/or vp info: ", err);
                    cb(err, appsInfo, vpInfo, portalConfig);
                }
            }
        }else{
            console.log("not yet done");
        }
    };

    var aOpts = {
        host: portalConfig.host,
        port: portalConfig.port,
        path: apps
    };
    console.log("Requesting: ", aOpts);
    var aReq = http.request(aOpts, function(resp){
        var all = '';
        resp.on('data', function(str){
            all += str;
        });
        resp.on('end', function(){
            console.log("apps info : ", all);
            appsInfo = all;
            checkDone();
        });

    });
    aReq.on('error', function(err){
        console.error("Failed to retrieve apps info from " + portalConfig, err);
        appsInfo = err;
        checkDone();
    });
    aReq.end();
    var vReq = http.request({
        host: portalConfig.host,
        port: portalConfig.port,
        path: vpinfo
    }, function(resp){
        var all = '';
        resp.on('data', function(str){
            all += str;
        });
        resp.on('end', function(){
            console.log("vp info : ", all);
            vpInfo = all;
            checkDone();
        });

    });
    vReq.on('error', function(err){
        console.error("Failed to retrieve vp info from " + portalConfig, err);
        vpInfo = err;
        checkDone();
    });
    vReq.end();
};


var runScriptPortletCommand = function(dirPath, command, spPath, cb){
    var valResult = portalTooling.validateScriptPortletDirSettings(dirPath);
    if(!valResult.ok){
        logger.error("Invalid script portlet dir config for " + dirPath, valResult);
        throw new Error("Invalid script portlet dir config for " + dirPath + ": " + valResult.messages.join(", "));
    }
    var exec = require('child_process').exec;
    var env = process.env;
    env.PATH += ":" + path.dirname(process.argv[0]);
    var cmd = spPath + " " + command;
    exec(cmd, {
        cwd: dirPath,
        env: env
    }, function(error, stdout, stderr) {
        console.log("ran command : " + cmd);
        console.log("stdout: " + stdout);
        console.log("stderr: " + stderr);
        var successful;
        if(error || (stdout+"").indexOf('Command was successful.  See the log for details') <0){
            console.error("Failed! ", error);
            successful = false;
        }else{
            console.info("Success: " + stdout);
            successful = true;
        }
        var logFilePath = path.resolve(dirPath, "sp-cmdln.log");
        var logFileContents = "";
        if(fs.existsSync(logFilePath)){
            logFileContents = utils.readTextFileSync(logFilePath, "utf8");
        }

        if(cb){
            if(successful){
                cb(undefined, dirPath, stdout, stderr, logFileContents);
            }else{
                cb(error, dirPath, stdout, stderr, logFileContents);
            }
        }
    });
};

/**
 *
 * @param {String} dirPath
 * @param {String} spPath
 * @param {Function} cb
 */
portalTooling.pushScriptPortletFromDir = function(dirPath, spPath, cb){
    runScriptPortletCommand(dirPath, "push", spPath, cb);
};

/**
 *
 * @param {String} host
 * @param {String} [port]
 * @param {String} [path]
 * @param {Function} cb
 */
portalTooling.isPortalRunning = function(host, port, path, cb){
    if(!port){
        port = "10039";
    }
    if(!path){
        path = "/wps/portal";
    }
    var server = host + port + path;
    console.log("Script portlet server = " + server);
    var req = http.request({
            host: host,
            port: port,
            path: path
    },function(resp){
        console.log("Something responded with status " + resp.status + " for " + server);
        if(cb){
            cb(true);
        }
    });
    req.on('error', function(){
        console.log("Not running: could not connect to " + server);
        if(cb){
            cb(false);
        }
    });
    req.end();
};

/**
 *
 * @param {String} dirPath
 * @param {Project} project
 * @param {Function} cb
 */
portalTooling.prepareScriptPortletPush = function(dirPath, targetDir, project, cb){
    var builder = protostarBuilder.createBuilder({
        runtime : project.runtime,
        project : project,
        composer :project.composer
    });
    var tmpDir = targetDir;
    builder.buildComponentDir(dirPath, tmpDir, function(err, builtToDir){
        if(err){
            console.error("Could not build " + dirPath + " to " + tmpDir, err.stack);
            cb(err, tmpDir);
        }else{
            console.info("Built subdir " + dirPath + " to " + builtToDir);
            cb(undefined, tmpDir);
        }
    });
};

portalTooling.pullScriptPortletToDir = function(wcmContentId, newDirPath, portalConfig, spPath, cb){
    if(fs.existsSync(newDirPath)){
        throw new Error("newDirPath must not exist: " + newDirPath);
    }
    if(!fs.existsSync(path.dirname(newDirPath))){
        throw new Error("parent of newDirPath must exist: " + newDirPath);
    }
    portalTooling.listRemoteScriptPortlets(portalConfig, function(err, appsInfo, vpInfo){
        if(err){
            cb(err);
        }else{
            console.log("ARGS = ", arguments);
            var defaultVp;
            var ctxVpMap = {};
            vpInfo.forEach(function(vp){
                if(vp.hostname === 'null' && vp.contextPath === 'null'){
                    defaultVp = vp;
                }else{
                    if(vp.contextPath !== 'null'){
                        ctxVpMap[vp.contextPath] = vp;
                    }else{
                        console.warn("Virtual Portal by hostname not supported, please file a bug at https://github.com/OpenNTF/Web-UI-Prototyping-Toolkit");
                    }
                }
            });
            var vpId;
            var theVp;
            if(typeof portalConfig.virtualPortalContext === 'string' && portalConfig.virtualPortalContext.length >= 2){
                if(!ctxVpMap.hasOwnProperty(portalConfig.virtualPortalContext)){
                    throw new Error("There is no vp for context path " + portalConfig.virtualPortalContext);
                }
                theVp = ctxVpMap[portalConfig.virtualPortalContext];
                vpId = ctxVpMap[portalConfig.virtualPortalContext].objectId;
            }else{
                vpId = defaultVp.objectId;
                theVp = defaultVp;
            }
            var firstQ = vpId.indexOf("'");
            var secQ = vpId.indexOf("'", firstQ+1);
            vpId = vpId.substring(firstQ+1, secQ);
            var theApp = appsInfo.filter(function(a){
                return a.id === wcmContentId;
            });
            if(theApp.length !== 1){
                throw new Error("No or multiple hits for wcmCOntentID = "  + wcmContentId);
            }
            theApp = theApp[0];
            var spConfig = portalConfig.createScriptPortletSyncConfig(wcmContentId, vpId, theApp.name, 'view.html');
            fs.mkdirSync(newDirPath);
            fs.writeFileSync(newDirPath + path.sep + "sp-config.json", JSON.stringify(spConfig), 'utf8');
            //var spPath = portalTooling.getScriptPortletPushExecutablePath(project);
            runScriptPortletCommand(newDirPath, "pull", spPath, function(err){
                if (!err) {
                    var spcPath = newDirPath + path.sep + "sp-config.json";
                    var writtenConfig = JSON.parse(fs.readFileSync(spcPath, 'utf8'));
                    writtenConfig.portalPassword = portalConfig.password;
                    fs.writeFileSync(spcPath, JSON.stringify(writtenConfig), 'utf8');
                }
                cb.apply(this, Array.prototype.slice.call(arguments));
            });
        }
    });
};
