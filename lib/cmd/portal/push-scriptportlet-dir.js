"use strict";
var fs = require("fs");
var path = require("path");
var url = require("url");
var http = require("http");
var copier = require("fsops");
var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
var jadeUtils = require("../../jadeUtils");
var blueBirdPromise = require("bluebird");
var lessCompiler = require("../../lessCompiler");



/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var userCfg = rc.runtime.readUserConfig();
    if(!userCfg.hasOwnProperty("scriptPortletPushPath") || !rc.runtime.isExistingFilePath(userCfg["scriptPortletPushPath"])){
        var msg = "Script Portal push : missing property scriptPortletPushPath on " + rc.runtime.configPath + " or does not point to an existing file";
        console.error(msg);
        rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
        rc.response.end();
        return ;
    }
    var spCommandPath = rc.runtime.readUserConfig()["scriptPortletPushPath"];
    var start = new Date();
    var url_parts = url.parse(rc.request.url, true);
    var dir = url_parts.query.dir || false;
    if(!dir) {
        throw new Error("missing directory");
    }
    var projectDir = rc.runtime.constructProjectPath("");
    var dirPath = path.resolve(projectDir, dir);
    if(!rc.runtime.isExistingDirPath(dirPath)){
        throw new Error("Not an existing dir path for " + dir + ": " + dirPath);
    }
    var spConfigPath = path.resolve(dirPath, "sp-config.json");
    if(!fs.existsSync(spConfigPath)){
        var msg = "Script Portlet push : there is no sp-config.json file at " + spConfigPath;
        console.error(msg);
        rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
        rc.response.end();
        return ;
    }
    var spConfig = JSON.parse(fs.readFileSync(spConfigPath, "utf8"));
    var reqArgs = [
        "mainHtmlFile",
        "portalUser",
        "portalPassword",
        "scriptPortletServer",
        "virtualPortalID",
        "wcmContentID",
        "wcmContentTitle"
    ];
    var missing = [];
    reqArgs.forEach(function(a){
        if(!spConfig.hasOwnProperty(a) || typeof spConfig[a] !== 'string'){
            missing.push(a);
        }
    });
    if(missing.length > 0){
        var msg = "Script Portlet push : missing required string properties in sp-config.json file at " + spConfigPath + " : " + missing.join(', ');
        console.error(msg);
        rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
        rc.response.end();
        return ;
    }
    var spServer = spConfig["scriptPortletServer"];
    console.log("Script portlet server = " + spServer);
    var req = http.request({
        host: spServer.substring(spServer.indexOf("//")+2, spServer.lastIndexOf(":")),
        port: parseInt(spServer.substring(spServer.lastIndexOf(":")+1)),
        path: "/wps/portal"
    }, function(resp){
        console.log("Server " + spServer + " seems to be running (something seems to be responding something on that host and port :-)", resp);


        var componentFiles = copier.listDirChildrenFullPathsRecursively(dirPath);
        var tmpDir = "/tmp/psComponentPush";
        if(rc.runtime.isExistingDirPath(tmpDir)){
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
            var compiledData = rc.composer.composeTemplate(f, utils.readTextFileSync(f), 100);
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
            var exec = require('child_process').exec;
            var env = process.env;
            env.PATH += ":" + path.dirname(rc.runtime.nodeCommandPath);
            var command = spCommandPath + " push";
            exec(command, {
                cwd: tmpDir,
                env: env
            }, function(error, stdout, stderr) {
                console.log("ran push command : " + command);
                console.log("stdout: " + stdout);
                console.log("stderr: " + stderr);
                var opener;
                if(error || (stdout+"").indexOf('Command was successful.  See the log for details') <0){
                    console.error("Failed! ", error);
                    opener = "Failed to push";
                }else{
                    console.info("Success: " + stdout);
                    opener = "Successfully pushed";
                }
                var out =
                    '<div class="row"><div class="col-md-12">' +
                    '<h1>'+opener+' '+dir+' to portal on '+start+'</h1>' +
                    '<p><a class="btn btn-primary" href="/?command=push-scriptportlet-dir&dir='+dir+'">Push '+dir +' again</a></p>' +
                    '<h3>stdout</h3>'+
                    '<pre><code>'+stdout+'</code></pre>' +
                    '<h3>stderr</h3>'+
                    '<pre><code>'+stderr+'</code></pre>' +
                    '<h3>log</h3>'+
                    '<pre><code>'+utils.readTextFileSync(path.resolve(tmpDir, "sp-cmdln.log"))+'</code></pre>' +
                    '</div></div>';
                rc.project.deleteIntermediaryFiles();
                rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdList.html');
                rc.response.end();
            });

        }, function(){
            console.error("Failed to run less compiles it seems", arguments);
        }).catch(function(){
            console.error("Failed to run less compiles it seems", arguments);
        });

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
    });
    req.on('error', function(){
        var msg = "Script Portlet push : the scriptPortletServer defined in sp-config.json file at " + spConfigPath + " is not running : " + spConfig.scriptPortletServer;
        console.error(msg);
        rc.composer.renderBackendView(rc.request, rc.response, '<strong>'+msg+'</strong>', 'cmdList.html');
        rc.response.end();
    });
    req.end();
};
module.exports.label = 'Push Script Portlet';
module.exports.description = '';
module.exports.noMenu = true;