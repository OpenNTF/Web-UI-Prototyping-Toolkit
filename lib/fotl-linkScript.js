let utils = require("./utils");
const Placeholder = require('./Placeholder');
const path = require("path");
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
     * @param {Placeholder} placeholder
     * @param {String} composed
     * @param metadata
     * @param {String} templateFilename
     * @return {String}
     */

    this.applyPlaceholder = function(placeholder, composed, metadata, templateFilename) {
        const dirPath = path.dirname(templateFilename);
        const dirName = path.basename(dirPath);
        let defaultScriptPath;
        if (placeholder.isNamed('default')) {
            defaultScriptPath = path.join(dirPath, dirName + ".js");
        } else {
            defaultScriptPath = this.runtime.constructProjectPath(placeholder.name+".js");
        }
        const defaultScriptUrl = this.runtime.createUrlPathForFile(defaultScriptPath);
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
     * @return {Placeholder}
     */
    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
        return Placeholder.parsePlaceholder(fullTag, filepath, currentStartIndex, currentEndIndex);
    };
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};