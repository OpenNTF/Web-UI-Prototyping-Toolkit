var utils = require("./utils");
var Placeholder = utils.Placeholder;
function PlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(placeholder, composed, metadata, templateFilename) {
        var dirPath = path.dirname(templateFilename);
        var dirName = path.basename(dirPath);
        if (placeholder.isNamed('default')) {
            var defaultCssPath = path.join(dirPath, dirName + ".css");
            if (templateFilename.indexOf("/index.html") < 0) {
                defaultCssPath = templateFilename.substring(0, templateFilename.lastIndexOf(".") + 1) + "css";
            }
        } else {
            defaultCssPath = this.runtime.constructProjectPath(placeholder.getName() + ".css");
        }
        var defaultCssUrl = this.runtime.createUrlPathForFile(defaultCssPath);
        metadata.include.style.push(defaultCssUrl);

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
            type: 'linkCss',
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