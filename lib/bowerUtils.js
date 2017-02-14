"use strict";
const deferred = require("deferred");
const path = require("path");
const fs = require("./filesystem");
const utils = require("./utils");
const exec = require("child_process").exec;

const logger = utils.createLogger({sourceFilePath: __filename});

class BowerUtils {
    constructor(projectDir) {
        this.projectDir = projectDir;
    }

    /**
     * @return {boolean}
     */
    isBowerJsonProvided() {
        return fs.existsSync(this.getBowerJsonPath());
    }

    /**
     * @return {boolean}
     */
    isBowerRcProvided() {
        return fs.existsSync(this.getBowerRcPath());
    }

    /**
     * @return {String}
     */
    getBowerRcPath() {
        return this.projectDir + path.sep + ".bowerrc";
    }

    /**
     * @return {String}
     */
    getBowerJsonPath() {
        return this.projectDir + path.sep + "bower.json";
    }

    /**
     * @return {String}
     */
    getBowerDirectoryPath() {
        let bdn = "bower_components";
        if (this.isBowerRcProvided()) {
            const bowerRc = this.readBowerRc();
            if (bowerRc.hasOwnProperty("directory")) {
                bdn = bowerRc.directory;
            }

        }
        return this.projectDir + path.sep + bdn;
    }

    readBowerRc() {
        return JSON.parse(fs.readFileSync(this.getBowerRcPath(), 'utf8'));
    }

    readBowerJson() {
        return JSON.parse(fs.readFileSync(this.getBowerJsonPath(), 'utf8'));
    }

    isBowerInstallNecessary() {
        return (function (projectDir) {
            const def = deferred();
            const bowerJson = projectDir + path.sep + "bower.json";
            const bowerRC = projectDir + path.sep + ".bowerrc";

            function compareJsonDepsWithInstalled(bdn) {
                const bowerDir = projectDir + path.sep + bdn;
                if (!fs.existsSync(bdn)) {
                    def.resolve(true);
                } else {
                    fs.readdir(bowerDir).done(function (filenames) {
                        const fns = {};
                        filenames.forEach(function (fn) {
                            fns[fn] = 1;
                        });
                        fs.readTextFile(bowerJson).done(function (bowerTxt) {
                            const parsedBower = JSON.parse(bowerTxt);
                            let needed = false;
                            const firstLevelDeps = [];
                            Object.keys(parsedBower.dependencies).forEach(function (dep) {
                                firstLevelDeps.push(dep);
                                if (!fns.hasOwnProperty(dep)) {
                                    logger.info("Missing bower dependency " + dep + "#" + parsedBower.dependencies[dep] + " => bower install needed");
                                    needed = true;
                                }
                            });
                            if (!needed) {
                                deferred.map(firstLevelDeps, function (depName) {
                                    const pjp = projectDir + path.sep + bdn + path.sep + depName + path.sep + "bower.json";
                                    return fs.readTextFile(pjp);
                                })(function (depsPackageJsons) {
                                    depsPackageJsons.forEach(function (pj) {
                                        const parsed = JSON.parse(pj);
                                        if(parsed && parsed.dependencies){
                                            Object.keys(parsed.dependencies).forEach(function (dep) {
                                                if (!fns.hasOwnProperty(dep)) {
                                                    logger.info("Missing bower dependency " + dep + "#" + parsedBower.dependencies[dep] + " => bower install needed");
                                                    needed = true;
                                                }
                                            });
                                        }
                                    });
                                    //def.resolve(needed);
                                }).done(function () {
                                    def.resolve(needed);
                                }, function (err) {
                                    logger.error(err.stack);
                                    //def.reject(err);
                                    def.resolve(true);
                                });
                            } else {
                                def.resolve(needed);
                            }
                        }, function (err) {
                            logger.error(err.stack);
                            console.info("Could not read bower.json from " + bowerJson + ", skipping.");
                            //logger.error(err.stack);
                            def.resolve(true);
                        });
                    }, function (err) {
                        logger.debug("Could not read bower dir " + bowerDir + ", probably need to run bower");
                        logger.debug(err.stack);
                        def.resolve(true);
                    });
                }

            }

            fs.exists(bowerJson).done(function (jsonExists) {
                if (jsonExists) {
                    fs.stat(bowerRC).done(function (stat) {
                        let bdn = "bower_components";
                        if (stat.isFile()) {
                            fs.readTextFile(bowerRC).done(function (rcText) {
                                logger.debug("Read " + bowerRC);
                                const parsed = JSON.parse(rcText);
                                if (parsed && parsed.hasOwnProperty("directory") && typeof parsed.directory === "string") {
                                    bdn = parsed.directory;
                                    compareJsonDepsWithInstalled(bdn);
                                }
                            }, function (err) {
                                logger.error(err.stack);
                                def.reject(err);
                            });
                        } else {
                            compareJsonDepsWithInstalled(bdn);
                        }
                    }, function (err) {
                        logger.error(err.stack);
                        compareJsonDepsWithInstalled("bower_components");
                        //def.reject(err);
                    });
                } else {
                    def.resolve(false);
                }
            }, function (err) {
                logger.error("error checking existence " + bowerJson, err);
                logger.error(err.stack);
                def.reject(err);
            });
            return def.promise;
        })(this.projectDir);
    }

    /**
     *
     * @param {String} bowerExecPath
     * @param {String} nodeCommandPath
     */
    runBower(bowerExecPath, nodeCommandPath) {
        const t = this;
        return (function (bowerExecPath, nodeCommandPath) {
            const def = deferred();
            t.isBowerInstallNecessary(t.projectDir).done(function (needed) {
                if (needed) {
                    let bowerExec = bowerExecPath;
                    if (bowerExec.indexOf(" ") > 0) {
                        bowerExec = '"' + bowerExec + '"';
                    }
                    const curProj = t.projectDir;
                    let nodeCmd = process.argv[0];
                    if (nodeCmd.indexOf(" ") > 0) {
                        nodeCmd = '"' + nodeCmd + '"';
                    }
                    const cmd = nodeCmd + " " + bowerExec + " install";
                    logger.info("Running bower : " + cmd);
                    exec(cmd, {
                        cwd: curProj
                    }, function (error, stdout, stderr) {
                        if (error) {
                            logger.error("Bower STDOUT=", stdout);
                            logger.error("Bower STDERR=", stderr);
                            logger.error("Error running bower", error.stack);
                            def.reject(error);
                        } else {
                            def.resolve();
                        }
                    });
                } else {
                    logger.info("Bower run not necessary");
                    def.resolve();
                }
            }, function (error) {
                logger.error("Error checking bower", error.stack);
                def.reject(error);
            });
            return def.promise;
        })(bowerExecPath, nodeCommandPath);
    }

}

// module.exports = {
//     //runBower: runBowerForProject
//     BowerUtils:BowerUtils
// };

module.exports = BowerUtils;