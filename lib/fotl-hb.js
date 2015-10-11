var utils = require("./utils");
var Placeholder = utils.Placeholder;
var Handlebars = require("handlebars");
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
     *
     * @param {utils.Placeholder} partName
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function(partName, composed, metadata) {
        var runtime = this.runtime;
        var args = partName.getArgs();
        var templatePath = runtime.resolveFilePathForPlaceHolder(partName);
        metadata.deps[templatePath] = 1;
        var viewReplacement;
        var templatePathContents = runtime.readFile(templatePath);
        var dataPath = runtime.constructProjectPath(args[0] + ".json");
        metadata.deps[dataPath] = 1;
        var dataContents = runtime.readFile(dataPath);
        var parsedData = JSON.parse(dataContents);
        var compiledTemplate;
        if(partName.getArgs().length === 1){
            //without relative data path
            compiledTemplate = Handlebars.compile(templatePathContents);
        }else if(partName.getArgs().length === 2){
            //with relative data path
            templatePathContents = '{{#with '+partName.getArgs()[1]+'}}' + templatePathContents + '{{/with}}';
            compiledTemplate = Handlebars.compile(templatePathContents);
        }else if(partName.getArgs().length === 3){
            //with relative data path and replacement if not present
            var notPresentTemplate = runtime.constructProjectPath(partName.getArgs()[2]+'.html');
            metadata.deps[notPresentTemplate] = 1;
            var notPresentTemplateContents = runtime.readFile(notPresentTemplate);
            templatePathContents = '{{#with '+partName.getArgs()[1]+'}}' + templatePathContents +'{{else}}'+ notPresentTemplateContents +'{{/with}}';
            compiledTemplate = Handlebars.compile(templatePathContents);
        }else{
            logger.error("Malformed handlebars droppoint: ", partName);
            throw new Error("Malformed handlebars droppoint: " + partName.getTag());
        }
        var allCompiled = '', compiledInstance = '';
        if(partName.getArgs().length < 2){
            if(utils.isArray(parsedData)){
                parsedData.forEach(function(d){
                    var compiledInstance = compiledTemplate(d);
                    logger.debug("HB VIEW = ", compiledInstance);
                    allCompiled += compiledInstance;
                });
                viewReplacement = allCompiled;
            }else{
                compiledInstance = compiledTemplate(parsedData);
                logger.debug("HB VIEW = ", compiledInstance);
                viewReplacement = compiledInstance;
            }
        }else{
            if(utils.isArray(parsedData)){
                parsedData.forEach(function(d){
                    var compiledInstance = compiledTemplate(d);
                    logger.debug("HB VIEW = ", compiledInstance);
                    allCompiled += compiledInstance;
                });
                viewReplacement = allCompiled;
            }else{
                compiledInstance = compiledTemplate(parsedData);
                logger.debug("HB VIEW = ", compiledInstance);
                viewReplacement = compiledInstance;
            }
        }
        return partName.replacePartContents(composed, viewReplacement);
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
        if (currentName.charAt(currentName.length - 1) === ')') {
            var layoutArgsText = currentName.substring(currentName.indexOf('(') + 1, currentName.length - 1);
            var layoutArgs = layoutArgsText.split(';');
            var foundByName = false;
            var allByName = true;
            layoutArgs.forEach(function (a) {
                if (a.indexOf('=') >= 0) {
                    foundByName = true;
                } else {
                    allByName = false;
                }
            });
            if (foundByName !== allByName) {
                throw new Error("All or none of the droppoints should be assigned by name : layout:" + currentName);
            }
            var ph = new Placeholder({
                name: currentName.substring(0, currentName.indexOf('(')),
                start: currentStartIndex,
                end: currentEndIndex,
                type: 'hb',
                tag: fullTag,
                filepath: filepath,
                args: layoutArgs
            });
            return ph;
        } else {
            var colonIdx = currentName.indexOf(':');
            var nameOnly;
            if (colonIdx > 0) {
                nameOnly = currentName.substring(0, colonIdx);
            } else {
                nameOnly = currentName;
            }
            var argsText = currentName.substring(colonIdx + 1);
            var args = argsText.split(';');
            if (nameOnly.length === 0) {
                throw new Error("Illegal nameOnly");
            }
            var ph = new Placeholder({
                name: nameOnly,
                start: currentStartIndex,
                end: currentEndIndex,
                type: 'hb',
                tag: fullTag,
                filepath: filepath,
                args: args
            });
            return ph;
        }

    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};