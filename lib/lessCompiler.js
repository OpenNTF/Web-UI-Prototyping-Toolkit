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
var less = require("less");
var path = require("path");
var utils = require("./utils");
var fs = require("../node_modules/less/lib/less/fs");
var deferred = require("deferred");
var logger = utils.createLogger({sourceFilePath : __filename});

function CssWriter(idx, filename, response, mode){
    this.mode = 'css';
    if(typeof mode === 'string'){
        this.mode = mode;
    }
    this.idx = idx;
    this.filename = filename;
    this.response = response;
    this.done = false;
    this.css = undefined;
    this.cssMap = undefined;
    this.dependencies = undefined;
    this.acceptCss = function(css, cssmap, deps){
        this.css = css;
        this.cssMap = cssmap;
        this.dependencies = deps;
        this.done = true;
    };
    this.writeCss = function(){
        if(this.mode === 'css'){
            this.response.writeHead(200, {"Content-Type": "text/css; charset=utf-8"});
            this.response.write("" + this.css);
            this.response.end();
        }else if(this.mode === 'cssmap'){
            this.writeCssMap();
        }else if(this.mode === 'deps'){
            this.writeDependencies();
        }

    };
    this.writeCssMap = function(){
        this.response.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
        this.response.write("" + this.cssMap);
        this.response.end();
    };
    this.writeDependencies= function(){
        this.response.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
        this.response.write(JSON.stringify(this.dependencies));
        this.response.end();
    };
}


var createDefaultOptions = function(){
    var options = {
        depends: false,
        compress: false,
        cleancss: false,
        max_line_len: -1,
        optimization: 1,
        silent: false,
        verbose: false,
        lint: false,
        paths: [],
        color: true,
        strictImports: false,
        insecure: false,
        rootpath: '',
        relativeUrls: false,
        ieCompat: true,
        strictMath: false,
        strictUnits: false,
        globalVariables: '',
        modifyVariables: '',
        urlArgs: ''
    };
    return options;
};

var checkArgFunc = function(arg, option) {
    if (!option) {
        throw new Error(arg + " option requires a parameter");
    }
    return true;
};

var checkBooleanArg = function(arg) {
    var onOff = /^((on|t|true|y|yes)|(off|f|false|n|no))$/i.exec(arg);
    if (!onOff) {
        throw new Error(" unable to parse "+arg+" as a boolean. use one of on/t/true/y/yes/off/f/false/n/no");
    }
    return Boolean(onOff[2]);
};

var parseVariableOption = function(option) {
    var parts = option.split('=', 2);
    return '@' + parts[0] + ': ' + parts[1] + ';\n';
};

