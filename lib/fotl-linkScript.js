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
        var colonIdx = currentName.indexOf(this.composer.dropPointSeparatorName);
        var nameOnly;
        if (colonIdx > 0) {
            nameOnly = currentName.substring(0, colonIdx);
        } else {
            nameOnly = currentName;
        }
        var argsText = currentName.substring(colonIdx + 1);
        var args = argsText.split(this.composer.dropPointSeparatorArgs);
        if (nameOnly.length === 0) {
            throw new Error("Illegal nameOnly");
        }
        var otherPH = new Placeholder({
            name: nameOnly,
            start: currentStartIndex,
            end: currentEndIndex,
            type: 'linkScript',
            tag: fullTag,
            filepath: filepath,
            args: args
        });
        return otherPH;

    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};