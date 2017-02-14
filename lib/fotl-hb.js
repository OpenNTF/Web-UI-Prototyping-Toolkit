"use strict";
const utils = require("./utils");
const Placeholder = require('./Placeholder');
let Handlebars;// = require("handlebars");
const logger = utils.createLogger({sourceFilePath: __filename});

function requireHandlebars(){
    if(!Handlebars){
        logger.info("Loading handlebars ..");
        Handlebars = require("handlebars");
    }
}

function PlaceholderFactory({runtime, composer}){
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
     * @param {Placeholder} partName
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function(partName, composed, metadata) {
        requireHandlebars();
        const runtime = this.runtime;
        const templatePath = runtime.resolveFilePathForPlaceHolder(partName);
        metadata.deps[templatePath] = 1;
        let viewReplacement;
        let templatePathContents = runtime.readFile(templatePath);
        const dataPath = runtime.constructProjectPath(partName.args[0] + ".json");
        metadata.deps[dataPath] = 1;
        const dataContents = runtime.readFile(dataPath);
        const parsedData = JSON.parse(dataContents);
        let compiledTemplate;
        if(partName.args.length === 1){
            //without relative data path
            compiledTemplate = Handlebars.compile(templatePathContents);
        }else if(partName.args.length === 2){
            //with relative data path
            templatePathContents = '{{#with '+partName.args[1]+'}}' + templatePathContents + '{{/with}}';
            compiledTemplate = Handlebars.compile(templatePathContents);
        }else if(partName.args.length === 3){
            //with relative data path and replacement if not present
            const notPresentTemplate = runtime.constructProjectPath(partName.args[2] + '.html');
            metadata.deps[notPresentTemplate] = 1;
            const notPresentTemplateContents = runtime.readFile(notPresentTemplate);
            templatePathContents = '{{#with '+partName.args[1]+'}}' + templatePathContents +'{{else}}'+ notPresentTemplateContents +'{{/with}}';
            compiledTemplate = Handlebars.compile(templatePathContents);
        }else{
            logger.error("Malformed handlebars droppoint: ", partName);
            throw new Error("Malformed handlebars droppoint: " + partName.tag);
        }
        let allCompiled = '', compiledInstance = '';
        if(partName.args.length < 2){
            if(utils.isArray(parsedData)){
                parsedData.forEach(function(d){
                    const compiledInstance = compiledTemplate(d);
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
                    const compiledInstance = compiledTemplate(d);
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