var processArg = function(arg, options, cleancssOptions){
    switch (arg) {
        case 'v':
        case 'version':
            throw new Error("lessc " + less.version.join('.') + " (Less Compiler) [JavaScript]");
        case 'verbose':
            options.verbose = true;
            break;
        case 's':
        case 'silent':
            options.silent = true;
            break;
        case 'l':
        case 'lint':
            options.lint = true;
            break;
        case 'strict-imports':
            options.strictImports = true;
            break;
        case 'h':
        case 'help':
            require('../lib/less/lessc_helper').printUsage();
            throw new Error("Help")
        case 'x':
        case 'compress':
            options.compress = true;
            break;
        case 'insecure':
            options.insecure = true;
            break;
        case 'M':
        case 'depends':
            options.depends = true;
            break;
        case 'clean-css':
            options.cleancss = true;
            break;
        case 'max-line-len':
            if (checkArgFunc(arg, match[2])) {
                options.maxLineLen = parseInt(match[2], 10);
                if (options.maxLineLen <= 0) {
                    options.maxLineLen = -1;
                }
            }
            break;
        case 'no-color':
            options.color = false;
            break;
        case 'no-ie-compat':
            options.ieCompat = false;
            break;
        case 'no-js':
            options.javascriptEnabled = false;
            break;
        case 'include-path':
            if (checkArgFunc(arg, match[2])) {
                options.paths = match[2].split(os.type().match(/Windows/) ? ';' : ':')
                    .map(function(p) {
                        if (p) {
                            return path.resolve(process.cwd(), p);
                        }
                    });
            }
            break;
        case 'O0': options.optimization = 0; break;
        case 'O1': options.optimization = 1; break;
        case 'O2': options.optimization = 2; break;
        case 'line-numbers':
            if (checkArgFunc(arg, match[2])) {
                options.dumpLineNumbers = match[2];
            }
            break;
        case 'source-map':
            if (!match[2]) {
                options.sourceMap = true;
            } else {
                options.sourceMap = match[2];
            }
            break;
        case 'source-map-rootpath':
            if (checkArgFunc(arg, match[2])) {
                options.sourceMapRootpath = match[2];
            }
            break;
        case 'source-map-basepath':
            if (checkArgFunc(arg, match[2])) {
                options.sourceMapBasepath = match[2];
            }
            break;
        case 'source-map-map-inline':
            options.sourceMap = true;
            options.sourceMapFileInline = true;
            break;
        case 'source-map-less-inline':
            options.outputSourceFiles = true;
            break;
        case 'source-map-url':
            if (checkArgFunc(arg, match[2])) {
                options.sourceMapURL = match[2];
            }
            break;
        case 'rp':
        case 'rootpath':
            if (checkArgFunc(arg, match[2])) {
                options.rootpath = match[2].replace(/\\/g, '/');
            }
            break;
        case "ru":
        case "relative-urls":
            options.relativeUrls = true;
            break;
        case "sm":
        case "strict-math":
            if (checkArgFunc(arg, match[2])) {
                options.strictMath = checkBooleanArg(match[2]);
            }
            break;
        case "su":
        case "strict-units":
            if (checkArgFunc(arg, match[2])) {
                options.strictUnits = checkBooleanArg(match[2]);
            }
            break;
        case "global-var":
            if (checkArgFunc(arg, match[2])) {
                options.globalVariables += parseVariableOption(match[2]);
            }
            break;
        case "modify-var":
            if (checkArgFunc(arg, match[2])) {
                options.modifyVariables += parseVariableOption(match[2]);
            }
            break;
        case "clean-option":
            var cleanOptionArgs = match[2].split(":");
            switch(cleanOptionArgs[0]) {
                case "--keep-line-breaks":
                case "-b":
                    cleancssOptions.keepBreaks = true;
                    break;
                case "--s0":
                    cleancssOptions.keepSpecialComments = 0;
                    break;
                case "--s1":
                    cleancssOptions.keepSpecialComments = 1;
                    break;
                case "--skip-advanced":
                    cleancssOptions.noAdvanced = true;
                    break;
                case "--advanced":
                    cleancssOptions.noAdvanced = false;
                    break;
                case "--compatibility":
                    cleancssOptions.compatibility = cleanOptionArgs[1];
                    break;
                default:
                    logger.info("unrecognised clean-css option '" + cleanOptionArgs[0] + "'");
                    logger.info("we support only arguments that make sense for less, '--keep-line-breaks', '-b'");
                    logger.info("'--s0', '--s1', '--advanced', '--skip-advanced', '--compatibility'");
                    throw new Error("Incorrect usage");
            }
            break;
        case 'url-args':
            if (checkArgFunc(arg, match[2])) {
                options.urlArgs = match[2];
            }
            break;
        default:
            require('../lib/less/lessc_helper').printUsage();
            throw new Error("Incorrect usage");
    }

};
function createServerSideLessCompiler(basePath, lessParserAdditionalArgsFn) {
    var sslc = {
        lessParserAdditionalArgsFn: lessParserAdditionalArgsFn,
        lessFilePathsBeingCompiled: {},
        nextCallIdx: 1,
        handleCompileLessCss: function (filename, file, response) {
            var callIdx = sslc.nextCallIdx;
            sslc.nextCallIdx += 1;
            var finishedCompilingCss = function (css, sourceMap, deps) {
                var callbacks = sslc.lessFilePathsBeingCompiled[filename];
                delete sslc.lessFilePathsBeingCompiled[filename];
                var cbc = callbacks.length;
                while (callbacks.length > 0) {
                    var cb = callbacks[0];
                    callbacks.splice(0, 1);
                    cb.acceptCss(css, sourceMap, deps);
                    cb.writeCss();
                }
                logger.debug("Served " + cbc + " requests for " + filename);
            };
            if (sslc.lessFilePathsBeingCompiled.hasOwnProperty(filename)) {
                var callbacks = sslc.lessFilePathsBeingCompiled[filename];
                callbacks.push(new CssWriter(callIdx, filename, response, 'css'));
            } else {
                sslc.lessFilePathsBeingCompiled[filename] = [];
                sslc.lessFilePathsBeingCompiled[filename].push(new CssWriter(callIdx, filename, response, 'css'));
                compile(filename, [path.join(filename, "../")], '' + file, basePath, finishedCompilingCss, undefined, sslc.lessParserAdditionalArgsFn());
            }
        },
        handleCompileLessCssMap: function (filename, file, response) {
            var callIdx = sslc.nextCallIdx;
            sslc.nextCallIdx += 1;
            var finishedCompilingCssMap = function (css, sourceMap, deps) {
                var callbacks = sslc.lessFilePathsBeingCompiled[filename];
                delete sslc.lessFilePathsBeingCompiled[filename];
                var cbc = callbacks.length;
                while (callbacks.length > 0) {
                    var cb = callbacks[0];
                    callbacks.splice(0, 1);
                    cb.acceptCss(css, sourceMap, deps);
                    cb.writeCss();
                }
                logger.info("Served " + cbc + " requests for " + filename);
            };
            if (sslc.lessFilePathsBeingCompiled.hasOwnProperty(filename)) {
                var callbacks = sslc.lessFilePathsBeingCompiled[filename];
                callbacks.push(new CssWriter(callIdx, filename, response, 'cssmap'));
            } else {
                sslc.lessFilePathsBeingCompiled[filename] = [];
                sslc.lessFilePathsBeingCompiled[filename].push(new CssWriter(callIdx, filename, response, 'cssmap'));
                compile(filename, [path.join(filename, "../")], '' + file, basePath, finishedCompilingCssMap);
            }
        }
    };
    return sslc;
}
function listDependencies(lessFilePath, fileContents, callBack){

    var baseDir = path.dirname(lessFilePath);
    var cssName = lessFilePath.substring(0, lessFilePath.lastIndexOf(".")) + ".css";
    var parserConfig = { depends: true,
        compress: false,
        cleancss: false,
        max_line_len: -1,
        optimization: 1,
        silent: true,
        verbose: false,
        lint: false,
        paths: [ baseDir ],
        color: false,
        strictImports: false,
        insecure: false,
        rootpath: '',
        relativeUrls: false,
        ieCompat: true,
        strictMath: false,
        strictUnits: false,
        globalVariables: '',
        modifyVariables: '',
        urlArgs: '',
        sourceMapOutputFilename: cssName,
        sourceMapBasepath: baseDir,
        filename: lessFilePath
    };
    var start = new Date().getTime();
    var parser = new less.Parser(parserConfig);
    parser.parse('' + fileContents, function (err, tree) {
        var done = new Date().getTime();
        logger.info("Analyzed deps in " + (done - start) + "ms");
        var lessDepPaths = [];
        for(var fp in parser.imports.files){
            lessDepPaths.push(fp);
        }
        logger.info("Parsed dependencies: ", lessDepPaths);
        if(typeof callBack === 'function'){
            callBack(lessDepPaths, lessFilePath);
        }
    });
}

