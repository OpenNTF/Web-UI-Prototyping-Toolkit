/**
 * Copyright 2014 IBM Corp.
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

"use strict";

var fs = require("./filesystem"), path = require("path"), utils = require("./utils");

var logger = utils.createLogger({sourceFilePath : __filename});

var jadeUtils = require("./jadeUtils");
var hbsUtils = require("./hbsUtils");
var handlebars = require("handlebars");
var Placeholder = utils.Placeholder;

function sortPlaceholdersByDescendingLocation(a, b) {
    return -1 * (a.getStart() - b.getStart());
}

var templateComposer = module.exports;

var pluginFacts = 0;

/**
 *
 * @param args
 * @constructor
 */
templateComposer.TemplateComposer = function(args) {
    this.maxCompilationRuns = 100;
    var dropPointPrefix = '<!-- ';
    var dropPointPostfix = ' -->';
    var dropPointSeparatorName = ':';
    var dropPointSeparatorArgs = ',';
    this.dropPointPrefix = dropPointPrefix;
    this.dropPointPostfix = dropPointPostfix;
    this.dropPointSeparatorName = dropPointSeparatorName;
    this.dropPointSeparatorArgs = dropPointSeparatorArgs;

    this.pluginFactories = {};
    this.loadedPlugins = false;

    this.supportedViewTemplateFileExtensions = {
        ".html": "HTML",
        ".jade" : "Jade Template",
        ".hbs" : "Handlebars HBS Template"
    };

    this._compilationCache = {
        /* Example entry:
         fullTemplatePath : {
         sourceMod : lastmodtime,
         sourceSize : filesize,
         compiled : compiledOutput,
         source : source,
         deps: [depPaths..]
         }
         */
    };

    /**
     * @type {runtime.ProtostarRuntime}
     */
    this.runtime = args.runtime;
    var uc = this.runtime.readUserConfig();
    //noinspection JSUnresolvedVariable
    this.maxCompilationRuns = uc.maxCompilationRuns;
    this.pluginFactories = this.loadPluginFactories();
};



templateComposer.TemplateComposer.prototype.loadPluginFactories = function(){
    if(pluginFacts !== 0){
        return pluginFacts;
    }
    var theComposer = this;
    var plugins = {};
    var fileNames = this.runtime.listDir(__dirname);
    fileNames.forEach(function(fn){
        if(fn.indexOf("fotl-") === 0 && fn.substring(fn.length-3) === ".js"){
            var pluginName = fn.substring(5, fn.length-3);
            plugins[pluginName] = require("./fotl-" + pluginName).createFactory({
                runtime: theComposer.runtime,
                composer: theComposer
            });
            logger.info("Loaded plugin factory for " + pluginName);
        }
    });
    return plugins;
};

templateComposer.TemplateComposer.prototype.convertLayoutToHandlebars = function(tpl){
    var out = tpl;
    var r = /<!-- content:[^ ]+ -->/;
    var preContent = '<!-- content:';
    var endContent = ' -->';
    while(r.test(out)){
        var lastIndexOf = out.lastIndexOf(preContent);
        var textStart = lastIndexOf + preContent.length;
        var textEnd = out.indexOf(endContent, textStart);
        var name = out.substring(textStart, textEnd);
        //console.log("l name = " + name);
        var before = out.substring(0, lastIndexOf);
        var after = out.substring(textEnd + endContent.length);
        out = before + '{{{' + name + '}}}' + after;
        //console.log("out is now :", out);
    }
    //console.log("done");
    return out;
};
templateComposer.TemplateComposer.prototype.convertHandlebarsToLayout = function(tpl){
    var out = tpl;
    //var r = /<!-- content:[^ ] -->/;
    var r = /{{[ ]*[^ ]+[ ]*}}/;
    //var preContent = '<-- content:';
    //var endContent = ' -->';
    var preContent = '{{';
    var endContent = '}}';
    while(r.test(out)){
        var lastIndexOf = out.lastIndexOf(preContent);
        var textStart = lastIndexOf + preContent.length;
        var textEnd = out.indexOf(endContent, textStart);
        var name = out.substring(textStart, textEnd).trim();
        console.log("h name = " + name);
        out = out.substring(0, lastIndexOf) + '<!-- content:' + name + ' -->' + out.substring(textEnd + endContent.length);
    }
    return out;
};

/**
 *
 * @param {String} filepath
 * @param {String} content
 * @param {String} dropPointType
 * @return {utils.Placeholder[]}
 */
