const utils = require("./utils");
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
        let defaultCssPath;
        if (placeholder.isNamed('default')) {
            if (templateFilename.indexOf("/index.html") < 0) {
                defaultCssPath = templateFilename.substring(0, templateFilename.lastIndexOf(".") + 1) + "css";
            }else{
                defaultCssPath = path.join(dirPath, dirName + ".css");
            }
        } else {
            defaultCssPath = this.runtime.constructProjectPath(placeholder.name + ".css");
        }
        const defaultCssUrl = this.runtime.createUrlPathForFile(defaultCssPath);
        metadata.include.style.push(defaultCssUrl);
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