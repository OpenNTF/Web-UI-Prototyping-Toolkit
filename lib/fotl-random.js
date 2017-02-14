const utils = require("./utils");
const uuid = require("uuid");
const Placeholder = require('./Placeholder');
let logger = utils.createLogger({sourceFilePath: __filename});

function PlaceholderFactory({runtime, composer}){
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = runtime;
    /**
     * @type {TemplateComposer}
     */
    this.composer = composer;

    /**
     * @param {Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function(part, composed, metadata) {
        let output;

        switch(part.name){
            case 'uuid':
                output = uuid.v1();
                break;
            default: throw new Error("Unknown random function: " + part.name + " from tag " + part.tag);

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