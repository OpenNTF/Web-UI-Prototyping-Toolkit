var path = require("path");
var utils = require("./utils");
var Placeholder = utils.Placeholder;
var logger = utils.createLogger({sourceFilePath : __filename});

function LoadScriptsPlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(part, composed, metadata) {
        var scriptsLocation = part.getName();
        var t = this;
        var projectPath = this.runtime.constructProjectPath(scriptsLocation);
        var projRoot = this.runtime.constructProjectPath("");
        var dirFiles = utils.createRecursiveDirLister({
            runtime: t.runtime
        }).listRecursive(projectPath);

        var scriptFilePaths = [];
        var scriptFullPaths = [];
        var inline = part.getArgs().length > 0 && part.getArgs().indexOf('combine=true') >= 0;
        var allJs = '';
        dirFiles.forEach(function(filePath){
            if(path.extname(filePath) === '.js'){
                scriptFullPaths.push(filePath);
                scriptFilePaths.push(filePath.substring(projRoot.length));
                if(inline){
                    allJs += '\n\n//Content from ' + filePath + '\n\n' + t.runtime.readFile(filePath);
                }
            }
        });
        if(inline){
            scriptFullPaths.sort();
            var out = '\n<!-- start loadScripts for '+scriptsLocation+' -->\n';
                out += '<script type="text/javascript">\n'+allJs+'\n</script>\n';
            out+= '<!-- end loadScripts for '+scriptsLocation+' -->\n';
        }else{
            utils.createShuffled(scriptFilePaths);
            var out = '\n<!-- start loadScripts for '+scriptsLocation+' -->\n';
            scriptFilePaths.forEach(function(sfp){
                out += '<script type="text/javascript" src="'+sfp.split('\\').join('/')+'"></script>\n';
            });
            out+= '<!-- end loadScripts for '+scriptsLocation+' -->\n';
        }
        return part.replacePartContents(composed, out);
    };

    this.parsePlaceholder = function(tagName, fullTag, startIdx, endIdx, filepath){
        var o;
        if(tagName.indexOf('(') >0){
            var scriptPath = tagName.substring(0, tagName.indexOf('('));
            var tagArgs = tagName.substring(tagName.indexOf('(')+1, tagName.lastIndexOf(')'));
            var tagArgsSplit = tagArgs.split(',');
            o = new Placeholder({
                name: scriptPath,
                start: startIdx,
                tag: fullTag,
                end: endIdx,
                type: 'loadScripts',
                filepath: filepath,
                args: tagArgsSplit
            });
        }else{
            o = new Placeholder({
                name: tagName,
                start: startIdx,
                tag: fullTag,
                end: endIdx,
                type: 'loadScripts',
                filepath: filepath,
                args: []
            });
        }
        return o;
    }
}


module.exports = {
    createFactory: function(args){
        return new LoadScriptsPlaceholderFactory(args);
    }
};