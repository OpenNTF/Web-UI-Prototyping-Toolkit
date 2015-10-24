var utils = require("./utils");
var fs = require("fs");
var Placeholder = utils.Placeholder;
var markdownHelper = require("./markdownHelper");
var path = require("path");
var logger = utils.createLogger({sourceFilePath : __filename});

function PlaceholderFactory(args){
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = args.runtime;
    /**
     * @type {TemplateComposer}
     */
    this.composer = args.composer;
    /**
     *
     * @param {utils.Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */

    this.applyPlaceholder = function(part, composed, metadata) {
        var partContents;
        try{
            var fileName = this.runtime.resolveFilePathForPlaceHolder(part);
            if (!this.runtime.isExistingFilePath(fileName)) {
                logger.warn("Doesn't exist: " + fileName);
            } else {
                metadata.deps[fileName] = 1;
                if(path.extname(fileName) === '.md'){
                    var mdSource = fs.readFileSync(fileName, 'utf8');
                    partContents = markdownHelper.compileMarkdown(mdSource)
                }else{
                    var partData = this.composer.readFragment(fileName, metadata);
                    partContents = ("" + partData.content).trim();
                }
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
    /**
     *
     * @param {String} tagName
     * @param {String} fullTag
     * @param {Number} startIdx
     * @param {Number} endIdx
     * @param {String} filepath
     * @return {utils.Placeholder}
     */

    this.parsePlaceholder = function(tagName, fullTag, startIdx, endIdx, filepath){
        return utils.parseNoArgsPlaceholder(tagName, 'file', startIdx, endIdx, fullTag, filepath);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};