templateComposer.TemplateComposer.prototype.findDropPointsOfType = function(filepath, content, dropPointType) {
    if (arguments.length !== 3) {
        throw new Error('findDropPointsOfType requires 3 args');
    }
    var contents = '' + content;
    var crit = this.dropPointPrefix + dropPointType + this.dropPointSeparatorName;
    var dropPointNames = [];
    var startIdx = 0;
    var currentStartIndex;
    var t = this;
    var maxRuns = 200;
    var run = 1;
    while (run <= maxRuns && (currentStartIndex = contents.indexOf(crit, startIdx)) >= 0) {
        run +=1;
        var currentEndIndex = contents.indexOf(this.dropPointPostfix, currentStartIndex);
        var currentName = contents.substring(currentStartIndex + crit.length, currentEndIndex);
        var currentType = dropPointType;
        if(!t.pluginFactories.hasOwnProperty(currentType)){
            throw new Error("Unknown plugin type: " + currentType);
        }
        var pluginFact = t.pluginFactories[currentType];
        var ph = pluginFact.parsePlaceholder(currentName, content.substring(currentStartIndex, currentEndIndex + 4), /*currentType,*/ currentStartIndex, currentEndIndex+4, filepath);
        if(typeof ph !== 'object'){
            throw new Error("Unexpected placeholder");
        }
        dropPointNames.push(ph);
        startIdx = currentEndIndex + 4;
    }
    if(run === maxRuns){
        logger.error("Overflow for finding droppoints; content now is :: ", contents);
        throw new Error("Overflow for finding droppoints");
    }
    return dropPointNames;
};

/**
 *
 * @param {String} filepath
 * @param {String} content
 * @param {String} partType
 * @return {utils.Placeholder[]}
 */
templateComposer.TemplateComposer.prototype.findDropPoints = function(filepath, content, partType){
    return this.findDropPointsOfType(filepath, content, partType);
};

/**
 *
 * @param {String} relativeFilePath
 * @param {String} referenceFilePath
 * @return {String}
 */
templateComposer.TemplateComposer.prototype.resolveRelativePath = function(relativeFilePath, referenceFilePath) {
    return path.normalize(path.dirname(referenceFilePath) + "/" + relativeFilePath);
};
/**
 *
 * @param {utils.Placeholder[]} dropPointsArray
 */
templateComposer.TemplateComposer.prototype.replaceRelativeReferences = function(dropPointsArray) {
    var t = this;
    dropPointsArray.forEach(function (dp) {
        if (utils.isRelativePath(dp.getName())) {
            if(t.runtime.isProjectPath(dp.getFilePath())){
                var relative = t.runtime.toRelativeProjectPath(path.dirname(dp.getFilePath()));
                var newRelative = path.join(relative, dp.getName());
                dp.setName(newRelative);
            }else{
                logger.error("Unhandled relative : ", dp);
                console.trace();
                throw new Error();
            }
        } else if(dp.isDefaultResourceInclusion()){
            var lastDot = dp.getFilePath().lastIndexOf(".");
            var fp;
            // we're assuming for now noone wants to link default.js or default.css from the project root ..
            switch(dp.getType()){
                case "linkCss":
                    fp = dp.getFilePath().substring(0, lastDot)  + '.css';
                    break;
                case "linkScript":
                    fp = dp.getFilePath().substring(0, lastDot)  + '.js';
                    break;
                default:
                    throw new Error("unsupported default resource inclusion type (should be linkCss/linkScript)");
            }
            var relativeDR = t.runtime.toRelativeProjectPath(fp);
            dp.setName(relativeDR.substring(0, relativeDR.lastIndexOf(".")));
        }
    });
};

/**
 *
 * @param {String} filepath
 * @param {String} contents
 * @param {String[]} [partTypePrefixes]
 * @return {utils.Placeholder[]}
 */
templateComposer.TemplateComposer.prototype.findAllDropPoints = function(filepath, contents, partTypePrefixes) {
    var ptp = partTypePrefixes;
    if(!partTypePrefixes){
        ptp = this.listDropPointTypes();
    }
    var partNames = [];
    var t = this;
    ptp.forEach(function (type) {
        var f = t.findDropPointsOfType(filepath, contents, type);
        if (f && f.length) {
            f.forEach(function (pn) {
                partNames.push(pn);
            });
        }
    });
    return partNames;
};

templateComposer.TemplateComposer.prototype.createErrorMarkup = createErrorMarkup;
function createErrorMarkup(msg){
    return '<div style="background-color: #f08080">'+msg+'</div>';
}

/**
 *
 * @return {String[]}
 */
templateComposer.TemplateComposer.prototype.listDropPointTypes = function(){
    var dropPointTypes = [];
    for(var pluginName in this.pluginFactories){
        dropPointTypes.push(pluginName);
    }
    dropPointTypes.sort();
    return dropPointTypes;
};

/**
 *
 * @param {String} str
 * @return {boolean}
 */
templateComposer.TemplateComposer.prototype.startsWithDropPointPrefix = function (str) {
    var startsWith = false;
    this.listDropPointTypes().forEach(function (tp) {
        if (str.indexOf(tp + ':') === 0) {
            startsWith = true;
        }
    });
    return startsWith;
};

/**
 *
 * @param {String} filePath
 * @param {String} contents
 * @return {String}
 */
