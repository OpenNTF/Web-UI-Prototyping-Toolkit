var utils = require("./utils");
var Placeholder = utils.Placeholder;

function PlaceholderFactory(args){
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = args.runtime;
    /**
     *
     * @param {utils.Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */

    this.applyPlaceholder = function(part, composed, metadata) {
        return part.replacePartContents(composed, '<!-- content placeholder not called as layout - content:' + part.getName() + ' -->');
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
        return utils.parsePlaceholder(fullTag, filepath, startIdx, endIdx);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};