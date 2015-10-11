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
        if (placeholder.isNamed('default')) {
            var defaultCssPath = path.join(dirPath, dirName + ".css");
            if (templateFilename.indexOf("/index.html") < 0) {
                defaultCssPath = templateFilename.substring(0, templateFilename.lastIndexOf(".") + 1) + "css";
            }
        } else {
            defaultCssPath = this.runtime.constructProjectPath(placeholder.getName() + ".css");
        }
        var defaultCssUrl = this.runtime.createUrlPathForFile(defaultCssPath);
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
     * @return {utils.Placeholder}
     */
    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
        return utils.parseNoArgsPlaceholder(currentName, 'linkCss', currentStartIndex, currentEndIndex, fullTag, filepath);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};