templateComposer.TemplateComposer.prototype.prepareEditableRefs = function(filePath, contents) {
    var urlpath = this.runtime.createUrlPathForFile(filePath);
    var editableRef = urlpath.substring(1, urlpath.lastIndexOf('.'));
    var cont = true;
    var startIdx = 0;
    var attrname = 'data-editable';
    while (cont) {
        var attrstart = contents.indexOf(attrname, startIdx);
        if (attrstart < startIdx) {
            cont = false;
        } else {
            var emptyAttr = attrname + '=""';
            var emptyAttrVal = (attrstart === contents.indexOf(emptyAttr, startIdx));
            if (contents.charAt(attrstart + attrname.length) !== '=' || emptyAttrVal) {
                var newAttr = attrname + '="' + editableRef + '" contenteditable="true" ';
                var attrEnd = attrstart + attrname.length;
                if (emptyAttrVal) {
                    attrEnd = attrstart + emptyAttr.length;
                }
                contents = contents.substring(0, attrstart) + newAttr + contents.substring(attrEnd);
            }
            startIdx = attrstart + 1;
        }
        if (startIdx >= contents.length) {
            cont = false;
        }
    }
    return contents;
};

/**
 *
 * @param {String} filepath
 * @param {String} cnt
 * @return {String}
 */
templateComposer.TemplateComposer.prototype.resolveRelativeLinksInProtostarAttributes= function(filepath, cnt) {
    var selSameDir = '"ps:./';
    var selParentDir = '"ps:../';
    var cont = cnt;
    var parentSelIdxes = utils.findAllIndexesOf(selParentDir, cont);
    parentSelIdxes.sort();
    parentSelIdxes.reverse();
    var t = this;
    parentSelIdxes.forEach(function (idx) {
        var nextQuote = cont.indexOf('"', idx + 5);
        var relPath = cnt.substring(idx + 4, nextQuote);
        var resolvedPath = t.resolveRelativePath(relPath, filepath);
        var url = t.runtime.createUrlPathForFile(resolvedPath);
        if (url.indexOf('/ps/') !== 0) {
            url = url.substring(1);
        }
        cont = cont.substring(0, idx + 1) + url + cont.substring(nextQuote);
    });
    var sameSelIdxes = utils.findAllIndexesOf(selSameDir, cont);
    sameSelIdxes.sort();
    sameSelIdxes.reverse();
    sameSelIdxes.forEach(function (idx) {
        var nextQuote = cont.indexOf('"', idx + 5);
        var relPath = cnt.substring(idx + 4, nextQuote);
        var resolvedPath = t.resolveRelativePath(relPath, filepath);
        var url = t.runtime.createUrlPathForFile(resolvedPath);
        if (url.indexOf('/ps/') !== 0) {
            url = url.substring(1);
        }
        cont = cont.substring(0, idx + 1) + url + cont.substring(nextQuote);
    });
    var rg = new RegExp('\"ps:', 'g');
    return cont.replace(rg, '"');
};

/**
 *
 * @param {String} filePath
 * @param {{}} metadata
 * @return {{content: String, dropPoints: number}}
 */
templateComposer.TemplateComposer.prototype.readFragment = function(filePath, metadata) {
    var fragment;// = this.runtime.readFile(filePath);
    if(filePath.substring(filePath.lastIndexOf(".")) === ".jade"){
        fragment = jadeUtils.compileJade(filePath);
    }else if(filePath.substring(filePath.lastIndexOf(".")) === ".hbs"){
        var pcfg = this.runtime.readProjectConfig();
        var src = this.runtime.readFile(filePath);
        fragment = hbsUtils.convertPartialsToFileIncludes(src, pcfg.hbs.partialsDir);
        if(filePath.indexOf(this.runtime.constructProjectPath(pcfg.hbs.partialsDir)) !== 0){
            fragment = hbsUtils.injectHbsLayoutBodyContent(this.runtime.constructProjectPath(pcfg.hbs.layout), fragment);
        }
    }else{
        fragment = this.runtime.readFile(filePath);
    }
    metadata.deps[filePath] = 1;
    var t= this;
    var contents = t.prepareEditableRefs(filePath, fragment);
    var fragmentDropPoints = t.findAllDropPoints(filePath, contents, t.listDropPointTypes());
    var relativeDP = [];
    fragmentDropPoints.forEach(function(fdp){
        if(fdp.isRelativePathName() || fdp.isDefaultResourceInclusion()){
            relativeDP.push(fdp);
        }
    });
    relativeDP.sort(sortPlaceholdersByDescendingLocation);
    t.replaceRelativeReferences(relativeDP);
    relativeDP.forEach(function(rdp){
        var newRelTag = t.dropPointPrefix + rdp.getType() + t.dropPointSeparatorName + rdp.getName() + t.dropPointPostfix;
        contents = rdp.replacePartContents(contents , newRelTag);
    });
    var dropPoints = t.findAllDropPoints(filePath, contents, ['wrap']);
    if (dropPoints.length > 0) {
        contents = t.pluginFactories.wrap.applyPlaceholder(dropPoints[0], contents, metadata);
    }
    contents = t.resolveRelativeLinksInProtostarAttributes(filePath, contents);
    return  {
        content: contents,
        dropPoints: -1
    };
};

