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
"use strict";
/**
 * Reusable functions to be properly allocated / scoped / ..
 */
const
    path = require("path"),
    fs = require("./filesystem"),
    http = require("http"),
    vm = require("vm"),
    crypto = require('crypto'),
    Entities = require('html-entities').AllHtmlEntities,
    beautifyJs = require('js-beautify').js,
    beautifyCss = require('js-beautify').css,
    beautifyHtml = require('js-beautify').html,
    Logger = require('./Logger');

function getEquivalentFilepath(filePath, altExtension){
    let altExt = altExtension;
    if(altExt.charAt(0) !== '.'){
        altExt= "."+altExt;
    }
    return filePath.substring(0, filePath.lastIndexOf(".")) + altExt;
}

function doesEquivalentFilePathExist(filePath, altExtension){
    const fp = getEquivalentFilepath(filePath, altExtension);
    return fs.existsSync(fp) && fs.statSync(fp).isFile();
}

function removeBuilderHtmlComments(markup) {
    logger.debug("REGEX = " + quoteRegexpLiteral('\\<!--') + '[^>]*' + quoteRegexpLiteral('--\\>'));
    return markup.replace(new RegExp('<!-- [a-z\\-A-Z0-9_]+ -->', 'g'), '');
}

function shuffleArray(o){
    let j, x, i = o.length;
    for(; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
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
        const o = {};
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
    };
}

/**
 *
 * @param {HttpRequestOptions} options
 * @param {Function} cb
 */
function downloadHttpTextualData(options, cb){
    const opt = options.toOptions();
    logger.debug("Downloading http textual data for : ", opt);
    try{
        const req = http.request(opt,
            /**
             *
             * @param {http.IncomingMessage} res
             */
            function (res) {
                logger.debug("Receving data from " + res.req.method + " " + res.req.path + " (" + res.statusCode + " " + res.statusMessage + ") with headers:", res.headers);
                let str = '';
                res.on('data', function (chunk) {
                    str += chunk;
                });
                res.on('end', function () {
                    const receivedStr = str;
                    logger.debug("Finished http textual data request :" + str.length + " chars :: ", str);
                    cb(undefined, receivedStr);

                });
            });
        req.on('error', function(err){
            logger.error("Error receiving ", err);
            cb(err);
        });
        req.end();
    }catch(ex){
        logger.error("Could not perform http req for ", options);
        logger.error(ex.stack);
        throw ex;
    }

}

/**
 *
 * @param {HttpRequestOptions} options
 * @param {Function} cb
 */
function downloadJsonpData(options, cb){

    downloadHttpTextualData(options, function(err, text){
        if(err){
            logger.error("downloading http data indicated error: ", err);
            cb(err);
        }else{
            let str = text;
            logger.debug("Received data for JSONP :" + str.length + " chars :: ", str);
            try {
                const startIdx = str.indexOf('(') + 1;
                const endIdex = str.length - 1;
                str = str.substring(startIdx, endIdex);
                const sandbox = {
                    data: -1
                };
                vm.createContext(sandbox);
                vm.runInContext('data='+str + ";", sandbox);
                cb(undefined, sandbox.data);
            } catch (e) {
                logger.error("Error parsing response", e);
                logger.error(e.stack);
                logger.error("Response: " + text);
                cb(e);
            }
        }

    });
}


function getObjectType(obj){
    const type = Object.prototype.toString.call(obj);
    return  type.substring(type.indexOf(' ')+1, type.length-1);
}

function isArray(obj){
    return getObjectType(obj)==='Array';
}

function isDefined(obj){
    const type = getObjectType(obj);
    return type !== 'Undefined' && type !== 'Null';
}

function isFunction(obj){
    return getObjectType(obj) === 'Function';
}
function isString(obj){
    return getObjectType(obj) === 'String';
}

const writeBinaryResponse = function (response, status, headers, binaryContent) {
    response.writeHead(status, headers);
    response.write(binaryContent, "binary");
    response.end();
};

