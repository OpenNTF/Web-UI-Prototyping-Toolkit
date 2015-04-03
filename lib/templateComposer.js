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

var Placeholder = utils.Placeholder;

function sortPlaceholdersByDescendingLocation(a, b) {
    return -1 * (a.getStart() - b.getStart());
}

function TemplateComposer(args) {
    var runtime;
    var dropPointTypes, dropPointPrefixes, maxCompilationRuns = 100;


    var dropPointPrefix = '<!-- ';
    var dropPointPostfix = ' -->';
    var dropPointSeparatorName = ':';
    var dropPointSeparatorArgs = ',';
    this.dropPointPrefix = dropPointPrefix;
    this.dropPointPostfix = dropPointPostfix;
    this.dropPointSeparatorName = dropPointSeparatorName;
    this.dropPointSeparatorArgs = dropPointSeparatorArgs;

    this.pluginFactories = {};

    this.parseArgs = function (args) {
        runtime = args.runtime;
        this.runtime = runtime;
        var uc = runtime.readUserConfig();
        dropPointTypes = uc.dropPointTypes;
        this.dropPointTypes = dropPointTypes;
        maxCompilationRuns = uc.maxCompilationRuns;
        this.pluginFactories = this.loadPluginFactories();
    };
    var theComposer = this;
    this.loadedPlugins = false;
    this.loadPluginFactories = function(){
        if(this.loadedPlugins){
            throw new Error("Plugins already loaded!");
        }
        var plugins = {};
        var fileNames = runtime.listDir(__dirname);
        console.trace("Loading plugin factories");
        fileNames.forEach(function(fn){
            if(fn.indexOf("fotl-") === 0 && fn.substring(fn.length-3) === ".js"){
                var pluginName = fn.substring(5, fn.length-3);
                var fact = require("./fotl-" + pluginName).createFactory({
                    runtime:runtime,
                    composer:theComposer
                });
                plugins[pluginName] = fact;
                console.log("Loaded plugin factory for " + pluginName);
            }
        });
        return plugins;
    };

    this.findDropPointsOfType = function(filepath, content, dropPointType) {
        if (arguments.length !== 3) {
            throw new Error('findDropPointsOfType requires 3 args');
        }
        var contents = '' + content;
        var crit = dropPointPrefix + dropPointType + dropPointSeparatorName;
        var dropPointNames = [];
        var startIdx = 0;
        var currentStartIndex;
        var t = this;
        var maxRuns = 200;
        var run = 1;
        while (run <= maxRuns && (currentStartIndex = contents.indexOf(crit, startIdx)) >= 0) {
            run +=1;
            var currentEndIndex = contents.indexOf(dropPointPostfix, currentStartIndex);
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

    this.findDropPoints = function(filepath, content, partType){
        return this.findDropPointsOfType(filepath, content, partType);
    };

    this.resolveRelativePath = function(relativeFilePath, referenceFilePath) {
        return path.normalize(path.dirname(referenceFilePath) + "/" + relativeFilePath);
    };

    this.replaceRelativeReferences = function(dropPointsArray) {
        var t= this;
        dropPointsArray.forEach(function (dp) {
            if (utils.isRelativePath(dp.getName())) {
                if(runtime.isProjectPath(dp.getFilePath())){
                    var relative = runtime.toRelativeProjectPath(path.dirname(dp.getFilePath()));
                    var newRelative = path.join(relative, dp.getName());
                    dp.setName(newRelative);
                }else{
                    console.error("Unhandled relative : ", dp);
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
                var relativeDR = runtime.toRelativeProjectPath(fp);
                dp.setName(relativeDR.substring(0, relativeDR.lastIndexOf(".")));
            }
        });
    };

    this.findAllDropPoints = function(filepath, contents, partTypePrefixes) {
        var ptp = partTypePrefixes;
        if(!partTypePrefixes){
            ptp = this.dropPointTypes;
        }
        var partNames = [];
        var t = this;
        ptp.forEach(function (type, idx) {
            var f = t.findDropPointsOfType(filepath, contents, type);
            if (f && f.length) {
                f.forEach(function (pn) {
                    partNames.push(pn);
                });
            }
        });
        return partNames;
    };

    this.createErrorMarkup = createErrorMarkup;
    function createErrorMarkup(msg){
        return '<div style="background-color: #f08080">'+msg+'</div>';
    }

    this.startsWithDropPointPrefix = function (str) {
        var startsWith = false;
        dropPointTypes.forEach(function (tp) {
            if (str.indexOf(tp + ':') === 0) {
                startsWith = true
            }
        });
        return startsWith;
    };

    this.prepareEditableRefs = function(filePath, contents) {
        var urlpath = runtime.createUrlPathForFile(filePath);
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

    this.resolveRelativeLinksInProtostarAttributes= function(filepath, cnt) {
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
            var url = runtime.createUrlPathForFile(resolvedPath);
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
            var url = runtime.createUrlPathForFile(resolvedPath);
            if (url.indexOf('/ps/') !== 0) {
                url = url.substring(1);
            }
            cont = cont.substring(0, idx + 1) + url + cont.substring(nextQuote);
        });
        var rg = new RegExp('\"ps:', 'g');
        return cont.replace(rg, '"');
    };

    this.readFragment = function(filePath, metadata) {
        var fragment = runtime.readFile(filePath);
        metadata.deps[filePath] = 1;
        var t= this;
        var contents = t.prepareEditableRefs(filePath, fragment);
        var fragmentDropPoints = t.findAllDropPoints(filePath, contents, runtime.userConfig.dropPointTypes);
        var relativeDP = [];
        fragmentDropPoints.forEach(function(fdp){
            if(fdp.isRelativePathName() || fdp.isDefaultResourceInclusion()){
                relativeDP.push(fdp);
            }
        });
        relativeDP.sort(sortPlaceholdersByDescendingLocation);
        t.replaceRelativeReferences(relativeDP);
        relativeDP.forEach(function(rdp){
            var newRelTag = dropPointPrefix + rdp.getType() + dropPointSeparatorName + rdp.getName() + dropPointPostfix;
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

    this.compositionRun = function (templateFilename, template, placeholders, metadata) {
        var composed = "" + template;
        placeholders.sort(function (a, b) {
            return -1 * (a.getStart() - b.getStart());
        });
        logger.debug("Composition run for template file name: " + templateFilename);
        var t = this;
        placeholders.forEach(function (placeholder) {
            if(!t.pluginFactories.hasOwnProperty(placeholder.getType())){
                throw new Error("Unknown fotl plugin type " + placeholder.getType());
            }
            var pluginFact = t.pluginFactories[placeholder.getType()];
            composed = pluginFact.applyPlaceholder(placeholder, composed, metadata, templateFilename);
        });
        return composed;
    };

    this.renderBackendView = function (request, response, content, viewName, tagArgs) {

        var wrapper = '<!-- wrap:/ps/backend/layout-help';
        if(tagArgs){
            if(utils.isArray(tagArgs)){
                var argStr = '';
                tagArgs.forEach(function(arg){
                    var name = arg.name;
                    if(arg.hasOwnProperty("text")){
                        if(argStr){
                            argStr += ';'
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
        var editConfigView = runtime.constructAppPath(["core", "backend", "compiled", viewName+".html"]);
        var helpContent = wrapper + content;
        runtime.writeFile(editConfigView, helpContent);
        var composed = this.composeTemplate(editConfigView, helpContent);
        utils.writeResponse(response, 200, {"Content-Type": "text/html; charset=utf-8"}, composed.content);
    },

    this.composeTemplate = function (filePath, fileContents, maxRuns) {
        if (filePath.substring(filePath.lastIndexOf(".") + 1) !== "html") {
            throw new Error("Should be an *.html file : " + filePath);
        }
        var t = this;
        var file = this.resolveRelativeLinksInProtostarAttributes(filePath, this.prepareEditableRefs(filePath, "" + fileContents));
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

    this.composeTemplateCached = function(filePath){
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
        var source = runtime.readFile(filePath);
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
    this.parseArgs(args);
}

var countOccurrencesBetweenIndexes = function (content, search, start, end) {
    return utils.countOccurrencesBetweenIndexes(content, search, start, end);
};

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
var parseMarker = function (beginMarker, index, closeIdx, contents) {
    var idxUnd = beginMarker.indexOf('_');
    var idxDash = beginMarker.indexOf('-', idxUnd);
    var type = beginMarker.substring(idxUnd + 1, idxDash);
    var name = beginMarker.substring(idxDash + 1, beginMarker.indexOf(' ', idxDash));

    var endMarkerBegin = contents.indexOf('<!-- end_' + type + "-" + name + ' -->');
    var endMarkerEnd = contents.indexOf(' -->', endMarkerBegin);
    var marker = {
        name: name,
        type: type,
        start: index,
        end: endMarkerEnd + 5,
        length: (endMarkerBegin - 1) - (closeIdx + 5),
        content: contents.substring(closeIdx + 5, endMarkerBegin - 1)
    };
    return marker;
};
module.exports = {
    createTemplateComposer: function (args) {
        return new TemplateComposer(args);
    },
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
    }
};