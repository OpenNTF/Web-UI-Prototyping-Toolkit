var utils = require("./utils");
var Placeholder = utils.Placeholder;

function PlaceholderFactory(args){
    this.runtime = args.runtime;

    this.applyPlaceholder = function(part, composed, metadata) {
        return part.replacePartContents(composed, '<!-- content placeholder not called as layout - content:' + part.getName() + ' -->');
        //return replacePartContents(composed, part, '<!-- content placeholder not called as layout - content:' + part.getName() + ' -->');
    };

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