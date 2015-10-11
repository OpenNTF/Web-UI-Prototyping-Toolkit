var utils = require("./utils");
var uuid = require("uuid");
var Placeholder = utils.Placeholder;
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
     * @param {Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function(part, composed, metadata) {
        var functionName = part.getName();
        var output = "";

        switch(functionName){
            case 'uuid':
                output = uuid.v1();
                break;
            default: throw new Error("Unknown random function: " + functionName + " from tag " + part.getTag())

        }
        return part.replacePartContents(composed, output);
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
        return utils.parseNoArgsPlaceholder(tagName, 'random', startIdx, endIdx, fullTag, filepath);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};