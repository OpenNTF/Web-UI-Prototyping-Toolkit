var utils = require("./utils");
var Placeholder = utils.Placeholder;
var Handlebars;// = require("handlebars");
var logger = utils.createLogger({sourceFilePath : __filename});

function requireHandlebars(){
    if(!Handlebars){
        Handlebars = require("handlebars");
    }
}

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
        requireHandlebars()
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
        return utils.parsePlaceholder(fullTag, filepath, currentStartIndex, currentEndIndex);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};