"use strict";

var path = require("path");
var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var projectDir = rc.runtime.constructProjectPath("");
    var files = rc.project.listAllTemplatePaths();
    function shortenPath(p){
        return p.substring(projectDir.length+1);
    }
    function sortObjectKeys(obj){
        var keys = Object.keys(obj).sort();
        var o = {};
        keys.forEach(function(k){
            o[k] = obj[k];
            console.log("Adding KEY="+k);
        });
        return o;
    }
    files.forEach(function (filePath) {
        var fileContents = rc.runtime.readFile(filePath);
        var fileName = path.basename(filePath);

        try{
            var composed = rc.composer.composeTemplate(filePath, fileContents);
            var baseFilePath = path.dirname(filePath) + "/" + fileName.substring(0, fileName.lastIndexOf('.'));
            var responsePath = baseFilePath + '-compiled.html';
            rc.runtime.writeFile(responsePath, composed.content);

            composed.metadata.include.headScript.sort();
            composed.metadata.include.script.sort();
            composed.metadata.include.style.sort();
            var oldDeps = composed.metadata.deps;
            composed.metadata.deps = {};
            composed.metadata.deps = sortObjectKeys(oldDeps);
            var meta = {
                templatePath : shortenPath(composed.metadata.templatePath),
                headScripts: ([].concat(composed.metadata.include.headScript)).map(shortenPath).sort(),
                styles: ([].concat(composed.metadata.include.headScript)).map(shortenPath).sort(),
                scripts: ([].concat(composed.metadata.include.headScript)).map(shortenPath).sort(),
                dependencies: Object.keys(composed.metadata.deps).map(shortenPath).sort()
            };
            var metaDataJson = JSON.stringify(meta, null, '\t');
            rc.runtime.writeFile(baseFilePath+"-meta.json", metaDataJson);
            logger.info("Wrote compiled version to " + responsePath);
        }catch(CompilationError){
            logger.error("Could not compile " + fileName + " with contents: " + fileContents, CompilationError.stack);
            //console.trace(CompilationError);
            logger.warn("Skipping " + fileName + " from back compilation.");
        }
    });
    var hp = rc.project.htmlProducer; //createHtmlProducer(project);
    var out = hp.createCompiledMarkup(files) + rc.project.readViewScriptsMarkup();
    rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdCompileAll.html');
    rc.response.end();
    rc.project.updateDynamic();
};
module.exports.label = 'Compile All Pages';
module.exports.description = 'Generates an HTML file for each identified page with filename suffix *-compiled.html.';