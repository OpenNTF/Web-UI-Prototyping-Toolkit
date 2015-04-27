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
                logger.warn("Doesn't exist: " + fileName);
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
        return utils.parseNoArgsPlaceholder(tagName, 'file', startIdx, endIdx, fullTag, filepath);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};