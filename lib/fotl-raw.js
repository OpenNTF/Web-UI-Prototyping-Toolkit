var utils = require("./utils");
var Placeholder = utils.Placeholder;
var logger = utils.createLogger({sourceFilePath : __filename});

function PlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(part, composed, metadata) {
        var partContents;
        try{
            var fileName = this.runtime.resolveExactFilePathForPlaceHolder(part);
            if (!this.runtime.isExistingFilePath(fileName)) {
                logger.warn("Doesn't exist: " + fileName);
                partContents = this.composer.createErrorMarkup('Could not process ' + part.getType() + ':' + part.getName());
            } else {
                var txt = utils.readTextFileSync(fileName);
                metadata.deps[fileName] = 1;
                partContents = ("" + txt);
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
        return utils.parseNoArgsPlaceholder(tagName, 'raw', startIdx, endIdx, fullTag, filepath);
    }
}

module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};