/**
 *
 * @param {String} templateFilename
 * @param {String} template
 * @param {utils.Placeholder[]} placeholders
 * @param metadata
 * @return {string}
 */
templateComposer.TemplateComposer.prototype.compositionRun = function (templateFilename, template, placeholders, metadata) {
    var composed = "" + template;
    placeholders.sort(function (a, b) {
        return -1 * (a.getStart() - b.getStart());
    });
    logger.debug("Composition run for template file name: " + templateFilename);
    var t = this;
    var err = undefined;
    var errPart = undefined;
    placeholders.forEach(function (placeholder) {
        if(!errPart){
            if(!t.pluginFactories.hasOwnProperty(placeholder.getType())){
                throw new Error("Unknown fotl plugin type " + placeholder.getType());
            }
            var pluginFact = t.pluginFactories[placeholder.getType()];
            try {
                composed = pluginFact.applyPlaceholder(placeholder, composed, metadata, templateFilename);
            } catch (e) {
                console.error(e.stack);
                err = e;
                errPart = placeholder;
            }
        }

    });
    if(errPart){
        console.error("Error while applying placeholder for " + errPart.getTag() + " in " + errPart.getFilePath() + " during compilation of " + templateFilename);
        throw err;
    }
    return composed;
};

/**
 * @param request
 * @param response
 * @param {String} content
 * @param {String} viewName
 * @param {String[]} [tagArgs]
 */
templateComposer.TemplateComposer.prototype.renderBackendView = function (request, response, content, viewName, tagArgs) {

    var wrapper = '<!-- wrap:/ps/backend/layout-help';
    if(tagArgs){
        if(utils.isArray(tagArgs)){
            var argStr = '';
            tagArgs.forEach(function(arg){
                var name = arg.name;
                if(arg.hasOwnProperty("text")){
                    if(argStr){
                        argStr += ';';
                    }
                    argStr += '' + name + '=\'' + arg.text + '\'';
                }else{
                    argStr += '' + name + '=' + arg.value;
                }

            });
            wrapper +=   ("(" + argStr + ") -->\n");
        }else if(utils.isString(tagArgs)){
            wrapper +=  ("(" + tagArgs + ") -->\n");
        }else{
            throw new Error();
        }
    }else{
        wrapper += ' -->';
    }
    var editConfigView = this.runtime.constructAppPath(["core", "backend", "compiled", viewName+".html"]);
    var helpContent = wrapper + content;
    this.runtime.writeFile(editConfigView, helpContent);
    var composed = this.composeTemplate(editConfigView, helpContent);
    utils.writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
},

/**
 * @param {String} filePath
 * @param {String} fileContents
 * @param {Number} maxRuns
 * @return {boolean}
 */
    templateComposer.TemplateComposer.prototype.composesToFullHtmlTemplate = function(filePath, fileContents, maxRuns){
        var extension = path.extname(filePath);
        if (!this.supportedViewTemplateFileExtensions.hasOwnProperty(extension)) {
            throw new Error("Extensions should be one of "+Object.keys(this.supportedViewTemplateFileExtensions).join(',') +": " + filePath);
        }
        function isHtml(str){
            return str.indexOf('<html') >= 0 && str.indexOf('</html>'> 0);
        }
        function isNotJekyll(str){
            return str.indexOf('{%') < 0;
        }
        if(typeof fileContents !== 'string'){
            fileContents = this.runtime.readFile(filePath, 'utf8');
        }
        if(isHtml(fileContents) && isNotJekyll(fileContents)){
            return true;
        }
        var t = this;

        if(utils.endsWith(filePath, ".jade")){
            fileContents = jadeUtils.compileJade(filePath, fileContents);
        }else if(utils.endsWith(filePath, ".hbs")){

            var pcfg = this.runtime.readProjectConfig();
            if(filePath.indexOf(this.runtime.constructProjectPath(pcfg.hbs.partialsDir)) === 0){
                return false;
            }
            if(/\{\{>[ ]*body[ ]*}}]/.test(fileContents)){
                return false;
            }
            fileContents = hbsUtils.convertPartialsToFileIncludes(fileContents, pcfg.hbs.partialsDir);
            fileContents = hbsUtils.injectHbsLayoutBodyContent(this.runtime.constructProjectPath(pcfg.hbs.layout), fileContents);
        }

        var file = this.resolveRelativeLinksInProtostarAttributes(filePath, this.prepareEditableRefs(filePath, "" + fileContents));
        var dropPointTypes = this.listDropPointTypes();
        var names = this.findAllDropPoints(filePath, file, dropPointTypes);
        //console.log("Found droppoints in " + filePath, names);
        var modificationFile = '' + file;
        var runs = 0;
        var mr = 100;
        if (typeof maxRuns === 'number') {
            mr = maxRuns;
        }
        var metadata = {
            templatePath: filePath,
            include: {
                script: [],
                headScript: [],
                style: []
            },
            deps : {}
        };
        metadata.deps[filePath] = 1;

        while (names && names.length && runs < mr) {
            logger.debug("CompositionRun " + runs + " : " + filePath);
            modificationFile = t.compositionRun(filePath, modificationFile, names, metadata);
            if(isHtml(modificationFile) && isNotJekyll(modificationFile)){
                return true;
            }
            runs += 1;
            names = t.findAllDropPoints(filePath, modificationFile, dropPointTypes);
        }
        return isHtml(modificationFile) && isNotJekyll(modificationFile);


    };
