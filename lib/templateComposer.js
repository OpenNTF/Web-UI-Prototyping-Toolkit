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

const
    fs = require("./filesystem"),
    path = require("path"),
    utils = require("./utils"),
    jadeUtils = require("./jadeUtils"),
    hbsUtils = require("./hbsUtils"),
    handlebars = require("handlebars"),
    Placeholder = require('./Placeholder');

const logger = utils.createLogger({sourceFilePath: __filename});

function sortPlaceholdersByDescendingLocation(a, b) {
    return -1 * (a.getStart() - b.getStart());
}

// var templateComposer = module.exports;

const pluginFacts = 0;

class TemplateComposer {
    /**
     *
     * @param args
     * @constructor
     */
    constructor(args) {
        this.maxCompilationRuns = 100;
        const dropPointPrefix = '<!-- ';
        const dropPointPostfix = ' -->';
        const dropPointSeparatorName = ':';
        const dropPointSeparatorArgs = ',';
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
         * @type {ProtostarRuntime}
         */
        this.runtime = args.runtime;
        const uc = this.runtime.readUserConfig();
        //noinspection JSUnresolvedVariable
        this.maxCompilationRuns = uc.maxCompilationRuns;
        this.pluginFactories = this.loadPluginFactories();
        // this.createErrorMarkup = createErrorMarkup;
    }

    loadPluginFactories() {
        if(pluginFacts !== 0){
            return pluginFacts;
        }
        const plugins = {};
        const fileNames = this.runtime.listDir(__dirname);
        fileNames.forEach(fn =>{
            if(fn.indexOf("fotl-") === 0 && fn.substring(fn.length-3) === ".js"){
                const pluginName = fn.substring(5, fn.length - 3);
                plugins[pluginName] = require("./fotl-" + pluginName).createFactory({
                    runtime: this.runtime,
                    composer: this
                });
                logger.info("Loaded plugin factory for " + pluginName);
            }
        });
        return plugins;
    }

    convertLayoutToHandlebars(tpl) {
        let out = tpl;
        const r = /<!-- content:[^ ]+ -->/;
        const preContent = '<!-- content:';
        const endContent = ' -->';
        while(r.test(out)){
            const lastIndexOf = out.lastIndexOf(preContent);
            const textStart = lastIndexOf + preContent.length;
            const textEnd = out.indexOf(endContent, textStart);
            const name = out.substring(textStart, textEnd);
            //console.log("l name = " + name);
            const before = out.substring(0, lastIndexOf);
            const after = out.substring(textEnd + endContent.length);
            out = before + '{{{' + name + '}}}' + after;
            //console.log("out is now :", out);
        }
        //console.log("done");
        return out;
    }

    convertHandlebarsToLayout(tpl) {
        let out = tpl;
        //var r = /<!-- content:[^ ] -->/;
        const r = /{{[ ]*[^ ]+[ ]*}}/;
        //var preContent = '<-- content:';
        //var endContent = ' -->';
        const preContent = '{{';
        const endContent = '}}';
        while(r.test(out)){
            const lastIndexOf = out.lastIndexOf(preContent);
            const textStart = lastIndexOf + preContent.length;
            const textEnd = out.indexOf(endContent, textStart);
            const name = out.substring(textStart, textEnd).trim();
            console.log("h name = " + name);
            out = out.substring(0, lastIndexOf) + '<!-- content:' + name + ' -->' + out.substring(textEnd + endContent.length);
        }
        return out;
    }