var compiledLessCache = {
    /* Example entry:

    entryFilePath : {
        latestMod : mtime,
        deps : [],
        css : css,
        cssmap : cssmap

    }

     */
};

var cacheCompiledLess = function(cacheKey, entryFilePath, css, cssmap, deps){
    compiledLessCache[cacheKey] = {
        latestMod : utils.findLatestMod(entryFilePath, deps),
        deps : deps,
        css : css,
        cssmap : cssmap
    };
};

var createKey = function(lessFilePath, lessParentDirs,  basePath, additionalParserArgs){
    var key = lessFilePath + "_" + lessParentDirs.join("_") + "_" + basePath;
    if(additionalParserArgs){
        for(var levelOneKey in additionalParserArgs){
            var levelOneVal = additionalParserArgs[levelOneKey];
            if(typeof levelOneVal !== 'object'){
                key += "_" + levelOneKey + "_" + levelOneVal;
            }else{
                for(var levelTwoKey in levelOneVal){
                    key += "_" + levelOneKey + "." + levelTwoKey + "=" + levelOneVal[levelTwoKey];
                }
            }
        }
    }
    return key;
};


function compilePromise(lessFilePath, lessParentDirs, fileContents, basePath, additionalParserArgs) {
    console.log("LESS COMPILE PROMISE : " + lessFilePath);
    return function(lessFilePath, lessParentDirs, fileContents, basePath, additionalParserArgs){
        var def = deferred();
        var cacheKey = createKey(lessFilePath, lessParentDirs, basePath, additionalParserArgs);
        //var writeFiles = false;
        var ready = false;
        if(compiledLessCache.hasOwnProperty(cacheKey)){
            var cached = compiledLessCache[cacheKey];
            var newLatest = utils.findLatestMod(lessFilePath, cached.deps);
            if(newLatest <= cached.latestMod){
                logger.debug("Using smart cached less output for " + lessFilePath + "   cacheKey="+cacheKey);
                def.resolve(cached.css, cached.cssmap, cached.deps);
                ready = true;


            }
        }
        if(ready){
            return def.promise;
        }
        logger.debug("Compiling " + lessFilePath + " ...");
        var cssFilePath = lessFilePath.substring(0, lessFilePath.lastIndexOf(".")) + ".css";
        var cssFilename = path.basename(cssFilePath);
        var write = false;

        var sourceMapName = cssFilename + ".map";
//        var sourceMapURL = cssFilePath.substring(basePath.length) + ".map";
        var sourceMapURL = './' +sourceMapName; //cssFilePath.substring(basePath.length) + ".map";
        var compiledSourceMap, compiledCss;
        var parserArgs = {
            depends: true,
            compress: false,
            cleancss: false,
            max_line_len: -1,
            optimization: 1,
            silent: false,
            verbose: true,
            lint: false,
            paths: lessParentDirs,
            color: false,
            strictImports: false,
            insecure: false,
            relativeUrls: true,
            ieCompat: true,
            strictMath: false,
            strictUnits: false,
//            globalVariables: '@themeNameDynamic:"amelia"',
//            modifyVariables: '@themeName:@themeNameDynamic',
            globalVars: {'themeName':'amelia'},
            modifyVars: {'themeName':'amelia'},
            urlArgs: '',
            outputSourceFiles: true,
//            sourceMapURL : sourceMapURL,
            sourceMapURL : sourceMapURL,
            sourceMappingURL : sourceMapURL,
            sourceMap: sourceMapName,
            sourceMapBasepath: basePath,
            filename: lessFilePath,
            writeSourceMap: function (output) {
                //compiledSourceMap = output;
                //var filename = sourceMapName;
                //
                //if(write){
                //    logger.info("Writing source map to  "+ filename + " : "+utils.formatByteSize((output+"").length));
                //    fs.writeFile(filename, output, 'utf8');
                //}
                console.log("not writing source map");
            }
        };
        var parserConfig = parserArgs;
        var toCssArgs = { silent: false,
            verbose: true,
            ieCompat: true,
            compress: false,
            relativeUrls: true,
            cleancss: false,
            cleancssOptions: {},
            sourceMap: true,
            sourceMapFilename: sourceMapName,
//            sourceMapURL : sourceMapURL,
            sourceMapURL : sourceMapURL,
            sourceMappingURL : sourceMapURL,
            sourceMapOutputFilename: undefined,
            sourceMapBasepath: basePath,
            sourceMapRootpath: '',
            outputSourceFiles: true,
            writeSourceMap: parserArgs.writeSourceMap,
            maxLineLen: undefined,
            strictMath: false,
            strictUnits: false,
            urlArgs: ''
        };
        try {
            var start = new Date().getTime();
            logger.debug("Parsing lesscss " + lessFilePath + " with args:", parserConfig);
            var parser = new less.Parser(parserConfig);
            parser.parse(fileContents, function (err, tree) {
                if(err){
                    try{
                        throw err;
                    }catch(e){
                        logger.error("lesscss parsing error while parsing " + lessFilePath, err.stack);
                        //console.trace(e);
                        logger.error("lesscss parsing error " + err.filename+":" + err.line + " " + err.extract);
                    }
                    //successFunction('body{background-color:#FF0000 !important;}', '', []);
                    def.reject(err);
                }else{
                    try {
                        var lessDepPaths = [];
                        for(var fp in parser.imports.files){
                            lessDepPaths.push(fp);
                        }
                        logger.debug("Creating css from parsed lesscss for" + lessFilePath + " with args:", toCssArgs);
                        var csscode = tree.toCSS(toCssArgs);
                        compiledCss = csscode;
                        var taken = (new Date().getTime() - start);
                        cacheCompiledLess(cacheKey, lessFilePath, csscode, compiledSourceMap, lessDepPaths);
                        logger.info("Compiled "+lessFilePath+" in " + taken + "ms");
                        def.resolve(csscode, compiledSourceMap, lessDepPaths);
                    } catch (ParseToCssError) {
                        logger.error("Could not parse to css " + lessFilePath, ParseToCssError.stack);
                        //console.trace(ParseToCssError);
                        def.reject(ParseToCssError);
                        //successFunction('body{background-color:#FF0000 !important;}', '', []);
                        //throw new Error(ParseToCssError);
                    }

                }
            }, additionalParserArgs);
        } catch (LessCompilerError) {
            logger.error("LESS COMPILER ERROR FOR " + lessFilePath, LessCompilerError.stack);

            var lce = LessCompilerError;
            logger.error(lce.type + " error in " + lce.filename + ":"+lce.line+","+lce.column+" :  " + lce.message);
            def.reject(LessCompilerError);
//            //console.trace(LessCompilerError);
////            throw LessCompilerError;
//            successFunction('body{background-color:#FF0000 !important;}', '', []);
        }
        return def.promise;
    }(lessFilePath, lessParentDirs, fileContents, basePath, additionalParserArgs);

}













