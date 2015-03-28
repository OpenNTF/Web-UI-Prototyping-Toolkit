var utils = require("./utils");
var Placeholder = utils.Placeholder;
function PlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(partName, composed, metadata) {
        var wrapper;
        var partPath = this.runtime.resolveFilePathForPlaceHolder(partName);
        metadata.deps[partPath] = 1;
        var wrappedData = this.composer.readFragment(partPath, metadata);
        wrapper = wrappedData.content.trim();
        var contentDropPoints = this.composer.findDropPointsOfType(partPath, wrapper, "content");
        var mainContentDropPoint = -1;
        contentDropPoints.forEach(function (dp) {
            if (dp.isNamed('main')) {
                if (mainContentDropPoint !== -1) {
                    throw new Error("Overlapping content:main droppoint in " + partPath);
                }
                mainContentDropPoint = dp;
            }
        });
        if (mainContentDropPoint === -1) {
            throw new Error("Could not find content:main inside " + partPath + " which is being invoked as wrapper");
        }
        composed = partName.replacePartContentsWithoutMarking(composed, ""); //remove the wrap tag
        composed = mainContentDropPoint.replacePartContents(wrapper, composed);
        return composed;//

    };

    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
        if (currentName.charAt(currentName.length - 1) === ')') {
            var layoutArgsText = currentName.substring(currentName.indexOf('(') + 1, currentName.length - 1);
            var layoutArgs = layoutArgsText.split(';');
            var foundByName = false;
            var allByName = true;
            layoutArgs.forEach(function (a) {
                if (a.indexOf('=') >= 0) {
                    foundByName = true;
                } else {
                    allByName = false;
                }
            });
            if (foundByName !== allByName) {
                throw new Error("All or none of the droppoints should be assigned by name : layout:" + currentName);
            }
            var ph = new Placeholder({
                name: currentName.substring(0, currentName.indexOf('(')),
                start: currentStartIndex,
                end: currentEndIndex,
                type: 'wrap',
                tag: fullTag,
                filepath: filepath,
                args: layoutArgs
            });
            return ph;
        } else {
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
            var ph = new Placeholder({
                name: nameOnly,
                start: currentStartIndex,
                end: currentEndIndex,
                type: 'wrap',
                tag: fullTag,
                filepath: filepath,
                args: args
            });
            return ph;
        }

    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};