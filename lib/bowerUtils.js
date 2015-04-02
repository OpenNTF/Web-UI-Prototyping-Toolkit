"use strict";
var deferred = require("deferred");
var path= require("path");
var fs = require("./filesystem");
var exec = require("child_process").exec;

var isBowerInstallNecessary= function(projectDirPath){
    return (function(projectDirPath){
        var def = deferred();
        var bowerJson = projectDirPath + path.sep + "bower.json";
        var bowerRC = projectDirPath + path.sep + ".bowerrc";

        function compareJsonDepsWithInstalled(bdn){
            var bowerDir = projectDirPath + path.sep + bdn;
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
                            console.log("Missing bower dependency " + dep + "#" + parsedBower.dependencies[dep] + " => bower install needed");
                            needed = true;
                        }
                    }
                    if(!needed){
                        deferred.map(firstLevelDeps, function(depName){
                            var rel = bdn + path.sep + depName + path.sep + "bower.json";
                            var pjp = projectDirPath + path.sep + rel;
                            return fs.readTextFile(pjp);
                        })(function(depsPackageJsons){
                            depsPackageJsons.forEach(function(pj){
                                var parsed = JSON.parse(pj);
                                for(var dep in parsed.dependencies){
                                    if(!fns.hasOwnProperty(dep)){
                                        console.log("Missing bower dependency " + dep + "#" + parsedBower.dependencies[dep] + " => bower install needed");
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
                    console.error(err.stack);
                    def.reject(err);
                });
            }, function(err){
                console.error("Error reading dir " + bowerDir, err.stack);
                def.reject(err);
            });
        }
        fs.exists(bowerJson).done(function(jsonExists){
            if(jsonExists){
                fs.exists(bowerRC).done(function(rcExists){
                    var bdn = "bower_components";
                    if(rcExists){
                        fs.readTextFile(bowerRC).done(function(rcText){
                            console.log("Read " + bowerRC)
                            var parsed = JSON.parse(rcText);
                            if(parsed && parsed.hasOwnProperty("directory") && typeof parsed.directory === "string"){
                                bdn = parsed.directory;
                                compareJsonDepsWithInstalled(bdn);
                            }
                        }, function(err){
                            console.error(err.stack);
                            def.reject(err);
                        });
                    }else{
                        compareJsonDepsWithInstalled(bdn);
                    }
                }, function(err){
                    console.error(err.stack);
                    def.reject(err);
                });
            }else{
                def.resolve(false);
            }
        }, function(err){
            console.error("error checking existence " + bowerJson, err);
            def.reject(err);
        });
        return def.promise;
    })(projectDirPath);
};

var runBowerForProject = function(projectDirectoryPath, bowerExecPath, nodeCommandPath){
    return (function(projectDirectoryPath, bowerExecPath, nodeCommandPath){
        var def = deferred();
        isBowerInstallNecessary(projectDirectoryPath).done(function(needed){
            if(needed){
                var bowerExec = bowerExecPath;
                var curProj = projectDirectoryPath;
                var cmd = nodeCommandPath + " " + bowerExec+" install";
                console.log("Running bower ...");
                exec("pwd && " + cmd, {
                    cwd: curProj
                }, function(error, stdout, stderr){
                    if(error){
                        console.error("Bower STDOUT=",stdout);
                        console.error("Bower STDERR=",stderr);
                        console.error("Error running bower",error.stack);
                        def.reject(error);
                    }else{
                        def.resolve();
                    }
                });
            }else{
                console.log("Bower run not necessary");
                def.resolve();
            }
        }, function(error){
            console.error("Error checking bower",error.stack);
            def.reject(error);
        });
        return def.promise;
    })(projectDirectoryPath, bowerExecPath, nodeCommandPath);
};

module.exports = {
    runBower: runBowerForProject
};