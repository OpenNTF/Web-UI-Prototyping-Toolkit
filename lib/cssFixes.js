var utils = require("./utils");
var bless = require("bless");
var uncss = require("uncss");
var cssFixes = exports;

cssFixes.splitCSSForIE = function(cssFilename, cssString, blessedPostfix, options, cb){
    if(typeof cssFilename !== 'string' || !utils.endsWith(cssFilename, '.css')){
        throw new Error("cssFilename must be a filename ending with .css");
    }
    if(typeof cssString !== 'string'){
        throw new Error("css must be string: " + cssString);
    }

    if(typeof blessedPostfix !== 'string'){
        blessedPostfix = '';
    }
    if(typeof options !== 'object'){
        options = {};
    }
    if(typeof cb !== 'function'){
        throw new Error("cb should be a node callback function (err, files, selectorCount)");
    }
    if(!options.hasOwnProperty("cleanup")){
        options.cleanup = true;
    }
    if(!options.hasOwnProperty("compress")){
        options.compress = false;
    }
    if(!options.hasOwnProperty("imports")){
        options.imports = true;
    }
    var p = new (bless.Parser)({
        output: cssFilename.substring(0, cssFilename.lastIndexOf(".")) + blessedPostfix + '.css',
        options: options

    });
    p.parse(cssString, function(err, files, selCount) {
        if (err) {
            console.error("Error: ", arguments);
        } else {
            console.log("Finished: " + cssFilename + " has " + selCount + " selectors so split (or not) into " + files.length  + " files");
        }
        cb(err, files, selCount);
    })
};

/**
 *
 * @param {String[]} files
 * @param {{ignore?: Array, media?: String[], csspath?: String, raw?: String,  timeout?: Number, htmlroot?: String, report?: boolean, uncssrc?:String, stylesheets?: String[], ignoreSheets?: String[]}} [options]
 * @param {Function} cb
 */
cssFixes.removeUnusedCss = function(files, options, cb){
    if(!files || !files.hasOwnProperty('length') || typeof files[0] !== 'string'){
        throw new Error("missing files which must be an array of strings of filepaths and/or urls")
    }
    files.forEach(function(f){
        if(f.trim().length < 2){
            throw new Error("illegal file path or url : " + f);
        }
    });
    if(typeof cb !== 'function'){
        throw new Error("you must provide a callback");
    }
    //var defOpts = {
    //    //ignore       : ['#added_at_runtime', /test\-[0-9]+/],
    //    //media        : ['(min-width: 700px) handheld and (orientation: landscape)'],
    //    //csspath      : '../public/css/',
    //    //raw          : 'h1 { color: green }',
    //    stylesheets  : ['/styles.css'],
    //    //ignoreSheets : [/fonts.googleapis/],
    //    timeout      : 1000,
    //    htmlroot     : fd,
    //    report       : true,
    //    //uncssrc      : '.uncssrc'
    //};



    uncss(files, options ,function (error, output, rep) {
        if(error){
            cb(error);
        }else{
            cb(undefined, output, rep);
        }
    });
};