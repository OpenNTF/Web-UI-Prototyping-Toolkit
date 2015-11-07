"use strict";
var path = require("path");
var fs = require("fs");
var http = require("http");
var copier = require("./copier");
var jadeUtils = require("./jadeUtils");
var blueBirdPromise = require("bluebird");
var lessCompiler = require("./lessCompiler");
var utils = require("./utils");

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
    if(messages.length > 0){
        return {
            ok : false,
            messages : messages,
            missingFields: missingFields,
            dir : dirPath
        };
    }else{
        return {
            ok: true,
            dir: dirPath
        };
    }
};

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

portalTooling.pushThemeDirToWebDav = function(dxSyncDir, dxsyncPath, cb){
    runDxSyncCommand(dxSyncDir, 'push', dxsyncPath, cb);
};

portalTooling.pullThemeFromWebDavToDir = function(dxSyncDir, dxsyncPath, cb){
    runDxSyncCommand(dxSyncDir, 'pull', dxsyncPath, cb);
};
/**
 *
 * @param {Project} project
 */
portalTooling.isDefaultPortalConfigured= function(project){

};

/**
 * @param {Project} project
 */
portalTooling.isDxSyncPathConfigured= function(project){
    var userCfg = project.runtime.readUserConfig();
    return userCfg.hasOwnProperty("dxSyncPath") && fs.existsSync(userCfg["dxSyncPath"]);
};



/**
 * @param {Project} project
 */
portalTooling.isScriptPortletPushPathConfigured= function(project){
    var userCfg = project.runtime.readUserConfig();
    return userCfg.hasOwnProperty("scriptPortletPushPath") && fs.existsSync(userCfg["scriptPortletPushPath"]);
};

portalTooling.createDownloadStaticThemeFilesFromWebDavURL= function(){

};

portalTooling.isProjectDefaultPortlalConfigured = function(){

};

/**
 * @param {Project} project
 */
portalTooling.isThemeSyncDirConfigured = function(project){
    var pcfg = project.runtime.readProjectConfig();
    return pcfg.hasOwnProperty("dxSyncDir") && fs.existsSync(pcfg["dxSyncDir"]);
};

