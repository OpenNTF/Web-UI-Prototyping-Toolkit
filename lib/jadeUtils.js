var jade = require("jade");
var utils = require("./utils");
var fs = require("./filesystem");
var tfs = require("fs");

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

/**
 *
 * @param {String} jadeFilePath
 * @param {String|null} jadeMarkup
 * @param [options]
 * @return {String}
 */
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
        if(typeof jadeMarkup !== 'string'){
            jadeMarkup = utils.readTextFileSync(jadeFilePath);
        }
        var cmpFile = jade.compile(jadeMarkup, to);
        var html = cmpFile();
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

/**
 *
 * @param {String} jadeFilePath
 * @param {String|undefined} [jadeMarkup]
 * @param [options]
 * @return {String}
 */
function compileJade(jadeFilePath, jadeMarkup, options){
    return internalCompile(jadeFilePath, jadeMarkup, options);
}

/**
 * @param {String} jadeFilePath
 * @param [options]
 * @return {{html: String, path: String}}
 */
function compileJadeFile(jadeFilePath, options){

    return compileJade(jadeFilePath, undefined, options);

}

/**
 * @param {String} jadeFilePath
 * @param [options]
 * @return {{html: String, path: String}}
 */
function jadeFileToHtmlFile(jadeFilePath, options){
    var html = compileJadeFile(jadeFilePath, options);
    var jadeHtmlPath = jadeFilePath.substring(0, jadeFilePath.lastIndexOf('.')) + ".html";
    utils.writeFile(jadeHtmlPath, html);
    return {
        html:html,
        path:jadeHtmlPath
    };
}
/**
 * @param {String[]} jadeTemplatePaths
 * @return {String[]}
 */
function compileTemplatesToFiles(jadeTemplatePaths){
    var compiledFilePaths = [];
    jadeTemplatePaths.forEach(function(tp){
        console.log("Compiling JADE " + tp + "...");
        var out = jadeFileToHtmlFile(tp);
        console.info("Compiled " + tp + " => " + out.path);
        compiledFilePaths.push(out.path);
    });
    return compiledFilePaths;
}
/**
 *
 * @param {String[]} jadeTemplatePaths
 * @return {String[]}
 */
function deleteCompiledFilesForTemplates(jadeTemplatePaths){
    var deletedPaths = [];
    jadeTemplatePaths.forEach(function(tp){
        var htmlEquiv = tp.substring(0,tp.lastIndexOf("."))+".html";
        if(tfs.existsSync(htmlEquiv) && tfs.statSync(htmlEquiv).isFile()){
            console.info("Deleting compiled html for JADE template " + tp + " : " + htmlEquiv);
            fs.unlink(htmlEquiv);
            deletedPaths.push(htmlEquiv);
        }
    });
    return deletedPaths;
}

module.exports = {
    compileJade:compileJade,
    compileJadeFile:compileJadeFile,
    jadeFileToHtmlFile:jadeFileToHtmlFile,
    compileTemplatesToFiles:compileTemplatesToFiles,
    deleteCompiledFilesForTemplates:deleteCompiledFilesForTemplates
};