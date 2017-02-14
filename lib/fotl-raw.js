const utils = require("./utils");
const Placeholder = require('./Placeholder');
const logger = utils.createLogger({sourceFilePath: __filename});

function PlaceholderFactory({runtime,composer}){
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = runtime;
    /**
     * @type {TemplateComposer}
     */
    this.composer = composer;
    /**
     *
     * @param {Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function(part, composed, metadata) {
        let partContents;
        try{
            const fileName = this.runtime.resolveExactFilePathForPlaceHolder(part);
            if (!this.runtime.isExistingFilePath(fileName)) {
                logger.warn("Doesn't exist: " + fileName);
                partContents = this.composer.createErrorMarkup('Could not process ' + part.type + ':' + part.name);
            } else {
                const txt = utils.readTextFileSync(fileName);
                metadata.deps[fileName] = 1;
                partContents = ("" + txt);
            }
        }catch(e){
            logger.error("Error while processing part ", e.stack);
            logger.info("Error while parsing part: ", part);
            if(this.runtime.lenient){
                partContents = this.composer.createErrorMarkup('Could not process ' + part.type + ':' + part.name);
            }else{
                throw e;
            }
        }
        return part.replacePartContents(composed, partContents);
    };
    /**
     *
     * @param {String} tagName
     * @param {String} fullTag
     * @param {Number} startIdx
     * @param {Number} endIdx
     * @param {String} filepath
     * @return {Placeholder}
     */
    this.parsePlaceholder = function(tagName, fullTag, startIdx, endIdx, filepath){
        return Placeholder.parsePlaceholder(fullTag, filepath, startIdx, endIdx);
    };
}

module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};