/**
 * @param {String} filePath
 * @param {String} [fileContents]
 * @param {Number} [maxRuns]
 * @return {{content: String, metadata: Object}}
 */
templateComposer.TemplateComposer.prototype.composeTemplate = function (filePath, fileContents, maxRuns) {
    var extension = path.extname(filePath);
    if (!this.supportedViewTemplateFileExtensions.hasOwnProperty(extension)) {
        throw new Error("Extensions should be one of "+Object.keys(this.supportedViewTemplateFileExtensions).join(',') +": " + filePath);
    }
    if(typeof fileContents !== 'string'){
        fileContents = this.runtime.readFile(filePath, 'utf8');
    }
    var t = this;
    var file = this.resolveRelativeLinksInProtostarAttributes(filePath, this.prepareEditableRefs(filePath, "" + fileContents));
    var dropPointTypes = this.listDropPointTypes();
    var names = this.findAllDropPoints(filePath, file, dropPointTypes);
    //console.log("Found droppoints in " + filePath, names);
    var modificationFile = '' + file;
    var runs = 0;
    var mr = 100;
    if (typeof maxRuns === 'number') {
        mr = maxRuns;
    }
    var metadata = {
        templatePath: filePath,
        include: {
            script: [],
            headScript: [],
            style: []
        },
        deps : {}
    };
    metadata.deps[filePath] = 1;
    while (names && names.length && runs < mr) {
        logger.debug("CompositionRun " + runs + " : " + filePath);
        modificationFile = t.compositionRun(filePath, modificationFile, names, metadata);
        runs += 1;
        names = t.findAllDropPoints(filePath, modificationFile, dropPointTypes);
    }
    return {
        content: modificationFile,
        metadata: metadata
    };
};



/**
 * @param {String} filePath
 * @return {String}
 */
templateComposer.TemplateComposer.prototype.composeTemplateCached = function(filePath){
    var st = fs.statSync(filePath);
    if(this._compilationCache.hasOwnProperty(filePath)){
        var cached = this._compilationCache[filePath];
        try{
            var newLatest = utils.findLatestMod(filePath, cached.deps);
            if(cached.sourceMod >= newLatest && cached.sourceSize === st.size){
                return cached.compiled;
            }
        }catch(FindLatestModErr){
            //console.error("Error finding latest mod of " + filePath, FindLatestModErr.stack);
            this._compilationCache[filePath] = undefined;
        }
    }
    var source = this.runtime.readFile(filePath);
    var composed = this.composeTemplate(filePath, source);
    this._compilationCache[filePath] = {
        sourceMod : utils.findLatestMod(filePath, composed.metadata.deps),
        sourceSize : st.size,
        compiled : composed,
        source : source,
        deps : composed.metadata.deps
    };
    logger.debug("Cached compiled template : " + filePath, composed);
    return composed;
};



/**
 *
 * @param {String} content
 * @param {String} search
 * @param {Number} start
 * @param {Number} end
 * @return {Number}
 */
var countOccurrencesBetweenIndexes = function (content, search, start, end) {
    return utils.countOccurrencesBetweenIndexes(content, search, start, end);
};
/**
 *
 * @param {String} contents
 * @return {{content: string, markers: Array}}
 */
