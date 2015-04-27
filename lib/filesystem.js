var fs = require("fs");

var deferred = require("deferred");
var wrench = require("wrench");
var promisify = deferred.promisify;
var logReqs = false;
var extLogs = false;
var doTrace = false;




var logfs = function (action, path) {
    if (logReqs) {
        if(doTrace){
            console.trace("" + new Date().getTime() + " " + action.toUpperCase() + " " + path);
        }else{
            console.info("" + new Date().getTime() + " " + action.toUpperCase() + " " + path);
        }


    }
};
var extlogfs = function(action, path){
    if(logReqs && extLogs){
        logfs(action, path);
    }
};
module.exports = {
    /**
     * Sets the logging level. none, rw, all
     * All includes the (numerous) stat & exists & dirlisting type calls
     * @param level
     */
    enableLogging : function(level){
        if(level && typeof level === 'string'){
            switch(level.toLowerCase()){
                case 'rw':
                    logReqs = true;
                    extLogs = false;
                    break;
                case 'all':
                    logReqs = true;
                    extLogs = false;
                    break;
                case 'none':
                    logReqs = false;
                    extLogs = false;
                    break;
                default:
                    throw new Error("Unknown logging level, use one of rw,all,none : " + level);
                    break;
            }
        }else{
            logReqs = false;
            extLogs = false;
        }
    },
    /**
     * If truthy a trace will be printed for every fs call
     * @param enable
     */
    enableTracing : function(enable){
        if(enable){
            doTrace = true;
        }else{
            doTrace = false;
        }
    },
    readTextFile: function (path) {
        logfs("read text", path);
        return (function (path) {
            var def = deferred();
            fs.readFile(path, {encoding: 'utf8'}, function (err, data) {
                if (err) {
                    console.log("Error reading " + path, err.stack);
                    def.reject(err);
                } else {
                    def.resolve(data);
                }
            });
            return def.promise;
        })(path);
    },
    writeTextFile: function (path, data) {
        logfs("write text", path);
        return (function (path, data) {
            var def = deferred();
            fs.writeFile(path, data, {encoding: 'utf8'}, function (err, data) {
                if (err) {
                    console.error("Error reading " + path, err.stack);
                    def.reject(err);
                } else {
                    def.resolve(data);
                }
            });
            return def.promise;
        })(path, data);
    },
    readFile: function(path, options){
        logfs("read", path);
        return promisify(fs.readFile)(path, options);
    },
    writeFile: function(path, data, options){
        logfs("write", path);
        return promisify(fs.writeFile)(path, data, options);
    },
    stat: function(path){
        extlogfs("stat", path);
        return promisify(fs.stat)(path);
    },
    statSync: function (path) {
        extlogfs("stat sync", path);
        return fs.statSync(path);
    },
    readdirSync: function (path) {
        extlogfs("readdir sync", path);
        return fs.readdirSync(path);
    },
    unlinkSync: function (path) {
        logfs("unlink sync", path);
        return fs.unlinkSync(path);
    },
    mkdirSync: function (path) {
        logfs("mkdir sync", path);
        return fs.mkdirSync(path);
    },
    existsSync: function (path) {
        extlogfs("exists sync", path);
        return fs.existsSync(path);
    },
    writeFileSync: function (path, data, options) {
        logfs("write sync", path);
        return fs.writeFileSync(path, data, options);
    },
    readFileSync: function (path, options) {
        logfs("read sync", path);
        return fs.readFileSync(path, options);
    },
    exists: function (path) {
        extlogfs("exists", path);
        return (function (path) {
            var def = deferred();
            fs.stat(path, function (err, stat) {
                if (err) {
                    def.reject(err);
                } else {
                    stat.exists = function () {
                        return stat.isFile() || stat.isDirectory();
                    };
                    def.resolve(stat);
                }
            });
            return def.promise;
        })(path)
    },
    deleteFile: function(path){
        logfs("unlink", path);
        return promisify(fs.unlink)(path);
    },
    unlink: function(path){
        logfs("unlink", path);
        return promisify(fs.unlink)(path);
    },
    mkdir: function(path){
        logfs("mkdir", path);
        return promisify(fs.mkdir)(path);
    } ,
    mkdirs: function (path) {
        logfs("mkdirs", path);
        return (function (path) {
            var def = deferred();
            module.exports.exists(path).done(function (exists) {
                if (!exists) {
                    try {
                        wrench.mkdirSyncRecursive(path);
                        def.resolve();
                    } catch (mkdirsEx) {
                        console.error("Error during mkdirs for " + path);
                        def.reject(mkdirsEx);
                    }
                } else {
                    console.error("Path already exists : ", path);
                    def.reject();
                }
            }, function (err) {
                console.error("Error checking if exists for " + path, err.stack);
                def.reject(err);
            });
            return def.promise;
        })(path);
    },
    rmdirs: function (path) {
        logfs("rmdirs", path);
        return (function (path) {
            var def = deferred();
            wrench.rmdirRecursive(path, function (err) {
                if (err) {
                    console.error("Error removing dir " + path, err.stack);
                    def.reject(err);
                } else {
                    console.info("Removed dir " + path);
                    def.resolve();
                }
            });
        })(path);
    },
    readdir: function(path){
        extlogfs("readdir", path);
        return promisify(fs.readdir)(path);
    }
};