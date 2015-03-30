var jade = require("jade");
var utils = require("./utils");

function compileJade(jadeFilePath, jadeMarkup, options){
    var to = options;
    if(!options){
        to = {};
    }
    to.filename = jadeFilePath
    var html = jade.render(jadeMarkup, to);
    var o = utils.correctCommentClosings(html);
    return o;
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