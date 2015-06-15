var path = require("path");
var utils = require("./utils");
var Placeholder = utils.Placeholder;
var logger = utils.createLogger({sourceFilePath : __filename});

function LoadScriptsPlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(part, composed, metadata) {
        var scriptsLocation = part.getArgs()[0];
        var t = this;
        var projectPath = this.runtime.constructProjectPath(scriptsLocation);
        var projRoot = this.runtime.constructProjectPath("");
        var dirFiles = utils.createRecursiveDirLister({
            runtime: t.runtime
        }).listRecursive(projectPath);

        var scriptFilePaths = [];
        dirFiles.forEach(function(filePath){
            if(path.extname(filePath) === '.js'){
                scriptFilePaths.push(filePath.substring(projRoot.length));
            }
        });
        //scriptFilePaths.sort();
        utils.createShuffled(scriptFilePaths);
        var out = '\n<!-- start loadScripts for '+scriptsLocation+' -->\n';
        scriptFilePaths.forEach(function(sfp){
            out += '<script type="text/javascript" src="'+sfp+'"></script>\n';
        });
        out+= '<!-- end loadScripts for '+scriptsLocation+' -->\n';
        return part.replacePartContents(composed, out);
    };

    this.parsePlaceholder = function(tagName, fullTag, startIdx, endIdx, filepath){
        return utils.parseNoArgsPlaceholder(tagName, 'loadScripts', startIdx, endIdx, fullTag, filepath);
    }
}


module.exports = {
    createFactory: function(args){
        return new LoadScriptsPlaceholderFactory(args);
    }
};