var decompile= function (contents) {
    var cnt = contents + "";
    var markers = [];
    var run = true;
    while (run && cnt.indexOf('<!-- begin_') >= 0) {
        logger.info("marker found ..");
        var openMarkerStart = cnt.indexOf('<!-- begin_', 0);
        if (openMarkerStart >= 0) {
            var openMarkerEnd = cnt.indexOf(' -->', openMarkerStart);
            var openMarker = cnt.substring(openMarkerStart, openMarkerEnd + 4);
            var templateDef = openMarker.substring(11, openMarker.length - 4);
            var fragmentType = templateDef.substring(0, templateDef.indexOf("-"));
            var templateName = templateDef.substring(templateDef.indexOf("-") + 1);
            var args = "";
            if (templateDef.indexOf(":") > 0) {
                args = templateDef.substring(templateDef.indexOf(":"));
                templateName = templateDef.substring(templateDef.indexOf("-") + 1, templateDef.indexOf(":"));
            }
            logger.info("Template name: '" + templateName + "' of type " + fragmentType);
            logger.info("Found open marker: " + openMarker);

            var closeTag = "<!-- end_" + templateDef + ' -->';
            logger.info("openclosetag=" + closeTag);
            var closeMarkerStart = cnt.indexOf(closeTag, openMarkerEnd + 4);
            if (closeMarkerStart < 0) {
                throw new Error("Cannot find matching end tag for " + openMarker);
            }
            logger.info("counting outhers, closeMarkerStart = " + closeMarkerStart);
            var openMarkerFull = '<!-- begin_' + fragmentType + "-" + templateName + args + " -->";
            var othersCount = countOccurrencesBetweenIndexes(cnt, openMarkerFull, openMarkerEnd, closeMarkerStart);
            var closeMarker = '<!-- end_' + fragmentType + "-" + templateName + args + " -->";
            if (othersCount > 0) {
                logger.info("found others: " + othersCount);

                closeMarkerStart = utils.findNthOccurrence(cnt, closeMarker, othersCount + 1, openMarkerEnd);
                logger.info("actual close is " + closeMarkerStart);
            }

            var theContent = cnt.substring(openMarkerEnd + 4, closeMarkerStart);
            var closeMarkerEnd = cnt.indexOf(' -->', closeMarkerStart) + 4;
            markers.push({
                name: templateName,
                content: theContent,
                type: fragmentType,
                start: openMarkerStart,
                end: closeMarkerEnd + 4
            });
            logger.info("Found open marker: " + openMarker);
            cnt = cnt.substring(0, openMarkerStart) + '<!-- ' + fragmentType + ':' + templateName + args + ' -->' + cnt.substring(closeMarkerEnd);

        } else {
            logger.info("No markers found");
            run = false;
        }
    }

    return {
        content: cnt,
        markers: markers
    };
};
/**
 *
 * @param {String} contents
 * @return {{content, markers}|*}
 */
var decompileRecursive = function (contents) {
    var cnt = contents + "";
    var decompiled = module.exports.decompile(cnt);
    logger.info("Recursive, decompiled root = ", decompiled);
    var changed = true;
    var run = 0;
    while (changed && run < 1000) {
        changed = false;
        run += 1;
        decompiled.markers.forEach(function (m) {
            if (m.content.indexOf('<!-- begin_') >= 0) {
                var nestedDecompiled = module.exports.decompile(m.content);
                logger.info("Decompiled nested : " + m.name, nestedDecompiled);
                changed = true;
                m.content = nestedDecompiled.content;
                m.nestedMarkers = [];
                nestedDecompiled.markers.forEach(function (mr) {
                    decompiled.markers.push(mr);
                    m.nestedMarkers.push(mr);
                });
            }
        });
    }
    return decompiled;
};


