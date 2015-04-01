var fs = require("fs");
var deferred = require("deferred");
var wrench = require("wrench");
var promisify = deferred.promisify;

module.exports = {
    readTextFile : function(path){
        return (function(path){
            var def = deferred();
            console.log("Reading " + path);
            fs.readFile(path, {encoding:'utf8'}, function(err, data){
                if(err){
                    console.error("Error reading " + path, err.stack);
                    def.reject(err);
                }else{
                    def.resolve(data);
                }
            });
            return def.promise;
        })(path);
    },
    writeTextFile : function(path, data){
        return (function(path, data){
            var def = deferred();
            console.log("Reading " + path);
            fs.writeFile(path, data, {encoding:'utf8'}, function(err, data){
                if(err){
                    console.error("Error reading " + path, err.stack);
                    def.reject(err);
                }else{
                    def.resolve(data);
                }
            });
            return def.promise;
        })(path, data);
    },
    readFile : promisify(fs.readFile),
    writeFile : promisify(fs.writeFile),
    stat : promisify(fs.stat),
    exists : function(path){
        return (function(path){
            var def = deferred();
            fs.stat(path, function(err, stat){
                if(err){
                    def.reject(err);
                }else{
                    def.resolve(stat.isFile() || stat.isDirectory(), stat);
                }
            });
            return def.promise;
        })(path)
    },
    deleteFile : promisify(fs.unlink),
    mkdir : promisify(fs.mkdir),
    mkdirs : function(path){
        return (function(path){
            var def = deferred();
            module.exports.exists(path).done(function(exists){
                if(!exists){
                    try{
                        wrench.mkdirSyncRecursive(path);
                        def.resolve();
                    }catch(mkdirsEx){
                        console.error("Error during mkdirs for " + path);
                        def.reject(mkdirsEx);
                    }
                }else{
                    console.error("Path already exists : ", path);
                    def.reject();
                }
            }, function(err){
                console.error("Error checking if exists for " + path, err.stack);
                def.reject(err);
            });
            return def.promise;
        })(path);
    },
    rmdirs : function(path){
        return (function(path){
            var def = deferred();
            wrench.rmdirRecursive(path, function(err){
                if(err){
                    console.error("Error removing dir " + path, err.stack);
                    def.reject(err);
                }else{
                    console.log("Removed dir " + path);
                    def.resolve();
                }
            });
        })(path);
    },
    readdir : promisify(fs.readdir)
};