const writeResponse = function (response, status, headers, content) {
    response.writeHead(status, headers);
    response.write(content);
    response.end();
};

let functionArgsToArray = function (args) {
    return Array.prototype.slice.call(args);
};

const countOccurrencesBetweenIndexes = function (content, search, start, end) {
    if (end < start) {
        throw new Error("end must be greater than start : " + start + " vs " + end);
    }
    let idx = start;
    let count = 0;
    while (idx < end) {
        const potential = content.indexOf(search, idx);
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
    const commentOpen = markup.indexOf('<!--', startIndex);
    if (commentOpen >= 0) {
        const instructionOpen = markup.indexOf('<!--[', startIndex);
        if (instructionOpen !== commentOpen) {
            const commentClose = markup.indexOf('-->', commentOpen);
            if (commentClose > 0) {
                const comment = markup.substring(commentOpen, commentClose + 3);
                return {
                    comment: comment,
                    start: commentOpen
                };
            }
        } else {
            return markup.indexOf('-->', instructionOpen) + 3;
        }
    }
    return false;

}

function removeAllHtmlComments(markup) {
    let ms = "" + markup;
    let startIndex = 0;
    let removed = 0;
    let comment = findComment(ms, startIndex);

    while (comment) {
        if (typeof comment === 'number') {
            startIndex = comment;
        } else {
            ms = ms.substring(0, comment.start) + ms.substring(comment.start + comment.comment.length);
            removed += 1;
        }
        comment = findComment(ms, startIndex);
    }
    logger.debug("Removed " + removed + " comments");
    return ms;
}

function removeBlankLines(markup) {
    return markup.replace(/^\s*[\r\n]/gm, "");
}

function encodeHtmlEntities(markup) {
    const htmlEntities = new Entities();
    const encoded = htmlEntities.encode(markup);
    return encoded;
}

var quoteRegexpLiteral = function (str) {
    return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

const createDependencyUrlForTarget = function (targetPagePath, depUrl, targetDir) {
    let out;
    logger.debug("Creating dep for pagePath=" + targetPagePath + " url=" + depUrl + " targetDir=" + targetDir);
    const schemaColon = depUrl.indexOf("://");
    if (schemaColon < 0) {
        if (depUrl.charAt(0) !== '/') {
            const pp = targetPagePath.substring(1);
            const lastSlash = targetPagePath.lastIndexOf("/");
            if (lastSlash < 0) {
                out = targetDir + '/' + depUrl;
                logger.debug("TOPLEVEL : " + out);
            } else {
                const toNormalize = targetDir + "/" + pp.substring(0, lastSlash) + depUrl;
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

const getUserHome = function () {
    return process.env[(process.platform.toString() === 'win32') ? 'USERPROFILE' : 'HOME'];
};

const normalizePathCmdLine = function (pathArg) {
    logger.debug("Normalizing cmdline path arg : " + pathArg);
    let out;
    if (fs.existsSync(pathArg) && fs.statSync(pathArg).isDirectory() && path.resolve(pathArg) === pathArg) {
        out = pathArg;
    }else{

        let processedPath;
        const arg = pathArg;
        if (arg.charAt(0) === '~') {
            processedPath = getUserHome() + arg.substring(1);
        } else if (arg.charAt(0) === "/") {
            processedPath = arg;
        } else {
            processedPath = path.join(process.cwd(), arg);
        }
        let normalized = path.normalize(processedPath);
        if (normalized.substring(normalized.length - 1) === '/') {
            normalized = normalized.substring(0, normalized.length - 1);
        }
        out =  normalized;
    }
    return out;
};

const getWorkingDirectory = function () {
    return process.cwd();
};

function checksum (str, algorithm, encoding) {
    return crypto
        .createHash(algorithm || 'md5')
        .update(str, 'utf8')
        .digest(encoding || 'hex');
}
const sortString = function (a, b) {
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

const isInSubdirOfParent = function (parentPath, fullPath) {
    return fullPath.indexOf(parentPath) === 0 && fullPath.substring(parentPath.length).substring(1).indexOf("/") > 0;
};
const hasPropertyOfType = function (obj, propertyName, propertyType) {
    if (typeof obj !== 'object') {
        throw new Error("obj arg should be (defined) object: " + obj);
    }
    if (!isString(propertyName)) {
        throw new Error("propertyName arg should be String: " + propertyName);
    }
    if (!isString(propertyType)) {
        throw new Error("propertyType arg should be String: " + propertyType);
    }
    return obj.hasOwnProperty(propertyName) && getObjectType(obj[propertyName]) === propertyType;
};
const zeroPrefixPositions = function (n, positions) {
    function log10(val) {
        return Math.log(val) / Math.LN10;
    }

    let out = "" + n;
    for (let p = 0; p < positions; p += 1) {
        if (n < Math.pow(10, p)) {
            out = "0" + out;
        }
    }
    return out;
};
const byteSizeFormatters = {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    kb: function (n) {
        if (n < byteSizeFormatters.KB) {
            return 0;
        }
        return parseInt(n / byteSizeFormatters.KB, 10);
    },
    mb: function (n) {
        if (n < byteSizeFormatters.MB) {
            return 0;
        }
        return parseInt(n / (byteSizeFormatters.MB), 10);
    },
    gb: function (n) {
        if (n < byteSizeFormatters.GB) {
            return 0;
        }
        return parseInt(n / byteSizeFormatters.GB, 10);
    },
    all: function (n) {
        const sf = byteSizeFormatters;
        const g = sf.gb(n);
        let r = n - (sf.GB * g);
        const m = sf.mb(r);
        r = r - (sf.MB * m);
        const k = sf.kb(r);
        r = r - (sf.KB * k);
        const b = r;
        return {
            gb: g,
            mb: m,
            kb: k,
            byte: b
        };
    },
    allstring: function (n) {
        const a = byteSizeFormatters.all(n);
        if (a.gb > 0) {
            return a.gb + "," + zeroPrefixPositions(a.mb, 3).substring(0, 1) + " Gb";
        }
        if (a.mb > 0) {
            return a.mb + "," + zeroPrefixPositions(a.kb, 3).substring(0, 1) + " Mb";
        }
        if (a.kb > 0) {
            return a.kb + "," + zeroPrefixPositions(a.byte, 3).substring(0, 1) + " Kb";
        }
        return a.byte + " bytes";
    }
};
const startsWith = function (str, prefix) {
    return str.indexOf(prefix) === 0;
};
const endsWith = function (str, postfix) {
    return str.length >= postfix.length && str.substring(str.length - postfix.length) === postfix;
};
function formatByteSize(bytes, format){
    let fmt = "allstring";
    if(typeof format === 'string' && byteSizeFormatters.hasOwnProperty(format) && typeof byteSizeFormatters[format] === 'function'){
        fmt = format;
    }
    return byteSizeFormatters[fmt](bytes);
}

function isRelativePath(thePath){
    return thePath.indexOf('./') === 0 || thePath.indexOf('../') === 0;
}

function getNestedPath(subject, pathPart1) {
    const args = Array.prototype.slice.call(arguments);
    let object = args.shift();

    for (let i = 0; i < args.length; i++) {
        if (!object || !object.hasOwnProperty(args[i])) {
            logger.error("Illegal args for neste dpath: ", args);
            throw new Error("Error calling");

        }
        object = object[args[i]];
    }
    return object;
}

function nestedPathExists(subject, pathPart1) {
    const args = Array.prototype.slice.call(arguments);
    let object = args.shift();

    for (let i = 0; i < args.length; i++) {
        if (!object || !object.hasOwnProperty(args[i])) {
            return false;
        }
        object = object[args[i]];
    }
    return true;
}

const findCssPreProcessorInfo = function (requestedFilePath, sourceFileExt) {
    let sourcePath = false;
    let map = false;
    let format;
    const filePath = requestedFilePath;

    if (endsWith(filePath, '.css.map')) {
        let baseFromMap = filePath.substring(0, filePath.length - '.css.map'.length);
        if (/-splitIE[0-9]*$/.test(baseFromMap)) {
            baseFromMap = baseFromMap.substring(0, baseFromMap.lastIndexOf('-splitIE'));
        }
        sourcePath = baseFromMap + sourceFileExt;
        format = "map";
    } else if (endsWith(filePath, '.css')) {
        let baseFromCss = filePath.substring(0, filePath.length - '.css'.length);
        if (/-splitIE[0-9]*$/.test(baseFromCss)) {
            baseFromCss = baseFromCss.substring(0, baseFromCss.lastIndexOf('-splitIE'));
        }
        sourcePath = baseFromCss + sourceFileExt;
        format = "css";
    } else if (endsWith(filePath, ".css.deps.json")) {
        let baseFromDeps = filePath.substring(0, filePath.length - ".css.deps.json".length);
        if (/-splitIE[0-9]*$/.test(baseFromDeps)) {
            baseFromDeps = baseFromDeps.substring(0, baseFromDeps.lastIndexOf('-splitIE'));
        }
        sourcePath = baseFromDeps + sourceFileExt;
        format = "deps";
    }
    let out = false;
    if (format && sourcePath && fs.existsSync(sourcePath)) {
        out = {
            requestedFilePath: requestedFilePath,
            sourceFilePath: sourcePath,
            outputFormat: format
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
const findNthOccurrence = function (content, search, n, start) {
    let idx = -1;
    let nextIdx = start;
    let count = 0;
    while (count < n && nextIdx < content.length) {
        const potential = content.indexOf(search, nextIdx);
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

const randomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
};



/**
 *
 * @param {String} find
 * @param {String} content
 * @return {Number[]}
 */
function findAllIndexesOf(find, content) {
    const idxs = [];
    let from = 0;
    while (from < content.length) {
        const match = content.indexOf(find, from);
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
    let idx = array.length;
    while (0 !== idx) {
        const randomIndex = Math.floor(Math.random() * idx);
        idx -= 1;
        const current = array[idx];
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
    const doubleQuotes = str.charAt(0) === '"' && str.charAt(str.length - 1) === '"';
    const singleQuotes = str.charAt(0) === "'" && str.charAt(str.length - 1) === "'";
    if(doubleQuotes || singleQuotes){
        return str.substring(1, str.length-1);
    }else{
        return str;
    }

}

function encryptDXSync( text ) {
    const cipher = crypto.createCipher("aes-256-ctr", "U6Jv]H[tf;mxE}6t*PQz?j474A7T@Vx%gcVJA#2cr2GNh96ve+");
    let crypted = cipher.update(text, "utf8", "hex");
    crypted += cipher.final( "hex" );
    return crypted;
}

function decryptDXSync( text ) {
    const decipher = crypto.createDecipher("aes-256-ctr", "U6Jv]H[tf;mxE}6t*PQz?j474A7T@Vx%gcVJA#2cr2GNh96ve+");
    let dec = decipher.update(text, "hex", "utf8");
    dec += decipher.final( "utf8" );
    return dec;
}

/**
 *
 * @param {String[]} paths
 * @param {String} refDirPath
 * @return {String[]}
 */
function relativize(paths, refDirPath){
    const out = [];
    let rdp = refDirPath;
    if(rdp.charAt(rdp.length-1) !== path.sep){
        rdp += path.sep;
    }
    paths.forEach(function(p){
        if(p.indexOf(rdp) === 0){
            out.push(p.substring(rdp.length));
        }
    });
    return out;
}


function listChildDirectoryPaths(parentDirPath){
    const cmpDirs = [];
    const children = fs.readdirSync(parentDirPath);
    children.forEach(function(c){
        const dirPath = parentDirPath + path.sep + c;
        if(fs.statSync(dirPath).isDirectory()){
            cmpDirs.push(dirPath);
        }
    });
    cmpDirs.sort();
    return cmpDirs;
}

function regexpEscape(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(regexpEscape(find), 'g'), replace);
}

/**
 *
 * @param {String} baseDir
 * @param {String[]|String} args
 * @return {String}
 */
const constructChildPath = function (baseDir, args) {
    if (!isString(baseDir)) {
        throw new Error("baseDir arg should be string: " + baseDir);
    }
    let constructed;
    const argsType = getObjectType(args);
    switch (argsType) {
        case "String":
            constructed = path.join(baseDir, args);
            break;
        case "Array":
            const theArray = args;
            theArray.splice(0, 0, baseDir);
            constructed = path.join.apply(undefined, theArray);
            break;
        case "Arguments":
            throw new Error("Arguments not supported for args");
        default:
            throw new Error("Unknown or missing args; type=" + argsType + ": " + args);
    }
    logger.debug('constructed: ' + constructed);
    return constructed;

};

module.exports = {
    constructChildPath:constructChildPath,
    encryptDXSync:encryptDXSync,
    decryptDXSync:decryptDXSync,
    createShuffled:createShuffled,
    findAllIndexesOf:findAllIndexesOf,
    // Placeholder: utils.Placeholder,
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
    checksum:checksum,
    formatByteSize:formatByteSize,
    zeroPrefixPositions:zeroPrefixPositions,
    sizeFormatters: byteSizeFormatters,
    startsWith:startsWith,
    replaceAll: replaceAll,
    endsWith:endsWith,
    isRelativePath:isRelativePath,
    createLogger : function(args){
        return new Logger(args);
    },
    sortString: sortString,
    replaceTextFragment: function (content, fragment, replacement, startIdx){
        let start = 0;
        if(typeof startIdx === 'number'){
            start = startIdx;
        }
        const crit = fragment;
        const idx = content.indexOf(crit, start);
        const head = content.substring(0, idx);
        const tail = content.substring(idx + crit.length);
        return head + replacement + tail;
    },
    findLatestMod : function(entryFilePath, deps){
        const latestDate = new Date();
        latestDate.setYear(1983);
        let latest = latestDate.getTime();
        let st = fs.statSync(entryFilePath);
        let atime = st.ctime.getTime();
        if(latest < atime){
            latest = atime;
        }
        const dirMods = {};
        function processPath(dp){
            const dirPath = path.dirname(dp);
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
                Object.keys(deps).forEach(function(depPath){
                    processPath(depPath);
                });
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
        const r = new RegExp(quoteRegexpLiteral(search), 'g');
        return (str.match(r) || []).length;
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
    capitalize: function(str){
        return str.substring(0,1).toUpperCase() + str.substring(1);
    },
    correctCommentClosings:function correctCommentClosings(markup){
        let m = markup;
        let l = m.lastIndexOf('-->');
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
        let count = 0;
        for(let k in obj){
            if(obj.hasOwnProperty(k)){
                count += 1;
            }
        }
        return count;
    },
    setLoggingLevel: function(level){
        Logger.level = level;
    },
    unquote:unquote,
    shuffleArray:shuffleArray,
    randomArrayIndex:randomArrayIndex,
    HttpRequestOptions:HttpRequestOptions,
    downloadJsonpData:downloadJsonpData,
    getEquivalentFilepath:getEquivalentFilepath,
    doesEquivalentFilePathExist:doesEquivalentFilePathExist,
    randomInt:randomInt,
    downloadHttpTextualData:downloadHttpTextualData,
    relativize:relativize,
    listChildDirectoryPaths:listChildDirectoryPaths,
    isFunction:isFunction

};