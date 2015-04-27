var utils = require("./utils");
var Placeholder = utils.Placeholder;
function PlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(placeholder, composed, metadata, templateFilename) {
        var dirPath = path.dirname(templateFilename);
        var dirName = path.basename(dirPath);
        var defaultScriptPath;
        if (placeholder.isNamed('default')) {
            defaultScriptPath = path.join(dirPath, dirName + ".js");
        } else {
            defaultScriptPath = this.runtime.constructProjectPath(placeholder.getName()+".js");
        }
        var defaultScriptUrl = this.runtime.createUrlPathForFile(defaultScriptPath);
        metadata.include.script.push(defaultScriptUrl);
        return placeholder.replacePartContentsWithoutMarking(composed, ""); //remove the tag
    };

    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
        return utils.parseNoArgsPlaceholder(currentName, 'linkScript', currentStartIndex, currentEndIndex, fullTag, filepath);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};