var postProcessComposed = function (markup, runtime, callback) {
    if (markup.content.trim().length > 0) {
        var pcfg = runtime.readProjectConfig();
        var addViewScripts = true;
        if (pcfg && utils.nestedPathExists(pcfg, "runtime", "addRuntimeScripts")) {
            if (pcfg.runtime["addRuntimeScripts"] === false) {
                addViewScripts = false;
            }
        }
        var addDoctypeIfMissing = false;
        var metadata = markup.metadata;
        var cnt = markup.content;


        var insertPlaceholderResources = function(markup, metadata){
            var newHeadTags = [];
            var newBodyTags = [];
            if (metadata.include.style.length > 0) {
                metadata.include.style.forEach(function (s) {
                    newHeadTags.push('<link rel="stylesheet" type="text/css" href="' + s + '"></script>');
                });
            }
            if (metadata.include.headScript.length > 0) {
                metadata.include.headScript.forEach(function (s) {
                    newHeadTags.push('<script src="' + s + '"></script>');
                });
            }
            if (metadata.include.script.length > 0) {
                metadata.include.script.forEach(function (s) {
                    newBodyTags.push('<script src="' + s + '"></script>');
                });
            }
            var out= markup;
            var olc = out.toLowerCase();
            var closeHeadIdx = olc.indexOf('</head>');
            var closeBodyIdx = olc.indexOf('</body>');
            if(newHeadTags.length >0 && closeHeadIdx > 0){
                var preCloseMarkup = out.substring(0, closeHeadIdx);
                var postCloseMarkup = out.substring(closeHeadIdx);
                var newOut= preCloseMarkup;
                newHeadTags.forEach(function(t){
                    newOut += t + '\n';
                });
                newOut += postCloseMarkup;
                out = newOut;
            }
            if(newBodyTags.length > 0 && closeBodyIdx > 0){
                var preBodyCloseMarkup = out.substring(0, closeBodyIdx);
                var postBodyCloseMarkup = out.substring(closeBodyIdx);
                var newBodyOut= preBodyCloseMarkup;
                newBodyTags.forEach(function(t){
                    newBodyOut += t + '\n';
                });
                newBodyOut += postBodyCloseMarkup;
                out = newBodyOut;
            }
            return out;
        };

        cnt = insertPlaceholderResources(cnt, metadata);

        var ensureViewScriptsPresent = function(markup){
            var out = markup;
            var mlc = markup.toLowerCase();
            var closeIdx = mlc.indexOf('</body>');
            if(closeIdx > 0){
                var kp = markup.indexOf('keypress.js"') > 0 || markup.indexOf('keypress-2.0.3.min.js"') > 0;
                var uf = markup.indexOf('/assets/uxFrame.js"') > 0;
                var toAdd = [];
                if(!kp){
                    toAdd.push('<script src="/ps/ext/Keypress/keypress.js" data-backend-only></script>');
                }
                if(!uf){
                    toAdd.push('<script src="/ps/assets/uxFrame.js" data-backend-only></script>');
                }
                if(toAdd.length > 0){
                    var newOut = out.substring(0, closeIdx);
                    toAdd.forEach(function(u){
                        newOut += u + '\n';
                    });
                    newOut += out.substring(closeIdx);
                    out = newOut;
                }
            }
            return out;
        };
        if (addViewScripts){
            cnt = ensureViewScriptsPresent(cnt);
        }
        var processedHtml = cnt;//$.html();
        if (addDoctypeIfMissing) {
            if (processedHtml.toLowerCase().indexOf('<html') >= 0 && processedHtml.trim().indexOf('<!') !== 0) {
                processedHtml = '<!doctype html>\n' + processedHtml;
            }
        }
        if(false && processedHtml.indexOf('<body') > 0){
            var bodyHtml = processedHtml.substring(processedHtml.indexOf('<body'), processedHtml.indexOf('</body>'));
            var sourceOpenIdx = bodyHtml.indexOf('src="');
            var sources = [];
            var allJs = '';
            while(sourceOpenIdx >0){
                var srcStartIdx = sourceOpenIdx+5;
                var closeQuoteIdx = bodyHtml.indexOf('"', srcStartIdx+1);
                var source = bodyHtml.substring(srcStartIdx, closeQuoteIdx);
                if(path.extname(source) === '.js' && source.indexOf('http:') < 0 && source.indexOf('https:') < 0 && source.indexOf('//') < 0 && source.indexOf('/ps/') !== 0 && source.indexOf('/lib/') !== 0){
                    sources.push(source);
                    var filePath = runtime.resolveUrlPathnameToProjectFile(source);
                    var contents = runtime.readFile(filePath);
                    allJs += "\n\n// Contents from " + filePath + " \n\n" + contents;
                }
                sourceOpenIdx = bodyHtml.indexOf('src="', closeQuoteIdx + 2);
            }
            logger.debug("SCRIPT REFS == ", sources);
            if(allJs.length > 0){
                var firstSrcIdx = bodyHtml.indexOf('src="' + sources[0]);
                var firstScriptOpenIdx = bodyHtml.lastIndexOf('<script', firstSrcIdx);
                var afterFirstScriptCloseIdx = bodyHtml.indexOf('</script>', firstSrcIdx)+9;
                var reversedSources = ([].concat(sources)).reverse();
                var modHtml = bodyHtml;
                reversedSources.forEach(function(source){
                    var srcStartIdx = bodyHtml.indexOf('src="' + sources[0]);
                    var scriptOpenIdx = bodyHtml.lastIndexOf('<script', srcStartIdx);
                    var afterScriptIdx = bodyHtml.indexOf('</script>', srcStartIdx)+9;
                    modHtml = modHtml.substring(0, scriptOpenIdx) + "\n" + modHtml.substring(afterScriptIdx);
                });
                var scriptTag = '<script type="text/javascript">\n'+allJs+'\n</script>\n';
                modHtml = modHtml.substring(0, firstScriptOpenIdx) + scriptTag + modHtml.substring(firstScriptOpenIdx);
                bodyHtml = modHtml;
                processedHtml = processedHtml.substring(0, processedHtml.indexOf('</head>')) + '</head>' + bodyHtml + '</html>';
            }
        }
        var psBaseId = "psGenId_" + new Date().getTime() + "_";
        var idxes = utils.findAllIndexesOf(' data-editable=', processedHtml);
        idxes.sort();
        idxes.reverse();
        idxes.forEach(function(i, cidx){
            var before = processedHtml.substring(0, i);
            var after = processedHtml.substring(i + ' data-editable='.length);
            var newText = ' id="'+psBaseId + '_' + (cidx+1) + '" data-editable=';
            processedHtml = before + newText + after;

        });
        if(processedHtml.indexOf('class="component-control id-') > 0){
            var parts = processedHtml.split('class="component-control id-');
            var partsWithPortletIdsAssigned = [];
            parts.forEach(function(p, idx){
                if(idx < 1){
                    partsWithPortletIdsAssigned.push(p);
                }else{
                    var rnd = Math.floor(Math.random() * 100000) + "_" + (new Date().getTime());
                    var portletId = "portletId_" + rnd;
                    var portletNamespace = "nsPortlet_" + rnd + "_";
                    /*
                     "namespace": "[Plugin:Portlet key='namespace' compute='once']",
                     "portletWindowID": "[Plugin:Portlet key='windowID']",
                     "portletMode" : "[Plugin:Portlet key='portletMode']",
                     "windowState" : "[Plugin:Portlet key='windowState']",
                     "serverTime" : "[plugin:getDate format='dd/MM/yyyy HH:mm:ss']"
                     */
                    var spaceIdx = p.indexOf(' ');
                    var quoteIdx = p.indexOf('"');
                    var firstIdx = Math.min(spaceIdx, quoteIdx);
                    var newPart = portletId + p.substring(firstIdx);
                    newPart = newPart.replace(/__SPNS__/g, portletNamespace);
                    newPart = newPart.replace(/\[Plugin:Portlet key=.namespace. compute=.once.]/g, portletNamespace);
                    newPart = newPart.replace(/\[Plugin:Portlet key=.windowID.]/g, portletId);
                    newPart = newPart.replace(/\[Plugin:Portlet key=.portletMode.]/g, 'view');
                    newPart = newPart.replace(/\[Plugin:Portlet key=.windowState.]/g, 'normal');
                    newPart = newPart.replace(/\[Plugin:Portlet key=.getDate. [^\]]+]/g, new Date().toISOString());
                    partsWithPortletIdsAssigned.push(newPart);
                }
            });
            processedHtml = partsWithPortletIdsAssigned.join('class="component-control id-');
        }
        callback(processedHtml);
    } else {
        callback(markup.content);
    }
};


