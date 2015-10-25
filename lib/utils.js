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
var fs = require("./filesystem");
var http= require("http");
var vm= require("vm");
var crypto = require('crypto');
//noinspection JSUnresolvedVariable
var Entities = require('html-entities').AllHtmlEntities,
    beautifyJs = require('js-beautify').js,
    beautifyCss = require('js-beautify').css,
    beautifyHtml = require('js-beautify').html,
    winston = require("winston");

var loggingLevels = {
    disabled : 0,
    error : 1,
    warn : 2,
    info : 3,
    debug : 4,
    all : 5
};
var loggingLevel = 3;

function getEquivalentFilepath(filePath, altExtension){
    var altExt = altExtension;
    if(altExt.charAt(0) !== '.'){
        altExt= "."+altExt
    }

    var fp = filePath.substring(0, filePath.lastIndexOf(".")) + altExt;
    return fp;
}

function doesEquivalentFilePathExist(filePath, altExtension){
    var fp = getEquivalentFilepath(filePath, altExtension);
    return fs.existsSync(fp) && fs.statSync(fp).isFile();
}

/**
 *
 * @param {Function} keyFn generates a unique string key for a cached object
 * @param {Object[]|Object.<String,Object>} [entries] array to populate or prepopulated cache object
 * @constructor
 */
function ItemCache(keyFn, entries){
    this.items = {};
    if(typeof keyFn !== 'function') throw new Error("missing extract cache key function");
    this.keyFn= keyFn;
    /**
     *
     * @param {Object} image
     * @return {String}
     */
    this.calculateKey = function(image){
        try {
            var keyPart = image.link.substring(image.link.lastIndexOf('/photos/') + 8);
        } catch (e) {
            console.error(e.stack);
            throw new Error("could not extract key from " + image.link + ": " + e.message);
        }
        return keyPart;
    };
    /**
     *
     * @param {Object} image
     */
    this.store = function(image){
        var key = this.calculateKey(image);
        this.items[key] = image;
    };

    /**
     *
     * @param {Object[]}images
     */
    this.storeAll = function(images){
        var t  = this;
        images.forEach(function(i){
            t.store(i);

        })
    };
    /**
     *
     * @param {Number} count
     * @return {Object[]}
     */
    this.getRandom = function(count){
        var t = this;
        var keys = Object.keys(t.items);
        var o = [];
        while(o.length < count && o.length < keys.length){
            var idx = randomArrayIndex(keys);
            o.push(t.items[keys[idx]]);
            keys.splice(idx, 1);
        }
        return o;
    };
    /**
     *
     * @return {Number}
     */
    this.getSize = function(){
        return Object.keys(this.items).length;
    };

    /**
     *
     * @return {boolean}
     */
    this.isEmpty = function(){
        return this.getSize() < 1;
    }

    /**
     *
     * @return {boolean}
     */
    this.isEmpty = function(){
        return this.getSize() < 1;
    };

    /**
     *
     * @return {Object[]}
     */
    this.getAll = function(){
        var o = [];
        var t  = this;
        Object.keys(this.items).forEach(function(k){
            o.push(t.items[k]);
        });
        return o;
    };
    /**
     *
     * @return {Object[]}
     */
    this.filter = function(filterFn){
        return this.getAll().filter(filterFn);
    };
    /**
     *
     * @return {Object[]}
     */
    this.map = function(mapFn){
        return this.getAll().map(mapFn);
    };

    if(entries && entries instanceof Array){
        this.storeAll(entries);
    }else if(entries && typeof entries === 'object'){
        this.items = entries;
    }

}


function removeBuilderHtmlComments(markup) {
    logger.debug("REGEX = " + quoteRegexpLiteral('\\<!--') + '[^>]*' + quoteRegexpLiteral('--\\>'));
    return markup.replace(new RegExp('<!-- [a-z\\-A-Z0-9_]+ -->', 'g'), '');
}

var utils = module.exports;

function shuffleArray(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}