/**
 * @param {Project} project
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


portalTooling.isScriptPortletPushConfigured = function(){

};

portalTooling.getWebDavThemePushConfig = function(){

};

portalTooling.getScriptPortletPushConfig = function(){

};

portalTooling.getAllScriptPortletConfigs = function(){

};

portalTooling.listProjectScriptPortletDirs= function(project){
    var out = [];
    if(portalTooling.isScriptPortletPushPathConfigured(project)){
        var projectDir = project.runtime.constructProjectPath("");
        var dirsWithSpConfigFiles = copier.listDirChildrenFullPathsRecursively(projectDir).filter(function(p){
            return path.basename(p) === 'sp-config.json';
        }).map(function(p){
            return path.dirname(p).substring(projectDir.length +1);
        });
        out = out.concat(dirsWithSpConfigFiles);
        out.sort();
    }
    return out;
};

portalTooling.listRemoteScriptPortlets= function(){

};

portalTooling.pullScriptPortletToDir = function(){

};

portalTooling.pushScriptPortletFromDir = function(dirPath, project, cb){
    var exec = require('child_process').exec;
    var env = process.env;
    env.PATH += ":" + path.dirname(project.runtime.nodeCommandPath);
    var command = portalTooling.getScriptPortletPushExecutablePath(project) + " push";
    exec(command, {
        cwd: dirPath,
        env: env
    }, function(error, stdout, stderr) {
        console.log("ran push command : " + command);
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
        var logFileContents = utils.readTextFileSync(logFilePath, "utf8");


        if(cb){
            if(successful){
                cb(undefined, dirPath, stdout, stderr, logFileContents);
            }else{
                cb(error, dirPath, stdout, stderr, logFileContents);
            }
        }
    });
};

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

function prepareComponentDir(cmpDir){
    //var that = this;
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
                lessPaths.push(p); // jshint ignore:line
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
        paths.splice(idx, 1);
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
        allReferenceables.forEach(function(refPath){
            var html = utils.readTextFileSync(htmlPath);
            html = html.replace(/contenteditable="true"/,"");
            try {
                var query = refPath + '"';
                var endIdx = html.indexOf(query);
                if (endIdx > 0) {
                    var attrName = path.extname(refPath) === ".js" ? "src" : "href";
                    var firstQuoteIdx = html.lastIndexOf('"', endIdx);
                    var closingQuote = html.indexOf('"', firstQuoteIdx + 1);
                    var toReplace = attrName + "=" + html.substring(firstQuoteIdx, closingQuote + 1);
                    var replacement = attrName + '="'+refPath+'"' ;
                    var outHtml = "" + html;
                    if(toReplace !== replacement){
                        var lastCritIdx = outHtml.lastIndexOf(toReplace);
                        while (lastCritIdx >= 0) {
                            var before = outHtml.substring(0, lastCritIdx);
                            var after = outHtml.substring(lastCritIdx + toReplace.length);
                            outHtml = before + replacement + after;
                            lastCritIdx = outHtml.lastIndexOf(toReplace);
                        }
                    }
                    if (html !== outHtml) {
                        outHtml = utils.beautifyHtml(outHtml);
                        utils.writeFile(htmlPath, outHtml);
                    }
                }
            } catch (e) {
                console.error("Error during processing " + cmpDir, e);
                throw e;
            }
        });
        var surroundAsFullHtmlDocForScriptPortlet = true;
        if(surroundAsFullHtmlDocForScriptPortlet){
            var newTxt = '<html><head></head><body>' + fs.readFileSync(htmlPath, 'utf8') + '</body></html>';
            fs.writeFileSync(htmlPath, newTxt, 'utf8');
        }
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
}

portalTooling.prepareScriptPortletPush = function(dirPath, project, cb){
    var componentFiles = copier.listDirChildrenFullPathsRecursively(dirPath);
    var tmpDir = "/tmp/psComponentPush";
    if(project.runtime.isExistingDirPath(tmpDir)){
        copier.deleteRecursively(tmpDir);
        copier.mkdirsSync(tmpDir);
    }
    copier.copy(dirPath, tmpDir);
    var htmlFiles = componentFiles.filter(function(p){
        return path.extname(p) === '.html';
    });
    var jadeFiles = componentFiles.filter(function(p){
        return path.extname(p) === '.jade';
    });
    var lessFiles = componentFiles.filter(function(p){
        return path.extname(p) === '.less';
    });
    jadeFiles.forEach(function(f){
        var compiledData = jadeUtils.jadeFileToHtmlFile(f);
        var htmlPath = compiledData.path;
        htmlFiles.push(htmlPath);
    });
    copier.copy(dirPath, tmpDir);
    htmlFiles.forEach(function(f){
        var compiledData = project.composer.composeTemplate(f, utils.readTextFileSync(f), 100);
        utils.writeFile(path.resolve(tmpDir, f.substring(dirPath.length+1)), compiledData.content.replace(/contenteditable="true"/g, ""));
    });
    function compileLessFile(lp){
        return new blueBirdPromise(function(resolve, reject){
            lessCompiler.compilePromise(lp, [path.dirname(lp)], utils.readTextFileSync(lp), path.dirname(lp)).done(function(css){
                var cssPath = lp.substring(dirPath.length+1);
                cssPath = cssPath.substring(0, cssPath.lastIndexOf('.'));
                cssPath += '.css';
                var thePath = path.resolve(tmpDir, cssPath);
                utils.writeFile(thePath, css.toString());
                console.log("Compiled " + lp + " to " + thePath);
                resolve();
            }, function(){
                console.log("Could not compile a component less path " + lp);
                resolve();
            });
        });
    }
    var lessPromises = [];
    lessFiles.forEach(function(lp){
        lessPromises.push(compileLessFile(lp));
    });
    blueBirdPromise.all(lessPromises).then(function(){
        console.log("Finished compiling to " + tmpDir);
        prepareComponentDir(tmpDir);
        cb(undefined, tmpDir);
    }, function(err){
        console.error("Failed to run less compiles it seems", arguments);
        cb(err, tmpDir);
    }).catch(function(err){
        console.error("Failed to run less compiles it seems", arguments);
        cb(err, tmpDir);
    });
};


