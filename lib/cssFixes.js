var utils = require("./utils");
var bless = require("bless");

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