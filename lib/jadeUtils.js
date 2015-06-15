var jade = require("jade");
var utils = require("./utils");
var fs = require("./filesystem");

var fileCache = {
    /*
    Example:

    '/file/path.jade' : {
         output: '<html.. ',
         dependencies: [],
         lastModified: 1235834556
    }
     */
};

function internalCompile(jadeFilePath, jadeMarkup, options){
    var isCached = fileCache.hasOwnProperty(jadeFilePath);
    var lastMod = utils.findLatestMod(jadeFilePath, isCached ? fileCache[jadeFilePath].dependencies : []);
    var out;
    if(!isCached || lastMod > fileCache[jadeFilePath].lastModified){
        var to = options;
        if(!options){
            to = {};
        }
        to.pretty = "    ";
        to.filename = jadeFilePath;
        var cmpFile = jade.compileClientWithDependenciesTracked(jadeMarkup, to);
        console.log("COMPILED DEPS = ", cmpFile.dependencies);
        var html = jade.render(jadeMarkup, to);
        out = utils.correctCommentClosings(html);
        fileCache[jadeFilePath] = {
            markup : out,
            lastModified : lastMod,
            dependencies : cmpFile.dependencies
        }
    }else{
        out = fileCache[jadeFilePath].markup;
    }
    return out;

}

function compileJade(jadeFilePath, jadeMarkup, options){
    return internalCompile(jadeFilePath, jadeMarkup, options);
}
function compileJadeFile(jadeFilePath, options){
    var file = utils.readTextFileSync(jadeFilePath);
    var html = compileJade(jadeFilePath, file, options);
    return html;

}
function jadeFileToHtmlFile(jadeFilePath, options){
    var html = compileJadeFile(jadeFilePath, options);
    var jadeHtmlPath = jadeFilePath.substring(0, jadeFilePath.lastIndexOf('.')) + ".html";
    utils.writeFile(jadeHtmlPath, html);
    return {
        html:html,
        path:jadeHtmlPath
    };
}

module.exports = {
    compileJade:compileJade,
    compileJadeFile:compileJadeFile,
    jadeFileToHtmlFile:jadeFileToHtmlFile
};