let utils = require("./utils");
const Placeholder = require('./Placeholder');

function PlaceholderFactory({runtime}){
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = runtime;
    /**
     *
     * @param {Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */

    this.applyPlaceholder = function(part, composed, metadata) {
        return part.replacePartContents(composed, '<!-- content placeholder not called as layout - content:' + part.name + ' -->');
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