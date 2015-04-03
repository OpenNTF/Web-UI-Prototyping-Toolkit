"use strict";
var deferred = require("deferred");
var path= require("path");
var fs = require("./filesystem");
var utils = require("./utils");
var exec = require("child_process").exec;

var logger = utils.createLogger({sourceFilePath : __filename});

function BowerUtils(projectDir){
    this.isBowerJsonProvided = function(){
        return fs.existsSync(this.getBowerJsonPath());
    };

    this.isBowerRcProvided = function(){
        return fs.existsSync(this.getBowerRcPath());
    };

    this.getBowerRcPath = function(){

        return projectDir + path.sep + ".bowerrc";
    };

    this.getBowerJsonPath = function(){
        return projectDir + path.sep + "bower.json";
    };

    this.getBowerDirectoryPath = function(){
        var bdn = "bower_components";
        if(this.isBowerRcProvided()){
            var bowerRc = this.readBowerRc();
            if(bowerRc.hasOwnProperty("directory")){
                bdn = bowerRc.directory;
            }

        }
        return projectDir + path.sep + bdn;
    };

    this.readBowerRc = function(){
        return JSON.parse(fs.readFileSync(this.getBowerRcPath(), 'utf8'));
    };

    this.readBowerJson = function(){
        return JSON.parse(fs.readFileSync(this.getBowerJsonPath(), 'utf8'));
    };

    this.isBowerInstallNecessary= function(){
        return (function(projectDir){
            var def = deferred();
            var bowerJson = projectDir + path.sep + "bower.json";
            var bowerRC = projectDir + path.sep + ".bowerrc";

            function compareJsonDepsWithInstalled(bdn){
                var bowerDir = projectDir + path.sep + bdn;
                fs.readdir(bowerDir).done(function(filenames){
                    var fns = {};
                    filenames.forEach(function(fn){
                        fns[fn] = 1;
                    });
                    fs.readTextFile(bowerJson).done(function(bowerTxt){
                        var parsedBower = JSON.parse(bowerTxt);
                        var needed = false;
                        var firstLevelDeps = [];
                        for(var dep in parsedBower.dependencies){
                            firstLevelDeps.push(dep);
                            if(!fns.hasOwnProperty(dep)){
                                logger.info("Missing bower dependency " + dep + "#" + parsedBower.dependencies[dep] + " => bower install needed");
                                needed = true;
                            }
                        }
                        if(!needed){
                            deferred.map(firstLevelDeps, function(depName){
                                var rel = bdn + path.sep + depName + path.sep + "bower.json";
                                var pjp = projectDir + path.sep + rel;
                                return fs.readTextFile(pjp);
                            })(function(depsPackageJsons){
                                depsPackageJsons.forEach(function(pj){
                                    var parsed = JSON.parse(pj);
                                    for(var dep in parsed.dependencies){
                                        if(!fns.hasOwnProperty(dep)){
                                            logger.info("Missing bower dependency " + dep + "#" + parsedBower.dependencies[dep] + " => bower install needed");
                                            needed = true;
                                        }
                                    }
                                });
                                def.resolve(needed);
                            }).done();
                        }else{
                            def.resolve(needed);
                        }
                    }, function(err){
                        logger.error(err.stack);
                        def.reject(err);
                    });
                }, function(err){
                    logger.info("Could not read bower dir " + bowerDir + ", probably need to run bower");
                    def.resolve(true);
                });
            }
            fs.exists(bowerJson).done(function(jsonExists){
                if(jsonExists){
                    fs.exists(bowerRC).done(function(rcExists){
                        var bdn = "bower_components";
                        if(rcExists){
                            fs.readTextFile(bowerRC).done(function(rcText){
                                logger.debug("Read " + bowerRC)
                                var parsed = JSON.parse(rcText);
                                if(parsed && parsed.hasOwnProperty("directory") && typeof parsed.directory === "string"){
                                    bdn = parsed.directory;
                                    compareJsonDepsWithInstalled(bdn);
                                }
                            }, function(err){
                                logger.error(err.stack);
                                def.reject(err);
                            });
                        }else{
                            compareJsonDepsWithInstalled(bdn);
                        }
                    }, function(err){
                        logger.error(err.stack);
                        def.reject(err);
                    });
                }else{
                    def.resolve(false);
                }
            }, function(err){
                logger.error("error checking existence " + bowerJson, err);
                def.reject(err);
            });
            return def.promise;
        })(projectDir);
    };

    this.runBower = function(bowerExecPath, nodeCommandPath){
        var t = this;
        return (function(bowerExecPath, nodeCommandPath){
            var def = deferred();
            t.isBowerInstallNecessary(projectDir).done(function(needed){
                if(needed){
                    var bowerExec = bowerExecPath;
                    var curProj = projectDir;
                    var cmd = nodeCommandPath + " " + bowerExec+" install";
                    logger.info("Running bower ...");
                    exec("pwd && " + cmd, {
                        cwd: curProj
                    }, function(error, stdout, stderr){
                        if(error){
                            logger.error("Bower STDOUT=",stdout);
                            logger.error("Bower STDERR=",stderr);
                            logger.error("Error running bower",error.stack);
                            def.reject(error);
                        }else{
                            def.resolve();
                        }
                    });
                }else{
                    logger.info("Bower run not necessary");
                    def.resolve();
                }
            }, function(error){
                logger.error("Error checking bower",error.stack);
                def.reject(error);
            });
            return def.promise;
        })(bowerExecPath, nodeCommandPath);
    };

}


module.exports = {
    //runBower: runBowerForProject
    BowerUtils:BowerUtils
};