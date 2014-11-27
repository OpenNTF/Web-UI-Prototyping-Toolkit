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

/**
 * Reusable functions to be properly allocated / scoped / ..
 */

var path = require("path");
var fs = require("fs");
var crypto = require('crypto');
var wrench = require("wrench"),
    Entities = require('html-entities').AllHtmlEntities,
    beautifyJs = require('js-beautify').js,
    beautifyCss = require('js-beautify').css,
    beautifyHtml = require('js-beautify').html,
    winston = require("winston");



function removeBuilderHtmlComments(markup) {
    logger.debug("REGEX = " + quoteRegexpLiteral('\\<!--') + '[^>]*' + quoteRegexpLiteral('--\\>'));

    return markup.replace(new RegExp('<!-- [a-z\\-A-Z0-9_]+ -->', 'g'), '');
}


function Logger(args){

    this.parseArgs = function(a){
        this.sourceFilePath = a.sourceFilePath;
        this.sourceFilename = path.basename(this.sourceFilePath);
        this.sourcePostFix = ' - ';
    };
    this.parseArgs(args);
    this.logger = new (winston.Logger)({
        transports: [
            new (winston.transports.Console)({level:'silly'})//,
//            new (winston.transports.File)({ filename: 'somefile.log' })
        ]
    });
    this.info = function(msg, arg){
        if(arguments.length > 1){
            this.logger.info(this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.info(this.sourceFilename + this.sourcePostFix + msg);
        }

    };
    this.debug = function(msg, arg){
        if(arguments.length > 1){
            this.logger.log('debug', this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.log('debug', this.sourceFilename + this.sourcePostFix + msg);
        }

    };
    this.warn = function(msg, arg){
        if(arguments.length > 1){
            this.logger.warn(this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.warn(this.sourceFilename + this.sourcePostFix + msg);
        }

    };
    this.error = function(msg, arg){
        if(arguments.length > 1){
            this.logger.error(this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.error(this.sourceFilename + this.sourcePostFix + msg);
        }

    };
    this.trace = function(msg, arg){
        if(arguments.length > 1){
            this.logger.log('verbose', this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.log('verbose', this.sourceFilename + this.sourcePostFix + msg);
        }

    };


}

var logger = new Logger({sourceFilePath : __filename});

function getObjectType(obj){
    var type = Object.prototype.toString.call(obj);
    return  type.substring(type.indexOf(' ')+1, type.length-1);
}

function isArray(obj){
    return getObjectType(obj)==='Array';
}

function isDefined(obj){
    var type=getObjectType(obj);
    return type !== 'Undefined' && type !== 'Null';
}

function isFunction(obj){
    return getObjectType(obj) === 'Function';
}
function isString(obj){
    return getObjectType(obj) === 'String';
}
/**
 * Example args:
 * fileNameFilter = fn(filename, filepath)
 * fileStatFilter = fn(stat, filename, filepath)
 * fileContentFilter = fn(content, filename, filepath, stat)
 * resultConverter= fn(filename, filepath, stat)
 * ignoredPaths = []
 * ignoredNames = []
 * matchFiles (true)
 * matchDirs (false)
 * @param args
 * @constructor
 */
function RecursiveDirLister(args){
    var instance = this;
//        this.dirPaths = args.dirPaths;
    this.runtime = args.runtime;
    this.fileNameFilter = args.fileNameFilter;
    this.fileStatFilter = args.fileStatFilter;
    this.fileContentFilter = args.fileContentFilter;
    this.ignoredPaths = args.ignoredPaths;
    this.ignoredPathsMap = {};
    if(isArray(this.ignoredPaths)){
        this.ignoredPaths.forEach(function(ignored){
            instance.ignoredPathsMap[ignored] = 1;
        })
    }
    this.ignoredNames = args.ignoredNames;
    this.ignoredNamesMap = {}
    if(isArray(this.ignoredNames)){
        this.ignoredNames.forEach(function(ignored){
            instance.ignoredNamesMap[ignored] = 1;
        })
    }
    this.matchFiles = args.matchFiles || true;
    this.matchDirs = args.matchDirs || false;
    this.resultConverter = args.resultConverter;
    this.isIgnored = function(filename, filePath){
        return this.ignoredNamesMap.hasOwnProperty(filename) || this.ignoredPathsMap.hasOwnProperty(filePath)
    };

    this.listRecursive = function(dirpaths){
        var that = this;
        var dirs;
        if(isArray(dirpaths)){
            dirs = dirpaths;
        }else if(isString(dirpaths)){
            dirs = functionArgsToArray(arguments);
        }else{
            throw new Error("Illegal dirs argument (should be different dir paths or array of dirpaths): " + dirpaths);
        }
        var filterNames = isFunction(this.fileNameFilter);
        var filterStat = isFunction(this.fileStatFilter);
        var filterContent = isFunction(this.fileContentFilter);
        var matches = [];
        var convertResults = isFunction(this.resultConverter);

        while (dirs.length > 0) {
            var dir = dirs[0];
            dirs.splice(0, 1);

            var fileNames = this.runtime.listDir(dir);
            fileNames.forEach(function (fileName) {
                var fullFilePath = path.join(dir, fileName);
                var pathOk = true;
                if(!that.isIgnored(fileName, fullFilePath)){
                    if(filterNames && !that.fileNameFilter(fileName, fullFilePath)){
                        pathOk = false;
                    }
                    var stat = that.runtime.statPath(fullFilePath);

                    if(pathOk && filterStat && !that.fileStatFilter(stat, fileName, fullFilePath)){
                        pathOk = false;
                    }
                    if(pathOk && filterContent){
                        if(stat.isFile()){
                            pathOk = that.fileContentFilter(that.runtime.readFile(fullFilePath), fileName, fullFilePath, stat);
                        }
                    }
                    if(pathOk){
                        if(stat.isFile()){
                            if(that.matchFiles){
                                if(convertResults){
                                    matches.push(that.resultConverter(fileName, fullFilePath, stat));
                                }else{
                                    matches.push(fullFilePath);
                                }

                            }
                        }else if(stat.isDirectory()){
                            if(that.matchDirs){
                                if(convertResults){
                                    matches.push(that.resultConverter(fileName, fullFilePath, stat));
                                }else{
                                    matches.push(fullFilePath);
                                }
                            }
                        }else{
                            throw new Error("unknown file type: " + fullFilePath);
                        }
                    }
                    if(stat.isDirectory()){
                        dirs.push(fullFilePath);
                    }
                }else{
                    // ignored path
                }

            });
        }
        if(!convertResults){
            matches.sort();
        }
        return matches;


    }
}


function findComment(markup, startIndex) {
    var commentOpen = markup.indexOf('<!--', startIndex);
    if (commentOpen >= 0) {
        var instructionOpen = markup.indexOf('<!--[', startIndex);
        if (instructionOpen !== commentOpen) {
            var commentClose = markup.indexOf('-->', commentOpen);
            if (commentClose > 0) {
                var comment = markup.substring(commentOpen, commentClose + 3);
                return {
                    comment: comment,
                    start: commentOpen
                }
            }
        } else {
            return markup.indexOf('-->', instructionOpen) + 3;
        }
    }
    return false;

}

function removeAllHtmlComments(markup) {
    var ms = "" + markup;
    var startIndex = 0;
    var comment;
    var removed = 0;
    while (comment = findComment(ms, startIndex)) {
        if (typeof comment === 'number') {
            startIndex = comment;
        } else {
            ms = ms.substring(0, comment.start) + ms.substring(comment.start + comment.comment.length);
            removed += 1;
        }
    }
    logger.debug("Removed " + removed + " comments");
    return ms;
}

function removeBlankLines(markup) {
    return markup.replace(/^\s*[\r\n]/gm, "");
}

function encodeHtmlEntities(markup) {
    var htmlEntities = new Entities();
    var encoded = htmlEntities.encode(markup);
    return encoded;
}

var quoteRegexpLiteral = function (str) {
    return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

var createDependencyUrlForTarget = function (targetPagePath, depUrl, targetDir) {
    var out;
    logger.debug("Creating dep for pagePath=" + targetPagePath + " url=" + depUrl + " targetDir=" + targetDir);
    var schemaColon = depUrl.indexOf("://");
    if (schemaColon < 0) {
        if (depUrl.charAt(0) !== '/') {
            var pp = targetPagePath.substring(1);
            var lastSlash = targetPagePath.lastIndexOf("/");
            if (lastSlash < 0) {
                out = targetDir + '/' + depUrl;
                logger.debug("TOPLEVEL : " + out);
            } else {
                var toNormalize = targetDir + "/" + pp.substring(0, lastSlash) + depUrl;
                logger.debug("path with slash to normalize: " + toNormalize);
                out = path.normalize(toNormalize);
                logger.debug("AT CHILD : " + out);
            }
        } else {
            out = targetDir + depUrl;
        }
    } else {
        logger.debug("EXTERNAL url: " + depUrl);
        out = depUrl;
    }
    logger.debug("ENCODED DEP URL : " + out);
    return out;
};

var getUserHome = function () {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
};

var normalizePathCmdLine = function (pathArg) {
    logger.debug("Normalizing cmdline path arg : " + pathArg);
    var processedPath;
    var arg = pathArg;
    if (arg.charAt(0) === '~') {
        processedPath = getUserHome() + arg.substring(1);
    } else if (arg.charAt(0) === "/") {
        processedPath = arg;
    } else {
        processedPath = path.join(process.cwd(), arg);
    }
    var normalized = path.normalize(processedPath);
    if(normalized.substring(normalized.length-1) === '/'){
        normalized = normalized.substring(0, normalized.length-1);
    }
    return normalized;
};


var functionArgsToArray = function (args) {
    return Array.prototype.slice.call(args);
}

var getWorkingDirectory = function () {
    return process.cwd();
};

var ensureParentDirExists = function (fileName) {
//    logger.debug("Getting parent dir from " + fileName);
    var pd = path.dirname(fileName);
    if (!fs.existsSync(pd)) {
        wrench.mkdirSyncRecursive(pd);
    }
};

function checksum (str, algorithm, encoding) {
    return crypto
        .createHash(algorithm || 'md5')
        .update(str, 'utf8')
        .digest(encoding || 'hex')
}



//checksum('This is my test text');         // e53815e8c095e270c6560be1bb76a65d
//checksum('This is my test text', 'sha1'); // cd5855be428295a3cc1793d6e80ce47562d23def

var isInSubdirOfParent = function (parentPath, fullPath) {
    return fullPath.indexOf(parentPath) === 0 && fullPath.substring(parentPath.length).substring(1).indexOf("/") > 0;
};

var hasPropertyOfType = function(obj, propertyName, propertyType){
    if(typeof obj !== 'object'){
        throw new Error("obj arg should be (defined) object: " + obj);
    }
    if(!isString(propertyName)){
        throw new Error("propertyName arg should be String: " + propertyName);
    }
    if(!isString(propertyType)){
        throw new Error("propertyType arg should be String: " + propertyType);
    }
    return obj.hasOwnProperty(propertyName) && getObjectType(obj[propertyName]) === propertyType;
};

var zeroPrefixPositions = function(n, positions){
    function log10(val) {
        return Math.log(val) / Math.LN10;
    }
    var out = "" + n;
    for(var p = 0 ; p < positions ; p+=1){
        if(n < Math.pow(10, p)){
            out = "0" + out;
        }
    }
    return out;
};

var byteSizeFormatters = {
    KB: 1024,
    MB: 1024*1024,
    GB:1024*1024*1024,
    kb: function(n){
        if(n < byteSizeFormatters.KB) return 0;
        return parseInt(n/byteSizeFormatters.KB,10);
    },
    mb: function(n){
        if(n < byteSizeFormatters.MB) return 0;
        return parseInt(n/(byteSizeFormatters.MB),10);
    },
    gb: function(n){
        if(n < byteSizeFormatters.GB) return 0;
        return parseInt(n/byteSizeFormatters.GB,10);
    },
    all: function(n){
        var sf = byteSizeFormatters;
        var g = sf.gb(n);
        var r = n - (sf.GB * g);
        var m = sf.mb(r);
        r = r - (sf.MB * m);
        var k = sf.kb(r);
        r = r - (sf.KB * k);
        var b = r;
        return {
            gb: g,
            mb: m,
            kb: k,
            byte: b
        };
    },
    allstring: function(n){
        var a = byteSizeFormatters.all(n);
        if(a.gb > 0){
            return a.mg + "," + zeroPrefixPositions(a.mb, 3).substring(0, 1) + " Gb";
        }
        if(a.mb > 0){
            return a.mb + "," + zeroPrefixPositions(a.kb, 3).substring(0, 1) + " Mb";
        }
        if(a.kb > 0){
            return a.kb + "," + zeroPrefixPositions(a.byte, 3).substring(0, 1) + " Kb";
        }
        return a.byte +  " bytes";
    }
};

var startsWith = function(str, prefix){
    return str.indexOf(prefix) === 0;
};

var endsWith = function(str, postfix){
    return str.length >= postfix.length && str.substring(str.length-postfix.length) === postfix;
};

function formatByteSize(bytes, format){
    var fmt = "allstring";
    if(typeof format === 'string' && byteSizeFormatters.hasOwnProperty(format) && typeof byteSizeFormatters[format] === 'function'){
        fmt = format;
    }
    return byteSizeFormatters[fmt](bytes);

}

function isRelativePath(thePath){
    return thePath.indexOf('./') === 0 || thePath.indexOf('../') === 0;
}

function nestedPathExists() {
    var args = Array.prototype.slice.call(arguments),
        object = args.shift();

    for (var i = 0; i < args.length; i++) {
        if (!object || !object.hasOwnProperty(args[i])) {
            return false;
        }
        object = object[args[i]];
    }
    return true;
}

module.exports = {
    removeBuilderHtmlComments: removeBuilderHtmlComments,
    findComment: findComment,
    removeAllHtmlComments: removeAllHtmlComments,
    removeBlankLines: removeBlankLines,
    encodeHtmlEntities: encodeHtmlEntities,
    quoteRegexpLiteral: quoteRegexpLiteral,
    createDependencyUrlForTarget: createDependencyUrlForTarget,
    ensureParentDirExists: ensureParentDirExists,
    isInSubdirOfParent: isInSubdirOfParent,
    beautifyHtml: beautifyHtml,
    beautifyCss: beautifyCss,
    beautifyJs: beautifyJs,
    getUserHome: getUserHome,
    normalizePathCmdLine: normalizePathCmdLine,
    getWorkingDirectory: getWorkingDirectory,
    functionArgsToArray: functionArgsToArray,
    nestedPathExists: nestedPathExists,
    isString: isString,
    isArray:isArray,
    isDefined:isDefined,
    getObjectType:getObjectType,
    hasPropertyOfType:hasPropertyOfType,
    isPropertyOfType:hasPropertyOfType,
    /**
     * Creates a recursive dir lister
     * Example args:
     * fileNameFilter = fn(filename, filepath)
     * fileStatFilter = fn(stat, filename, filepath)
     * fileContentFilter = fn(content, filename, filepath, stat)
     * ignoredPaths = []
     * ignoredNames = []
     * matchFiles (true)
     * matchDirs (false)
     * @param args
     * @constructor
     */
    createRecursiveDirLister: function(args){
        return new RecursiveDirLister(args);
    },
    checksum:checksum,
    formatByteSize:formatByteSize,
    zeroPrefixPositions:zeroPrefixPositions,
    sizeFormatters: byteSizeFormatters,
    startsWith:startsWith,
    endsWith:endsWith,
    isRelativePath:isRelativePath,
    createLogger : function(args){
        return new Logger(args);
    }
};