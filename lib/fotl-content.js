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
        var contentColonIdx = tagName.indexOf(":");
        var contentNameOnly;
        if (contentColonIdx > 0) {
            contentNameOnly = tagName.substring(0, contentColonIdx);
        } else {
            contentNameOnly = tagName;
        }
        var dpargs = undefined;
        if (contentNameOnly.indexOf('(') > 0) {
            dpargs = [contentNameOnly.substring(contentNameOnly.indexOf('(') + 1, contentNameOnly.length - 1)];
            contentNameOnly = contentNameOnly.substring(0, contentNameOnly.indexOf('('));
        }
        var contentPlaceholder = new Placeholder({
            name: contentNameOnly,
            start: startIdx,
            end: endIdx,
            type: 'content',
            tag: fullTag,
            filepath: filepath,
            args: dpargs
        });
        return contentPlaceholder;
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};