/**
 *
 * @param {{sourceFilePath: String}}args
 * @constructor
 */
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
        if(loggingLevel < 3 ) return;
        if(arguments.length > 1){
            this.logger.info(this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.info(this.sourceFilename + this.sourcePostFix + msg);
        }
    };
    this.debug = function(msg, arg){
        if(loggingLevel < 4 ) return;
        if(arguments.length > 1){
            this.logger.log('debug', this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.log('debug', this.sourceFilename + this.sourcePostFix + msg);
        }
    };
    this.warn = function(msg, arg){
        if(loggingLevel < 2 ) return;
        if(arguments.length > 1){
            this.logger.warn(":WARN: " + this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.warn(":WARN: " + this.sourceFilename + this.sourcePostFix + msg);
        }
    };
    this.error = function(msg, arg){
        if(loggingLevel < 1 ) return;
        if(arguments.length > 1){
            this.logger.error(":ERROR: " + this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.error(":ERROR: " + this.sourceFilename + this.sourcePostFix + msg);
        }
    };
    this.trace = function(msg, arg){
        if(loggingLevel < 5) return;
        if(arguments.length > 1){
            this.logger.log('log', ":TRACE: " + this.sourceFilename + this.sourcePostFix + msg, arg);
        }else{
            this.logger.log('log', ":TRACE: " + this.sourceFilename + this.sourcePostFix + msg);
        }
    };
}

var logger = new Logger({sourceFilePath : __filename});

function HttpRequestOptions(o){

    /**
     * @type {String}
     */
    this.host = -1;
    /**
     * @type {Number}
     */
    this.port = -1;
    /**
     * @type {String}
     */
    this.path = -1;
    /**
     * @type {String}
     */
    this.auth = -1;
    /**
     * @type {Object.<String,String>}
     */
    this.headers = -1;

    if(!o){
        o = {};
    }
    if(o.hasOwnProperty("host"))
        this.host = o.host;
    if(o.hasOwnProperty("port"))
        this.port = o.port;
    if(o.hasOwnProperty("path"))
        this.path = o.path;
    if(o.hasOwnProperty("auth"))
        this.auth = o.auth;
    if(o.hasOwnProperty("headers"))
        this.headers = o.headers;

    this.toOptions = function(){
        var o = {};
        if(this.host !== -1){
            o.host = this.host;
        }
        if(this.port !== -1){
            o.port = this.port;
        }
        if(this.path !== -1){
            o.path = this.path;
        }
        if(this.auth !== -1){
            o.auth = this.auth;
        }
        if(this.headers !== -1){
            o.headers = this.headers;
        }
        return o;
    }
}

/**
 *
 * @param {HttpRequestOptions} options
 * @param {Function} cb
 */
function downloadJsonpData(options, cb){
    var opt = options.toOptions();
    var req = http.request(opt, function(valResp){
        var str = '';
        valResp.on('data', function (chunk) {
            str += chunk;
        });
        valResp.on('end', function () {
            var receivedStr = str;
            console.log("Finished jsonp request :" + str.length + " chars", opt);
            try {
                var startIdx = str.indexOf('(') + 1;
                var endIdex = str.length - 1;
                str = str.substring(startIdx, endIdex);
                var sandbox = {
                    data: -1
                };
                vm.createContext(sandbox);
                vm.runInContext('data='+str + ";", sandbox);
                cb(undefined, sandbox.data);
            } catch (e) {
                console.error("Error parsing response", e);
                console.error(e.stack);
                console.error("Response: " + receivedStr);
                cb(e);
            }
        });
    });
    req.on('error', function(err){
        console.error("Error receiving ", err);
        cb(err);
    });
    req.end();
}


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

var writeBinaryResponse = function (response, status, headers, binaryContent) {
    response.writeHead(status, headers);
    response.write(binaryContent, "binary");
    response.end();
};

var writeResponse = function (response, status, headers, content) {
    response.writeHead(status, headers);
    response.write(content);
    response.end();
};

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
    this.ignoredNamesMap = {};
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

    /**
     *
     * @param {String[]|String} dirpaths
     * @return {String[]}
     */
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

var countOccurrencesBetweenIndexes = function (content, search, start, end) {
    if (end < start) {
        throw new Error("end must be greater than start : " + start + " vs " + end);
    }
    var idx = start;
    var count = 0;
    while (idx < end) {
        var potential = content.indexOf(search, idx);
        if (potential >= 0) {
            count += 1;
            idx = potential + search.length;
        } else {
            idx = end;
        }
    }
    return count;
};


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
    if(fs.existsSync(pathArg) && fs.statSync(pathArg).isDirectory() && path.resolve(pathArg)===pathArg){
        return pathArg;
    }
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
};
var getWorkingDirectory = function () {
    return process.cwd();
};

function checksum (str, algorithm, encoding) {
    return crypto
        .createHash(algorithm || 'md5')
        .update(str, 'utf8')
        .digest(encoding || 'hex')
}
var sortString = function (a, b) {
    if (a < b) {
        return -1;
    } else if (a > b) {
        return 1;
    } else {
        return 0;
    }
};
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
            return a.gb + "," + zeroPrefixPositions(a.mb, 3).substring(0, 1) + " Gb";
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

function getNestedPath(subject, pathPart1) {
    var args = Array.prototype.slice.call(arguments),
        object = args.shift();

    for (var i = 0; i < args.length; i++) {
        if (!object || !object.hasOwnProperty(args[i])) {
            logger.error("Illegal args for neste dpath: ", args);
            throw new Error("Error calling");

        }
        object = object[args[i]];
    }
    return object;
}

function nestedPathExists(subject, pathPart1) {
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

var findCssPreProcessorInfo = function(requestedFilePath, sourceFileExt){
    var sourcePath = false;
    var map = false;
    var format;
    if(endsWith(requestedFilePath, '.css.map')){
        sourcePath = requestedFilePath.substring(0, requestedFilePath.length - '.css.map'.length) + sourceFileExt;
        format = "map";
    }else if (endsWith(requestedFilePath, '.css')){
        sourcePath = requestedFilePath.substring(0, requestedFilePath.length - '.css'.length) + sourceFileExt;
        format="css";
    }else if(endsWith(requestedFilePath, ".css.deps.json")){
        sourcePath = requestedFilePath.substring(0, requestedFilePath.length - ".css.deps.json".length) + sourceFileExt;
        format="deps";
    }
    var out = false;
    if(format && sourcePath && fs.existsSync(sourcePath)){
        out = {
            requestedFilePath : requestedFilePath,
            sourceFilePath : sourcePath,
            outputFormat : format
        };
    }
    return out;
};

/**
 *
 * @param {String} content
 * @param {String} search
 * @param {number} n
 * @param {number} start
 * @return {number}
 */
var findNthOccurrence = function (content, search, n, start) {
    var idx = -1;
    var nextIdx = start;
    var count = 0;
    while (count < n && nextIdx < content.length) {
        var potential = content.indexOf(search, nextIdx);
        if (potential >= 0) {
            count += 1;
            idx = potential;
            nextIdx = potential + search.length;
        } else {
            nextIdx = content.length;

        }
    }
    if (count < n) {
        throw new Error("Could find " + n + "th occurrence of '" + search + "'");
    }
    return idx;
};

/**
 *
 * @param args
 * @constructor
 */
utils.Placeholder = function(args) {
    /**
     * @type {String}
     */
    this._name = args.name;
    /**
     * @type {String}
     */
    this._type = args.type;
    /**
     * @type {Number}
     */
    this._start = args.start;
    /**
     * @type {Number}
     */
    this._end = args.end;
    /**
     * @type {String}
     */
    this._tag = args.tag;
    /**
     * @type {String[]}
     */
    this._args = args.args;

    if (!args.hasOwnProperty('filepath')) {
        throw new Error("missing filepath");
    }
    this._filepath = args.filepath;
    if(this._args){
        this._args.forEach(function(a, idx){
            if(a.trim().length <3){
                console.error("error args : ", args);
                throw new Error("Illegal argument at idx " + idx + " for " + this._tag + " in " + this._filepath);
            }
        })
    }
}

var randomInt = function(min, max){
    return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * @return {String}
 */
utils.Placeholder.prototype.getName = function(){ return this._name;};
/**
 * @return {String}
 */
utils.Placeholder.prototype.getType = function(){return this._type;};
/**
 * @return {Number}
 */
utils.Placeholder.prototype.getStart = function(){return this._start;};
/**
 * @return {Number}
 */
utils.Placeholder.prototype.getEnd = function(){return this._end;};
/**
 * @return {String}
 */
utils.Placeholder.prototype.getTag = function(){return this._tag};

/**
 * @return {Object.<String,String>}
 */
utils.Placeholder.prototype.getArgsObject = function(){
    if(!this.isArgsByName()){
        throw new Error("Args are not by name for " + this._tag + " in " + this._filepath);
    }
    var o = {};
    if(isArray(this._args)){
        this._args.forEach(function(arg){
            if(arg.indexOf('=') > 0){
                var splitArg = arg.split('=');
                var nm = splitArg[0];
                if(splitArg[1].indexOf(',')>0){
                    var multiVal = splitArg[1].split(',');
                    o[nm] = multiVal;
                }else{
                    var val = splitArg[1];
                    o[nm] = val;
                }
            }

        });
    }
    return o;
};

//this._args = this.parseArgs();
/**
 * @return {String[]}
 */

utils.Placeholder.prototype.getArgs = function(){return this._args};
/**
 * @return {boolean}
 */
utils.Placeholder.prototype.hasArgs = function(){
    return this._args && this._args.length > 0;
};
function isNamedArg(arg){
    if(arg.trim().length < 3){
        throw new Error("Illegal argument (between single quotes) : '" + arg + "'");
    }
    var eqIdx = arg.indexOf('=');
    if(eqIdx < 1) return false;
    var sqIdx = arg.indexOf('\'');
    if(sqIdx === 0) return false;
    var qIdx = arg.indexOf('"');
    if(qIdx === 0) return false;
    var quoteIdx = -1;
    if(qIdx >0) quoteIdx = qIdx;
    if(sqIdx > 0 && sqIdx < qIdx) qouteIdx = sqIdx;
    if(quoteIdx > 0){
        if(quoteIdx <= eqIdx){
            return false;
        }
    }
    return true;
}

/**
 * @return {boolean}
 */
utils.Placeholder.prototype.isArgsByName = function(){
    if(!this.hasArgs()){
        throw new Error('Placeholder for ' + this._tag + ' from ' + this._filepath + ' has no args, check hasArgs() first');
    }
    var allArgs = true;
    this.getArgs().forEach(function(a){
        allArgs = allArgs && isNamedArg(a);
    });
    return allArgs;
};
/**
 * @return {boolean}
 */
utils.Placeholder.prototype.isArgsByOrder = function(){
    return !this.isArgsByName();
};

/**
 * @return {String}
 */
utils.Placeholder.prototype.getFilePath = function(){return this._filepath;};
/**
 * @param {String} name
 * @return {boolean}
 */

utils.Placeholder.prototype.isOfType = function(type){
    return this._type === type;
};
/**
 * @param {String} name
 */

utils.Placeholder.prototype.setName = function(name){
    this._name = name;
};
/**
 * @param {String} name
 * @return {boolean}
 */
utils.Placeholder.prototype.isNamed = function(name){
    return this._name === name;
};
/**
 * @return {boolean}
 */
utils.Placeholder.prototype.isRelativePathName = function(){
    return this._name.indexOf("./") === 0 || this._name.indexOf("../") === 0;
};
/**
 * @return {boolean}
 */
utils.Placeholder.prototype.isDefaultResourceInclusion = function(){
    return this._name === 'default' && (this._type === 'linkScript' || this._type==='linkCss')
};
/**
 *
 * @param {String} content
 * @param {String} partContents
 * @param {boolean} addMarkers
 * @return {String}
 */

utils.Placeholder.prototype.replacePartContents = function(content, partContents, addMarkers) {
    var am = false;
    if(typeof addMarkers === 'boolean'){
        am = addMarkers;
    }
    if(am){
        var partArgs = "";
        if (this.hasArgs()) {
            partArgs = ":" + this.getArgs().join();
        }
        var prefix = '<!-- begin_' + this.getType() + '-' + this.getName()+ partArgs + ' -->';
        var postfix = '<!-- end_' + this.getType() + '-' + this.getName() + partArgs + ' -->';
        return content.substring(0, this.getStart()) + prefix + partContents + postfix + content.substring(this.getEnd());
    }else{
        return content.substring(0, this.getStart()) + partContents + content.substring(this.getEnd());
    }
};

/**
 *
 * @param {String} content
 * @param {String} partContents
 * @return {String}
 */
utils.Placeholder.prototype.replacePartContentsWithoutMarking = function(content, partContents) {
    return content.substring(0, this.getStart()) + partContents + content.substring(this.getEnd());
}

/**
 * @return {String}
 */
utils.Placeholder.prototype.getTag = function(){return this._tag};

/**
 *
 * @param {String} placeholderName
 * @return {String[]}
 */
var parseLayoutArgs = function (placeholderName) {
    var argsStart = placeholderName.indexOf('(');
    var argsEnd = placeholderName.lastIndexOf(')');
    var argsPart = placeholderName.substring(argsStart + 1, argsEnd);
    var searchCol = true;
    var parts = [];
    var lastSep = -1;
    var openParCount = 0;
    for (var i = 0; searchCol && i < argsPart.length; i += 1) {
        var c = argsPart.charAt(i);
        if (c === '(') {
            openParCount += 1;
        } else if (c === ')') {
            openParCount -= 1;
        }
        if (c === ';') {
            if (openParCount === 0) {
                if (lastSep > 0) {
                    parts.push(argsPart.substring(lastSep + 1, i).trim());
                } else {
                    parts.push(argsPart.substring(0, i).trim());
                }
                lastSep = i;
            }
        }
    }
    if (lastSep < 0) {
        parts.push(argsPart.substring(0, i).trim());
    } else {
        parts.push(argsPart.substring(lastSep + 1, i).trim());
    }
    return parts;
};

/**
 *
 * @param {String} currentName
 * @param {String} fullTag
 * @param {Number} currentStartIndex
 * @param {Number} currentEndIndex
 * @param {String} filepath
 * @return {utils.Placeholder}
 */
var parsePlaceholder = function (fullTag, filepath, startIdx, endIdx) {
    var tagText = fullTag.trim().substring(4, fullTag.length-3).trim();
    var type = tagText.substring(0, tagText.indexOf(':'));

    var nameAndArgsPart = tagText.substring(tagText.indexOf(':')+1);

    var end = (typeof endIdx === 'number') ? endIdx : startIdx+fullTag.length;
    var hasArgs = nameAndArgsPart.indexOf('(') > 1;
    var name;
    if(hasArgs){
        var args = parseLayoutArgs(nameAndArgsPart);
        name = nameAndArgsPart.substring(0, nameAndArgsPart.indexOf('('))
        return new utils.Placeholder({
            name: name,
            start: startIdx,
            end: end,
            type: type,
            tag: fullTag,
            filepath: filepath,
            args: args
        });
    }else{
        name = nameAndArgsPart.trim();
        return new utils.Placeholder({
            name: name,
            start: startIdx,
            end: end,
            type: type,
            tag: fullTag,
            filepath: filepath,
            args: []
        });
    }


}

/**
 *
 * @param {String} find
 * @param {String} content
 * @return {Number[]}
 */
function findAllIndexesOf(find, content) {
    var idxs = [];
    var from = 0;
    while (from < content.length) {
        var match = content.indexOf(find, from);
        if (match < from) {
            from = content.length;
        } else {
            idxs.push(match);
            from = match + 1;
        }
    }
    return idxs;
}

function writeFile(fullPath, contents, options){
    logger.debug("WRITE " + fullPath + " : " + formatByteSize(contents.length));
    fs.writeFileSync(fullPath, contents, options);
}

function createShuffled(array) {
    var idx = array.length ;
    while (0 !== idx) {
        var randomIndex = Math.floor(Math.random() * idx);
        idx -= 1;
        var current = array[idx];
        array[idx] = array[randomIndex];
        array[randomIndex] = current;
    }
    return array;
}

function randomArrayIndex(array){
    return Math.floor(Math.random() * array.length);
}

/**
 *
 * @param {String} str
 * @return {String}
 */
function unquote(str){
    var doubleQuotes = str.charAt(0) === '"' && str.charAt(str.length - 1) === '"';
    var singleQuotes = str.charAt(0) === "'" && str.charAt(str.length - 1) === "'";
    if(doubleQuotes || singleQuotes){
        return str.substring(1, str.length-1);
    }else{
        return str;
    }

}



module.exports = {
    createShuffled:createShuffled,
    findAllIndexesOf:findAllIndexesOf,
    Placeholder: utils.Placeholder,
    removeBuilderHtmlComments: removeBuilderHtmlComments,
    findComment: findComment,
    removeAllHtmlComments: removeAllHtmlComments,
    removeBlankLines: removeBlankLines,
    encodeHtmlEntities: encodeHtmlEntities,
    quoteRegexpLiteral: quoteRegexpLiteral,
    createDependencyUrlForTarget: createDependencyUrlForTarget,
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
    },
    sortString: sortString,
    replaceTextFragment: function (content, fragment, replacement, startIdx){
        var start = 0;
        if(typeof startIdx === 'number'){
            start = startIdx;
        }
        var crit = fragment;
        var idx = content.indexOf(crit, start);
        var head = content.substring(0, idx);
        var tail = content.substring(idx+crit.length);
        return head + replacement + tail;
    },
    findLatestMod : function(entryFilePath, deps){
        var latestDate = new Date();
        latestDate.setYear(1983);
        var latest = latestDate.getTime();
        var st = fs.statSync(entryFilePath);
        var atime = st.ctime.getTime();
        if(latest < atime){
            latest = atime;
        }
        var dirMods = {};
        function processPath(dp){
            var dirPath = path.dirname(dp);
            if(!dirMods.hasOwnProperty(dirPath)){
                st = fs.statSync(dirPath);
                atime = st.ctime.getTime();
                if(latest < atime){
                    latest = atime;
                }
                dirMods[dirPath] = 1;
            }
            st = fs.statSync(dp);
            atime = st.ctime.getTime();
            if(latest < atime){
                latest = atime;
            }
        }
        if(deps){
            if(isArray(deps)){
                deps.forEach(function(dp){
                    processPath(dp);
                });
            }else{
                for(var depPath in deps){
                    processPath(depPath);
                }
            }
        }
        return latest;
    },
    /**
     *
     * @param {String} str
     * @param {String} search
     * @return {Number}
     */
    countOccurrences: function(str, search){

        var r = new RegExp(quoteRegexpLiteral(search), 'g');

// the g in the regular expression says to search the whole string
// rather than just find the first occurrence
        var count = (str.match(r) || []).length;
        return count;

    },
    findNthOccurrence:findNthOccurrence,
    countOccurrencesBetweenIndexes:countOccurrencesBetweenIndexes,
    readTextFile : function(fullPath, callback){
        fs.readFile(fullPath, {encoding:'utf8'}, callback);
    },
    readBinaryFile : function(fullPath, callback){
        fs.readFile(fullPath, callback);
    },
    readTextFileSync : function(fullPath){
        return fs.readFileSync(fullPath, {encoding:'utf8'});
    },
    readBinaryFileSync : function(fullPath){
        return fs.readFileSync(fullPath);
    },
    writeResponse:writeResponse,
    writeBinaryResponse:writeBinaryResponse,
    writeFile:writeFile,
    correctCommentClosings:function correctCommentClosings(markup){
        var m = markup;
        var l = m.lastIndexOf('-->');
        while(l>0){
            if(m.charAt(l-1) !==' '){
                m = m.substring(0, l) + " " + m.substring(l);
            }
            l = m.lastIndexOf('-->', l-1);
        }
        return m;

    },
    getNestedPath:getNestedPath,
    findCssPreProcessorInfo:findCssPreProcessorInfo,
    countOwnProperties: function(obj){
        if(typeof obj !== 'object'){
            logger.error("Passed instead of object: ", obj);
            throw new Error("arg should be object");
        }
        var count = 0;
        for(var k in obj){
            if(obj.hasOwnProperty(k)){
                count += 1;
            }
        }
        return count;
    },
    /**
     *
     * @param {String} tagName
     * @param {String} type
     * @param {Number} startIdx
     * @param {Number} endIdx
     * @param {String} fullTag
     * @param {String} filepath
     * @return {utils.Placeholder}
     */
    parseNoArgsPlaceholder: function (tagName, type, startIdx, endIdx, fullTag, filepath) {
        return parsePlaceholder(fullTag, filepath, startIdx, endIdx);
    },
    setLoggingLevel: function(level){
        if(typeof level === 'number'){
            if(level < 0 || level > 5){
                throw new Error("Illegal logging level: " + level);
            }
            loggingLevel = level;
        }else if(typeof level === 'string'){
            var ll = level.toLowerCase();
            if(!loggingLevels.hasOwnProperty(ll)){
                throw new Error("Illegal logging level: " + level);
            }
            loggingLevel = loggingLevels[ll];
        }else{
            throw new Error("Illegal logging level: " + level);
        }
    },
    IbmWcmTag:utils.IbmWcmTag,
    unquote:unquote,
    shuffleArray:shuffleArray,
    randomArrayIndex:randomArrayIndex,
    HttpRequestOptions:HttpRequestOptions,
    downloadJsonpData:downloadJsonpData,
    ItemCache:ItemCache,
    getEquivalentFilepath:getEquivalentFilepath,
    doesEquivalentFilePathExist:doesEquivalentFilePathExist,
    parsePlaceholder:parsePlaceholder,
    randomInt:randomInt
};