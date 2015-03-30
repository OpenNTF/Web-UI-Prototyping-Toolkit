var utils = require("./utils");
var Placeholder = utils.Placeholder;
var logger = utils.createLogger({sourceFilePath : __filename});

function PlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(part, composed, metadata) {
        var partContents;
        try{
            var fileName = this.runtime.resolveFilePathForPlaceHolder(part);
            if (!this.runtime.isExistingFilePath(fileName)) {
                console.warn("Doesn't exist: " + fileName);
            } else {
                metadata.deps[fileName] = 1;
                var partData = this.composer.readFragment(fileName, metadata);
                partContents = ("" + partData.content).trim();
            }
        }catch(e){
            logger.error("Error while processing part ", e.stack);
            logger.info("Error while parsing part: ", part);
            if(this.runtime.lenient){
                partContents = this.composer.createErrorMarkup('Could not process ' + part.getType() + ':' + part.getName());
            }else{
                throw e;
            }
        }
        return part.replacePartContents(composed, partContents);
    };

    this.parsePlaceholder = function(tagName, fullTag, startIdx, endIdx, filepath){
        var colonIdx = tagName.indexOf(':');
        var nameOnly;
        if (colonIdx > 0) {
            nameOnly = tagName.substring(0, colonIdx);
        } else {
            nameOnly = tagName;
        }
        var argsText = tagName.substring(colonIdx + 1);
        var args = argsText.split(',');
        if (nameOnly.length === 0) {
            throw new Error("Illegal nameOnly");
        }
        return new Placeholder({
            name: nameOnly,
            start: startIdx,
            end: endIdx,
            type: 'file',
            tag: fullTag,
            filepath: filepath,
            args: args
        });
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};