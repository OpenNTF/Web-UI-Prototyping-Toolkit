let jade;
const utils = require("./utils");
const fs = require("./filesystem");
const tfs = require("fs");

function loadJade(){
    if(!jade){
        jade = require("jade");
    }
}

const fileCache = {
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
    loadJade();
    let isCached = fileCache.hasOwnProperty(jadeFilePath);
    const lastMod = utils.findLatestMod(jadeFilePath, isCached ? fileCache[jadeFilePath].dependencies : []);
    let out;
    if(!isCached || lastMod > fileCache[jadeFilePath].lastModified){
        let to = options;
        if(!options){
            to = {};
        }
        to.pretty = "    ";
        to.filename = jadeFilePath;
        if(typeof jadeMarkup !== 'string'){
            jadeMarkup = utils.readTextFileSync(jadeFilePath);
        }
        const cmpFile = jade.compile(jadeMarkup, to);
        const html = cmpFile();
        out = utils.correctCommentClosings(html);
        fileCache[jadeFilePath] = {
            markup : out,
            lastModified : lastMod,
            dependencies : cmpFile.dependencies
        };
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
    const html = compileJadeFile(jadeFilePath, options);
    const jadeHtmlPath = jadeFilePath.substring(0, jadeFilePath.lastIndexOf('.')) + ".html";
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
    const compiledFilePaths = [];
    jadeTemplatePaths.forEach(function(tp){
        console.log("Compiling JADE " + tp + "...");
        const out = jadeFileToHtmlFile(tp);
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
    const deletedPaths = [];
    jadeTemplatePaths.forEach(function(tp){
        const htmlEquiv = tp.substring(0, tp.lastIndexOf(".")) + ".html";
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