    /**
     *
     * @param {String} filepath
     * @param {String} content
     * @param {String} dropPointType
     * @return {Placeholder[]}
     */
    findDropPointsOfType(filepath, content, dropPointType) {
        if (arguments.length !== 3) {
            throw new Error('findDropPointsOfType requires 3 args');
        }
        const contents = '' + content;
        const crit = this.dropPointPrefix + dropPointType + this.dropPointSeparatorName;
        const dropPointNames = [];
        let startIdx = 0;
        let currentStartIndex;
        const t = this;
        const maxRuns = 200;
        let run = 1;
        while (run <= maxRuns && (currentStartIndex = contents.indexOf(crit, startIdx)) >= 0) {
            run +=1;
            const currentEndIndex = contents.indexOf(this.dropPointPostfix, currentStartIndex);
            const currentName = contents.substring(currentStartIndex + crit.length, currentEndIndex);
            const currentType = dropPointType;
            if(!t.pluginFactories.hasOwnProperty(currentType)){
                throw new Error("Unknown plugin type: " + currentType);
            }
            const pluginFact = t.pluginFactories[currentType];
            let ph = pluginFact.parsePlaceholder(currentName, content.substring(currentStartIndex, currentEndIndex + 4), /*currentType,*/ currentStartIndex, currentEndIndex + 4, filepath);
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
    }

    /**
     *
     * @param {String} filepath
     * @param {String} content
     * @param {String} partType
     * @return {Placeholder[]}
     */
    findDropPoints(filepath, content, partType) {
        return this.findDropPointsOfType(filepath, content, partType);
    }

    /**
     *
     * @param {String} relativeFilePath
     * @param {String} referenceFilePath
     * @return {String}
     */
    resolveRelativePath(relativeFilePath, referenceFilePath) {
        return path.normalize(path.dirname(referenceFilePath) + "/" + relativeFilePath);
    }

    /**
     *
     * @param {Placeholder[]} dropPointsArray
     */
    replaceRelativeReferences(dropPointsArray) {
        dropPointsArray.forEach(dp =>{
            if (utils.isRelativePath(dp.getName())) {
                if(this.runtime.isProjectPath(dp.getFilePath())){
                    const relative = this.runtime.toRelativeProjectPath(path.dirname(dp.getFilePath()));
                    const newRelative = path.join(relative, dp.getName());
                    dp.setName(newRelative);
                }else{
                    logger.error("Unhandled relative : ", dp);
                    console.trace();
                    throw new Error();
                }
            } else if(dp.isDefaultResourceInclusion()){
                const lastDot = dp.getFilePath().lastIndexOf(".");
                let fp;
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
                const relativeDR = this.runtime.toRelativeProjectPath(fp);
                dp.setName(relativeDR.substring(0, relativeDR.lastIndexOf(".")));
            }
        });
    }

    /**
     *
     * @param {String} filepath
     * @param {String} contents
     * @param {String[]} [partTypePrefixes]
     * @return {Placeholder[]}
     */
    findAllDropPoints(filepath, contents, partTypePrefixes) {
        let ptp = partTypePrefixes;
        if(!partTypePrefixes){
            ptp = this.listDropPointTypes();
        }
        const partNames = [];
        ptp.forEach(type =>{
            const f = this.findDropPointsOfType(filepath, contents, type);
            if (f && f.length) {
                f.forEach(function (pn) {
                    partNames.push(pn);
                });
            }
        });
        return partNames;
    }

    /**
     *
     * @return {String[]}
     */
    listDropPointTypes() {
        const dropPointTypes = Object.keys(this.pluginFactories);
        // Object.keys(this.pluginFactories).forEach(function(pluginName){
        //     dropPointTypes.push(pluginName);
        // });

        dropPointTypes.sort();
        return dropPointTypes;
    }

    /**
     *
     * @param {String} str
     * @return {boolean}
     */
    startsWithDropPointPrefix(str) {
        let startsWith = false;
        this.listDropPointTypes().forEach(function (tp) {
            if (str.indexOf(tp + ':') === 0) {
                startsWith = true;
            }
        });
        return startsWith;
    }

    /**
     *
     * @param {String} filePath
     * @param {String} contents
     * @return {String}
     */
    prepareEditableRefs(filePath, contents) {
        const urlpath = this.runtime.createUrlPathForFile(filePath);
        const editableRef = urlpath.substring(1, urlpath.lastIndexOf('.'));
        let cont = true;
        let startIdx = 0;
        const attrname = 'data-editable';
        while (cont) {
            const attrstart = contents.indexOf(attrname, startIdx);
            if (attrstart < startIdx) {
                cont = false;
            } else {
                const emptyAttr = attrname + '=""';
                const emptyAttrVal = (attrstart === contents.indexOf(emptyAttr, startIdx));
                if (contents.charAt(attrstart + attrname.length) !== '=' || emptyAttrVal) {
                    const newAttr = attrname + '="' + editableRef + '" contenteditable="true" ';
                    let attrEnd = attrstart + attrname.length;
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
    }

    /**
     *
     * @param {String} filepath
     * @param {String} cnt
     * @return {String}
     */
    resolveRelativeLinksInProtostarAttributes(filepath, cnt) {
        const selSameDir = '"ps:./';
        const selParentDir = '"ps:../';
        let cont = cnt;
        const parentSelIdxes = utils.findAllIndexesOf(selParentDir, cont);
        parentSelIdxes.sort();
        parentSelIdxes.reverse();
        parentSelIdxes.forEach(idx =>{
            const nextQuote = cont.indexOf('"', idx + 5);
            const relPath = cnt.substring(idx + 4, nextQuote);
            const resolvedPath = this.resolveRelativePath(relPath, filepath);
            let url = this.runtime.createUrlPathForFile(resolvedPath);
            if (url.indexOf('/ps/') !== 0) {
                url = url.substring(1);
            }
            cont = cont.substring(0, idx + 1) + url + cont.substring(nextQuote);
        });
        const sameSelIdxes = utils.findAllIndexesOf(selSameDir, cont);
        sameSelIdxes.sort();
        sameSelIdxes.reverse();
        sameSelIdxes.forEach(idx =>{
            const nextQuote = cont.indexOf('"', idx + 5);
            const relPath = cnt.substring(idx + 4, nextQuote);
            const resolvedPath = this.resolveRelativePath(relPath, filepath);
            let url = this.runtime.createUrlPathForFile(resolvedPath);
            if (url.indexOf('/ps/') !== 0) {
                url = url.substring(1);
            }
            cont = cont.substring(0, idx + 1) + url + cont.substring(nextQuote);
        });
        const rg = new RegExp('\"ps:', 'g');
        return cont.replace(rg, '"');
    }

    /**
     *
     * @param {String} filePath
     * @param {{}} metadata
     * @return {{content: String, dropPoints: number}}
     */
    readFragment(filePath, metadata) {
        let fragment;// = this.runtime.readFile(filePath);
        if(filePath.substring(filePath.lastIndexOf(".")) === ".jade"){
            fragment = jadeUtils.compileJade(filePath);
        }else if(filePath.substring(filePath.lastIndexOf(".")) === ".hbs"){
            const pcfg = this.runtime.readProjectConfig();
            const src = this.runtime.readFile(filePath);
            fragment = hbsUtils.convertPartialsToFileIncludes(src, pcfg.hbs.partialsDir);
            if(filePath.indexOf(this.runtime.constructProjectPath(pcfg.hbs.partialsDir)) !== 0){
                fragment = hbsUtils.injectHbsLayoutBodyContent(this.runtime.constructProjectPath(pcfg.hbs.layout), fragment);
            }
        }else{
            fragment = this.runtime.readFile(filePath);
        }
        metadata.deps[filePath] = 1;
        let contents = this.prepareEditableRefs(filePath, fragment);
        const fragmentDropPoints = this.findAllDropPoints(filePath, contents, this.listDropPointTypes());
        const relativeDP = [];
        fragmentDropPoints.forEach(fdp =>{
            if(fdp.isRelativePathName() || fdp.isDefaultResourceInclusion()){
                relativeDP.push(fdp);
            }
        });
        relativeDP.sort(sortPlaceholdersByDescendingLocation);
        this.replaceRelativeReferences(relativeDP);
        relativeDP.forEach(rdp =>{
            const newRelTag = this.dropPointPrefix + rdp.getType() + this.dropPointSeparatorName + rdp.getName() + this.dropPointPostfix;
            contents = rdp.replacePartContents(contents , newRelTag);
        });
        const dropPoints = this.findAllDropPoints(filePath, contents, ['wrap']);
        if (dropPoints.length > 0) {
            contents = this.pluginFactories.wrap.applyPlaceholder(dropPoints[0], contents, metadata);
        }
        contents = this.resolveRelativeLinksInProtostarAttributes(filePath, contents);
        return  {
            content: contents,
            dropPoints: -1
        };
    }

    /**
     *
     * @param {String} templateFilename
     * @param {String} template
     * @param {Placeholder[]} placeholders
     * @param metadata
     * @return {string}
     */
    compositionRun(templateFilename, template, placeholders, metadata) {
        let composed = "" + template;
        placeholders.sort((a, b) => -1 * (a.getStart() - b.getStart()));
        logger.debug("Composition run for template file name: " + templateFilename);
        let err;
        let errPart;
        placeholders.forEach(placeholder =>{
            if(!errPart){
                if(!this.pluginFactories.hasOwnProperty(placeholder.getType())){
                    throw new Error("Unknown fotl plugin type " + placeholder.getType());
                }
                const pluginFact = this.pluginFactories[placeholder.getType()];
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
    }

    /**
     * @param request
     * @param response
     * @param {String} content
     * @param {String} viewName
     * @param {String[]} [tagArgs]
     */
    renderBackendView(request, response, content, viewName, tagArgs) {

        let wrapper = '<!-- wrap:/ps/backend/layout-help';
        if(tagArgs){
            if(utils.isArray(tagArgs)){
                let argStr = '';
                tagArgs.forEach(arg =>{
                    const name = arg.name;
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
        const editConfigView = this.runtime.constructAppPath(["core", "backend", "compiled", viewName + ".html"]);
        const helpContent = wrapper + content;
        this.runtime.writeFile(editConfigView, helpContent);
        const composed = this.composeTemplate(editConfigView, helpContent);
        utils.writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
    }

    /**
     * @param {String} filePath
     * @param {String} fileContents
     * @param {Number} maxRuns
     * @return {boolean}
     */
    composesToFullHtmlTemplate(filePath, fileContents, maxRuns) {
        const extension = path.extname(filePath);
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
        const t = this;

        if(utils.endsWith(filePath, ".jade")){
            fileContents = jadeUtils.compileJade(filePath, fileContents);
        }else if(utils.endsWith(filePath, ".hbs")){

            const pcfg = this.runtime.readProjectConfig();
            if(filePath.indexOf(this.runtime.constructProjectPath(pcfg.hbs.partialsDir)) === 0){
                return false;
            }
            if(/\{\{>[ ]*body[ ]*}}]/.test(fileContents)){
                return false;
            }
            fileContents = hbsUtils.convertPartialsToFileIncludes(fileContents, pcfg.hbs.partialsDir);
            fileContents = hbsUtils.injectHbsLayoutBodyContent(this.runtime.constructProjectPath(pcfg.hbs.layout), fileContents);
        }

        const file = this.resolveRelativeLinksInProtostarAttributes(filePath, this.prepareEditableRefs(filePath, "" + fileContents));
        const dropPointTypes = this.listDropPointTypes();
        let names = this.findAllDropPoints(filePath, file, dropPointTypes);
        //console.log("Found droppoints in " + filePath, names);
        let modificationFile = '' + file;
        let runs = 0;
        let mr = 100;
        if (typeof maxRuns === 'number') {
            mr = maxRuns;
        }
        const metadata = {
            templatePath: filePath,
            include: {
                script: [],
                headScript: [],
                style: []
            },
            deps: {}
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


    }

    /**
     * @param {String} filePath
     * @param {String} [fileContents]
     * @param {Number} [maxRuns]
     * @return {{content: String, metadata: Object}}
     */
    composeTemplate(filePath, fileContents, maxRuns) {
        const start = new Date().getTime();
        const extension = path.extname(filePath);
        if (!this.supportedViewTemplateFileExtensions.hasOwnProperty(extension)) {
            throw new Error("Extensions should be one of "+Object.keys(this.supportedViewTemplateFileExtensions).join(',') +": " + filePath);
        }
        if(typeof fileContents !== 'string'){
            fileContents = this.runtime.readFile(filePath, 'utf8');
        }
        const t = this;
        const file = this.resolveRelativeLinksInProtostarAttributes(filePath, this.prepareEditableRefs(filePath, "" + fileContents));
        const dropPointTypes = this.listDropPointTypes();
        let names = this.findAllDropPoints(filePath, file, dropPointTypes);
        //console.log("Found droppoints in " + filePath, names);
        let modificationFile = '' + file;
        let runs = 0;
        let mr = 100;
        if (typeof maxRuns === 'number') {
            mr = maxRuns;
        }
        const metadata = {
            templatePath: filePath,
            include: {
                script: [],
                headScript: [],
                style: []
            },
            deps: {}
        };
        metadata.deps[filePath] = 1;
        while (names && names.length && runs < mr) {
            logger.debug("CompositionRun " + runs + " : " + filePath);
            modificationFile = t.compositionRun(filePath, modificationFile, names, metadata);
            runs += 1;
            names = t.findAllDropPoints(filePath, modificationFile, dropPointTypes);
        }
        const stop = new Date().getTime();
        console.log("Compiled in " + (stop - start) + "ms : " + filePath);
        return {
            content: modificationFile,
            metadata: metadata
        };
    }

    /**
     * @param {String} filePath
     * @return {String}
     */
    composeTemplateCached(filePath) {
        const st = fs.statSync(filePath);
        if(this._compilationCache.hasOwnProperty(filePath)){
            const cached = this._compilationCache[filePath];
            try{
                const newLatest = utils.findLatestMod(filePath, cached.deps);
                if(cached.sourceMod >= newLatest && cached.sourceSize === st.size){
                    return cached.compiled;
                }
            }catch(FindLatestModErr){
                //console.error("Error finding latest mod of " + filePath, FindLatestModErr.stack);
                this._compilationCache[filePath] = undefined;
            }
        }
        const source = this.runtime.readFile(filePath);
        const composed = this.composeTemplate(filePath, source);
        this._compilationCache[filePath] = {
            sourceMod : utils.findLatestMod(filePath, composed.metadata.deps),
            sourceSize : st.size,
            compiled : composed,
            source : source,
            deps : composed.metadata.deps
        };
        logger.debug("Cached compiled template : " + filePath, composed);
        return composed;
    }

    renderNewBackendView(markup, pageData, response) {
        const layout = fs.readFileSync(path.resolve(this.runtime.protostarDirPath, 'core', 'backend', 'layout-backend.html'), 'utf8');
        const hbLayout = this.convertLayoutToHandlebars(layout);
        let pd = {};
        if(pageData){
            pd = pageData;
        }
        pd.main ='<div class="container">' + markup + '</div>';
        const outmarkup = (handlebars.compile(hbLayout))(pd);
        utils.writeResponse(response, 200, {
            'Content-Type': 'text/html; charset=utf-8'
        }, outmarkup);
    }

    renderListingMarkup(links, pageData, response) {
        const tpl = fs.readFileSync(path.resolve(this.runtime.protostarDirPath, 'core', 'assets', 'listing-template-hb.html'), 'utf8');
        const compiled = handlebars.compile(tpl);
        const markup = compiled({
            links: links
        });
        this.renderNewBackendView(markup, pageData, response);
    }
    createErrorMarkup(msg){
        return '<div style="background-color: #f08080">'+msg+'</div>';
    }
    /**
     *
     * @param {String} content
     * @param {String} search
     * @param {Number} start
     * @param {Number} end
     * @return {Number}
     */
    countOccurrencesBetweenIndexes (content, search, start, end) {
        return utils.countOccurrencesBetweenIndexes(content, search, start, end);
    }


    /**
     *
     * @param {String} contents
     * @return {{content: string, markers: Array}}
     */
    decompile(contents) {
    let cnt = contents + "";
    const markers = [];
    let run = true;
    while (run && cnt.indexOf('<!-- begin_') >= 0) {
        logger.info("marker found ..");
        const openMarkerStart = cnt.indexOf('<!-- begin_', 0);
        if (openMarkerStart >= 0) {
            const openMarkerEnd = cnt.indexOf(' -->', openMarkerStart);
            const openMarker = cnt.substring(openMarkerStart, openMarkerEnd + 4);
            const templateDef = openMarker.substring(11, openMarker.length - 4);
            const fragmentType = templateDef.substring(0, templateDef.indexOf("-"));
            let templateName = templateDef.substring(templateDef.indexOf("-") + 1);
            let args = "";
            if (templateDef.indexOf(":") > 0) {
                args = templateDef.substring(templateDef.indexOf(":"));
                templateName = templateDef.substring(templateDef.indexOf("-") + 1, templateDef.indexOf(":"));
            }
            logger.info("Template name: '" + templateName + "' of type " + fragmentType);
            logger.info("Found open marker: " + openMarker);

            const closeTag = "<!-- end_" + templateDef + ' -->';
            logger.info("openclosetag=" + closeTag);
            let closeMarkerStart = cnt.indexOf(closeTag, openMarkerEnd + 4);
            if (closeMarkerStart < 0) {
                throw new Error("Cannot find matching end tag for " + openMarker);
            }
            logger.info("counting outhers, closeMarkerStart = " + closeMarkerStart);
            const openMarkerFull = '<!-- begin_' + fragmentType + "-" + templateName + args + " -->";
            const othersCount = this.countOccurrencesBetweenIndexes(cnt, openMarkerFull, openMarkerEnd, closeMarkerStart);
            const closeMarker = '<!-- end_' + fragmentType + "-" + templateName + args + " -->";
            if (othersCount > 0) {
                logger.info("found others: " + othersCount);

                closeMarkerStart = utils.findNthOccurrence(cnt, closeMarker, othersCount + 1, openMarkerEnd);
                logger.info("actual close is " + closeMarkerStart);
            }

            const theContent = cnt.substring(openMarkerEnd + 4, closeMarkerStart);
            const closeMarkerEnd = cnt.indexOf(' -->', closeMarkerStart) + 4;
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
}


    /**
     *
     * @param {String} contents
     * @return {{content, markers}|*}
     */
    decompileRecursive(contents) {
    const cnt = contents + "";
    const decompiled = this.decompile(cnt);
    const self = this;
    logger.info("Recursive, decompiled root = ", decompiled);
    let changed = true;
    let run = 0;

    function decompileRun(m) {
        if (m.content.indexOf('<!-- begin_') >= 0) {
            const nestedDecompiled = self.decompile(m.content);
            logger.info("Decompiled nested : " + m.name, nestedDecompiled);
            changed = true;
            m.content = nestedDecompiled.content;
            m.nestedMarkers = [];
            nestedDecompiled.markers.forEach(function (mr) {
                decompiled.markers.push(mr);
                m.nestedMarkers.push(mr);
            });
        }
    }

    while (changed && run < 1000) {
        changed = false;
        run += 1;
        decompiled.markers.forEach(decompileRun);
    }
    return decompiled;
}
    postProcessComposed(markup, runtime, callback) {
    if (markup.content.trim().length > 0) {
        const pcfg = runtime.readProjectConfig();
        let addViewScripts = true;
        if (pcfg && utils.nestedPathExists(pcfg, "runtime", "addRuntimeScripts")) {
            if (pcfg.runtime["addRuntimeScripts"] === false) {
                addViewScripts = false;
            }
        }
        const addDoctypeIfMissing = false;
        const metadata = markup.metadata;
        let cnt = markup.content;


        const insertPlaceholderResources = function (markup, metadata) {
            const newHeadTags = [];
            const newBodyTags = [];
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
            let out = markup;
            const olc = out.toLowerCase();
            const closeHeadIdx = olc.indexOf('</head>');
            const closeBodyIdx = olc.indexOf('</body>');
            if (newHeadTags.length > 0 && closeHeadIdx > 0) {
                const preCloseMarkup = out.substring(0, closeHeadIdx);
                const postCloseMarkup = out.substring(closeHeadIdx);
                let newOut = preCloseMarkup;
                newHeadTags.forEach(function (t) {
                    newOut += t + '\n';
                });
                newOut += postCloseMarkup;
                out = newOut;
            }
            if (newBodyTags.length > 0 && closeBodyIdx > 0) {
                const preBodyCloseMarkup = out.substring(0, closeBodyIdx);
                const postBodyCloseMarkup = out.substring(closeBodyIdx);
                let newBodyOut = preBodyCloseMarkup;
                newBodyTags.forEach(function (t) {
                    newBodyOut += t + '\n';
                });
                newBodyOut += postBodyCloseMarkup;
                out = newBodyOut;
            }
            return out;
        };

        cnt = insertPlaceholderResources(cnt, metadata);

        const ensureViewScriptsPresent = function (markup) {
            let out = markup;
            const mlc = markup.toLowerCase();
            const closeIdx = mlc.indexOf('</body>');
            if (closeIdx > 0) {
                let kp = markup.indexOf('keypress.js"') > 0 || markup.indexOf('keypress-2.0.3.min.js"') > 0;
                let uf = markup.indexOf('/assets/uxFrame.js"') > 0;
                const toAdd = [];
                if (!kp) {
                    toAdd.push('<script src="/ps/ext/Keypress/keypress.js" data-backend-only></script>');
                }
                if (!uf) {
                    toAdd.push('<script src="/ps/assets/uxFrame.js" data-backend-only></script>');
                }
                if (toAdd.length > 0) {
                    let newOut = out.substring(0, closeIdx);
                    toAdd.forEach(function (u) {
                        newOut += u + '\n';
                    });
                    newOut += out.substring(closeIdx);
                    out = newOut;
                }
            }
            return out;
        };
        if (addViewScripts) {
            cnt = ensureViewScriptsPresent(cnt);
        }
        let processedHtml = cnt;//$.html();
        if (addDoctypeIfMissing) {
            if (processedHtml.toLowerCase().indexOf('<html') >= 0 && processedHtml.trim().indexOf('<!') !== 0) {
                processedHtml = '<!doctype html>\n' + processedHtml;
            }
        }
        if (false && processedHtml.indexOf('<body') > 0) {
            let bodyHtml = processedHtml.substring(processedHtml.indexOf('<body'), processedHtml.indexOf('</body>'));
            let sourceOpenIdx = bodyHtml.indexOf('src="');
            const sources = [];
            let allJs = '';
            while (sourceOpenIdx > 0) {
                const srcStartIdx = sourceOpenIdx + 5;
                const closeQuoteIdx = bodyHtml.indexOf('"', srcStartIdx + 1);
                const source = bodyHtml.substring(srcStartIdx, closeQuoteIdx);
                if (path.extname(source) === '.js' && source.indexOf('http:') < 0 && source.indexOf('https:') < 0 && source.indexOf('//') < 0 && source.indexOf('/ps/') !== 0 && source.indexOf('/lib/') !== 0) {
                    sources.push(source);
                    const filePath = runtime.resolveUrlPathnameToProjectFile(source);
                    const contents = runtime.readFile(filePath);
                    allJs += "\n\n// Contents from " + filePath + " \n\n" + contents;
                }
                sourceOpenIdx = bodyHtml.indexOf('src="', closeQuoteIdx + 2);
            }
            logger.debug("SCRIPT REFS == ", sources);
            if (allJs.length > 0) {
                const firstSrcIdx = bodyHtml.indexOf('src="' + sources[0]);
                const firstScriptOpenIdx = bodyHtml.lastIndexOf('<script', firstSrcIdx);
                let afterFirstScriptCloseIdx = bodyHtml.indexOf('</script>', firstSrcIdx) + 9;
                const reversedSources = ([].concat(sources)).reverse();
                let modHtml = bodyHtml;
                reversedSources.forEach(function (source) {
                    const srcStartIdx = bodyHtml.indexOf('src="' + sources[0]);
                    const scriptOpenIdx = bodyHtml.lastIndexOf('<script', srcStartIdx);
                    const afterScriptIdx = bodyHtml.indexOf('</script>', srcStartIdx) + 9;
                    modHtml = modHtml.substring(0, scriptOpenIdx) + "\n" + modHtml.substring(afterScriptIdx);
                });
                const scriptTag = '<script type="text/javascript">\n' + allJs + '\n</script>\n';
                modHtml = modHtml.substring(0, firstScriptOpenIdx) + scriptTag + modHtml.substring(firstScriptOpenIdx);
                bodyHtml = modHtml;
                processedHtml = processedHtml.substring(0, processedHtml.indexOf('</head>')) + '</head>' + bodyHtml + '</html>';
            }
        }
        const psBaseId = "psGenId_" + new Date().getTime() + "_";
        const idxes = utils.findAllIndexesOf(' data-editable=', processedHtml);
        idxes.sort();
        idxes.reverse();
        idxes.forEach(function (i, cidx) {
            const before = processedHtml.substring(0, i);
            const after = processedHtml.substring(i + ' data-editable='.length);
            const newText = ' id="' + psBaseId + '_' + (cidx + 1) + '" data-editable=';
            processedHtml = before + newText + after;

        });
        if (processedHtml.indexOf('class="component-control id-') > 0) {
            const parts = processedHtml.split('class="component-control id-');
            const partsWithPortletIdsAssigned = [];
            parts.forEach(function (p, idx) {
                if (idx < 1) {
                    partsWithPortletIdsAssigned.push(p);
                } else {
                    const rnd = Math.floor(Math.random() * 100000) + "_" + (new Date().getTime());
                    const portletId = "portletId_" + rnd;
                    const portletNamespace = "nsPortlet_" + rnd + "_";
                    /*
                     "namespace": "[Plugin:Portlet key='namespace' compute='once']",
                     "portletWindowID": "[Plugin:Portlet key='windowID']",
                     "portletMode" : "[Plugin:Portlet key='portletMode']",
                     "windowState" : "[Plugin:Portlet key='windowState']",
                     "serverTime" : "[plugin:getDate format='dd/MM/yyyy HH:mm:ss']"
                     */
                    const spaceIdx = p.indexOf(' ');
                    const quoteIdx = p.indexOf('"');
                    const firstIdx = Math.min(spaceIdx, quoteIdx);
                    let newPart = portletId + p.substring(firstIdx);
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
}
    replaceMarkedContentWithDropPoints(contents) {
        let processed = '' + contents;
        let markers = this.decompile(processed);
        while (markers.length > 0) {
            const m = markers[0];
            processed = (processed.substring(0, m.getStart()) + '<!-- file:' + m.getName()+ ' -->' + processed.substring(m.getEnd() + 1));
            markers = this.decompile(processed);
        }
        return processed;
    }
    /**
     *
     * @param {String} beginMarker
     * @param {Number} index
     * @param {Number} closeIdx
     * @param {String} contents
     * @return {{name: (string|*), type: (string|*), start: *, end: *, length: number, content: (string|*)}}
     */
    parseMarker(beginMarker, index, closeIdx, contents) {
        const idxUnd = beginMarker.indexOf('_');
        const idxDash = beginMarker.indexOf('-', idxUnd);
        const type = beginMarker.substring(idxUnd + 1, idxDash);
        const name = beginMarker.substring(idxDash + 1, beginMarker.indexOf(' ', idxDash));

        const endMarkerBegin = contents.indexOf('<!-- end_' + type + "-" + name + ' -->');
        const endMarkerEnd = contents.indexOf(' -->', endMarkerBegin);
        return {
            name: name,
            type: type,
            start: index,
            end: endMarkerEnd + 5,
            length: (endMarkerBegin - 1) - (closeIdx + 5),
            content: contents.substring(closeIdx + 5, endMarkerBegin - 1)
        };
    }
}

module.exports = TemplateComposer;