function compile(lessFilePath, lessParentDirs, fileContents, basePath, successFunction, writeFiles, additionalParserArgs) {
    var cacheKey = createKey(lessFilePath, lessParentDirs, basePath, additionalParserArgs);
    if(compiledLessCache.hasOwnProperty(cacheKey)){
        var cached = compiledLessCache[cacheKey];
        var newLatest = utils.findLatestMod(lessFilePath, cached.deps);
        if(newLatest <= cached.latestMod){
            logger.debug("Using smart cached less output for " + lessFilePath + "   cacheKey="+cacheKey);
            if (typeof successFunction === 'function') {
                try {
                    successFunction(cached.css, cached.cssmap, cached.deps);
                    return;
                } catch (SuccessFunctionError) {
                    logger.error("Error in successFunction", SuccessFunctionError.stack);
                    throw new Error(SuccessFunctionError);
                }
            }
            return;
        }
    }
    logger.debug("Compiling " + lessFilePath + " ...");
    var cssFilePath = lessFilePath.substring(0, lessFilePath.lastIndexOf(".")) + ".css";
    var cssFilename = path.basename(cssFilePath);
    var write = false;
    if(writeFiles){
        write = true;
    }
    var sourceMapName = cssFilename + ".map";
//        var sourceMapURL = cssFilePath.substring(basePath.length) + ".map";
    var sourceMapURL = './' +sourceMapName; //cssFilePath.substring(basePath.length) + ".map";
    var compiledSourceMap, compiledCss;
    var parserArgs = {
        depends: true,
        compress: false,
        cleancss: false,
        max_line_len: -1,
        optimization: 1,
        silent: false,
        verbose: true,
        lint: false,
        paths: lessParentDirs,
        color: false,
        strictImports: false,
        insecure: false,
        relativeUrls: true,
        ieCompat: true,
        strictMath: false,
        strictUnits: false,
//            globalVariables: '@themeNameDynamic:"amelia"',
//            modifyVariables: '@themeName:@themeNameDynamic',
        globalVars: {'themeName':'amelia'},
        modifyVars: {'themeName':'amelia'},
        urlArgs: '',
        outputSourceFiles: true,
//            sourceMapURL : sourceMapURL,
        sourceMapURL : sourceMapURL,
        sourceMappingURL : sourceMapURL,
        sourceMap: sourceMapName,
        sourceMapBasepath: basePath,
        filename: lessFilePath,
        writeSourceMap: function (output) {
            compiledSourceMap = output;
            var filename = sourceMapName;

            if(write){
                logger.info("Writing source map to  "+ filename + " : "+utils.formatByteSize((output+"").length));
                fs.writeFile(filename, output, 'utf8');
            }
        }
    };
    var parserConfig = parserArgs;
    var toCssArgs = { silent: false,
        verbose: true,
        ieCompat: true,
        compress: false,
        relativeUrls: true,
        cleancss: false,
        cleancssOptions: {},
        sourceMap: true,
        sourceMapFilename: sourceMapName,
//            sourceMapURL : sourceMapURL,
        sourceMapURL : sourceMapURL,
        sourceMappingURL : sourceMapURL,
        sourceMapOutputFilename: undefined,
        sourceMapBasepath: basePath,
        sourceMapRootpath: '',
        outputSourceFiles: true,
        writeSourceMap: parserArgs.writeSourceMap,
        maxLineLen: undefined,
        strictMath: false,
        strictUnits: false,
        urlArgs: ''
    };
    try {
        var start = new Date().getTime();
        logger.debug("Parsing lesscss " + lessFilePath + " with args:", parserConfig);
        var parser = new less.Parser(parserConfig);
        parser.parse(fileContents, function (err, tree) {
            if(err){
                try{
                    throw err;
                }catch(e){
                    logger.error("lesscss parsing error while parsing " + lessFilePath, err.stack);
                    //console.trace(e);
                    logger.error("lesscss parsing error " + err.filename+":" + err.line + " " + err.extract);
                }
                successFunction('body{background-color:#FF0000 !important;}', '', []);
            }else{
                try {
                    var lessDepPaths = [];
                    for(var fp in parser.imports.files){
                        lessDepPaths.push(fp);
                    }
                    logger.debug("Creating css from parsed lesscss for" + lessFilePath + " with args:", toCssArgs);
                    var csscode = tree.toCSS(toCssArgs);
                    compiledCss = csscode;
                    var taken = (new Date().getTime() - start);
                    logger.info("Compiled "+lessFilePath+" in " + taken + "ms");
                    if(write){
                        logger.info("Writing css to  "+ cssFilePath + " : "+utils.formatByteSize((compiledCss+"").length));
                        fs.writeFile(cssFilePath, compiledCss+"");
                        fs.writeFile(cssFilePath+".map", compiledSourceMap+"");
                    }

                    if (typeof successFunction === 'function') {
                        try {
                            successFunction(csscode, compiledSourceMap, lessDepPaths);
                        } catch (SuccessFunctionError) {
                            logger.error("Error in successFunction", SuccessFunctionError.stack);
                            //console.trace(SuccessFunctionError);
                            throw new Error(SuccessFunctionError);
                        }
                    }
                    cacheCompiledLess(cacheKey, lessFilePath, csscode, compiledSourceMap, lessDepPaths);
                } catch (ParseToCssError) {
                    logger.error("Could not parse to css " + lessFilePath, ParseToCssError.stack);
                    //console.trace(ParseToCssError);
                    successFunction('body{background-color:#FF0000 !important;}', '', []);
                    //throw new Error(ParseToCssError);
                }

            }
        }, additionalParserArgs);
    } catch (LessCompilerError) {
        logger.error("LESS COMPILER ERROR FOR " + lessFilePath, LessCompilerError.stack);
        var lce = LessCompilerError;
        logger.error(lce.type + " error in " + lce.filename + ":"+lce.line+","+lce.column+" :  " + lce.message);
        //console.trace(LessCompilerError);
//            throw LessCompilerError;
        successFunction('body{background-color:#FF0000 !important;}', '', []);
    }
}


module.exports = {
    createServerSideLessCompiler: createServerSideLessCompiler,

    createCssWriter: function(idx, filename, response, mode){
        return new CssWriter(idx, filename, response, mode);
    },

    /**
     * Lists all files that are included from passed lessFilePath when compiling
     * Accepts callback fn(depPathsArray, lessFilePath)
     * @param lessFilePath
     * @param fileContents
     * @param callBack
     */
    listDependencies : listDependencies,

    compile: compile,
    compilePromise:compilePromise
};

