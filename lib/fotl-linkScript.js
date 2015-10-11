var utils = require("./utils");
var Placeholder = utils.Placeholder;
var path = require("path");
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
     * @param {Placeholder} placeholder
     * @param {String} composed
     * @param metadata
     * @param {String} templateFilename
     * @return {String}
     */

    this.applyPlaceholder = function(placeholder, composed, metadata, templateFilename) {
        var dirPath = path.dirname(templateFilename);
        var dirName = path.basename(dirPath);
        var defaultScriptPath;
        if (placeholder.isNamed('default')) {
            defaultScriptPath = path.join(dirPath, dirName + ".js");
        } else {
            defaultScriptPath = this.runtime.constructProjectPath(placeholder.getName()+".js");
        }
        var defaultScriptUrl = this.runtime.createUrlPathForFile(defaultScriptPath);
        metadata.include.script.push(defaultScriptUrl);
        return placeholder.replacePartContentsWithoutMarking(composed, ""); //remove the tag
    };

    /**
     *
     * @param {String} currentName
     * @param {String} fullTag
     * @param {Number} currentStartIndex
     * @param {Number} currentEndIndex
     * @param {String} filepath
     * @return {utils.Placeholder}
     */
    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
        return utils.parseNoArgsPlaceholder(currentName, 'linkScript', currentStartIndex, currentEndIndex, fullTag, filepath);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};