/**
 *
 * @param {String} beginMarker
 * @param {Number} index
 * @param {Number} closeIdx
 * @param {String} contents
 * @return {{name: (string|*), type: (string|*), start: *, end: *, length: number, content: (string|*)}}
 */
var parseMarker = function (beginMarker, index, closeIdx, contents) {
    var idxUnd = beginMarker.indexOf('_');
    var idxDash = beginMarker.indexOf('-', idxUnd);
    var type = beginMarker.substring(idxUnd + 1, idxDash);
    var name = beginMarker.substring(idxDash + 1, beginMarker.indexOf(' ', idxDash));

    var endMarkerBegin = contents.indexOf('<!-- end_' + type + "-" + name + ' -->');
    var endMarkerEnd = contents.indexOf(' -->', endMarkerBegin);
    return {
        name: name,
        type: type,
        start: index,
        end: endMarkerEnd + 5,
        length: (endMarkerBegin - 1) - (closeIdx + 5),
        content: contents.substring(closeIdx + 5, endMarkerBegin - 1)
    };
};

templateComposer.TemplateComposer.prototype.renderNewBackendView = function(markup, pageData, response) {
    var layout = fs.readFileSync(path.resolve(this.runtime.protostarDirPath, 'core', 'backend', 'layout-backend.html'), 'utf8');
    var hbLayout = this.convertLayoutToHandlebars(layout);
    var pd = {};
    if(pageData){
        pd = pageData;
    }
    pd.main ='<div class="container">' + markup + '</div>';
    var outmarkup = (handlebars.compile(hbLayout))(pd);
    utils.writeResponse(response, 200, {
        'Content-Type': 'text/html; charset=utf-8'
    }, outmarkup);
};


templateComposer.TemplateComposer.prototype.renderListingMarkup = function(links, pageData, response) {
    var tpl = fs.readFileSync(path.resolve(this.runtime.protostarDirPath, 'core', 'assets', 'listing-template-hb.html'), 'utf8');
    var compiled = handlebars.compile(tpl);
    var markup = compiled({
        links: links
    });
    this.renderNewBackendView(markup, pageData, response);
};
module.exports = {
    ///**
    // * @param args
    // * @return {templateComposer.TemplateComposer}
    // */
    //createTemplateComposer: function (args) {
    //    return new templateComposer.TemplateComposer(args);
    //},
    parseMarker:parseMarker,
    decompile: decompile,
    decompileRecursive:decompileRecursive,
    replaceMarkedContentWithDropPoints: function (contents) {
        var processed = '' + contents;
        var markers = module.exports.decompile(processed);
        while (markers.length > 0) {
            var m = markers[0];
            processed = (processed.substring(0, m.getStart()) + '<!-- file:' + m.getName()+ ' -->' + processed.substring(m.getEnd() + 1));
            markers = module.exports.decompile(processed);
        }
        return processed;
    },
    TemplateComposer:templateComposer.TemplateComposer,
    postProcessComposed:postProcessComposed

};