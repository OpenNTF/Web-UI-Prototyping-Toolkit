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

var fs = require("fs"), path = require("path"), utils = require("./utils");
var Handlebars = require("handlebars");

var Lorem = require("./lorem").Lorem;

var logger = utils.createLogger({sourceFilePath : __filename});

function Placeholder(args) {
    this._name = args.name;
    this._type = args.type;
    this._start = args.start;
    this._end = args.end;
    this._tag = args.tag;
    this._args = args.args;
    if (!args.hasOwnProperty('filepath')) {
        throw new Error("missing filepath");
    }
    this._filepath = args.filepath;

    this.getName = function(){ return this._name;};
    this.getType = function(){return this._type;};
    this.getStart = function(){return this._start;};
    this.getEnd = function(){return this._end;};
    this.getTag = function(){return this._tag};
    this.getArgs = function(){return this._args};

    this.hasArgs = function(){
        return this._args && this._args.length > 0;
    };
    this.getFilePath = function(){return this._filepath;};
    this.isOfType = function(type){
        return this._type === type;
    };
    this.setName = function(name){
        this._name = name;
    };
    this.isNamed = function(name){
        return this._name === name;
    };
    this.isRelativePathName = function(){
        return this._name.indexOf("./") === 0 || this._name.indexOf("../") === 0;
    };
    this.isDefaultResourceInclusion = function(){
        return this._name === 'default' && (this._type === 'linkScript' || this._type==='linkCss')
    }

}
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

    var parseArgs = function (args) {
        runtime = args.runtime;
        var uc = runtime.readUserConfig();
        dropPointTypes = uc.dropPointTypes;
        maxCompilationRuns = uc.maxCompilationRuns;
    };

    var createPlaceholder = function (args) {
        var ph = new Placeholder(args);
        if (ph.getName().indexOf('=') > 0) throw new Error();
        return ph;
    };

    function findDropPointsOfType(filepath, content, dropPointType) {
        if (arguments.length !== 3) {
            throw new Error('findDropPointsOfType requires 3 args');
        }
        var contents = '' + content;
        var crit = dropPointPrefix + dropPointType + dropPointSeparatorName;
        var dropPointNames = [];
        var startIdx = 0;
        var currentStartIndex;
        while ((currentStartIndex = contents.indexOf(crit, startIdx)) >= 0) {
            var currentEndIndex = contents.indexOf(dropPointPostfix, currentStartIndex);
            var currentName = contents.substring(currentStartIndex + crit.length, currentEndIndex);
            var currentType = dropPointType;
            if (currentType === 'content') {
                var contentColonIdx = currentName.indexOf(dropPointSeparatorName);
                var contentNameOnly;
                if (contentColonIdx > 0) {
                    contentNameOnly = currentName.substring(0, contentColonIdx);
                } else {
                    contentNameOnly = currentName;
                }
                var dpargs = undefined;
                if (contentNameOnly.indexOf('(') > 0) {
                    dpargs = [contentNameOnly.substring(contentNameOnly.indexOf('(') + 1, contentNameOnly.length - 1)];
                    contentNameOnly = contentNameOnly.substring(0, contentNameOnly.indexOf('('));
                }
                var contentPlaceholder = createPlaceholder({
                    name: contentNameOnly,
                    start: currentStartIndex,
                    end: currentEndIndex + 4,
                    type: dropPointType,
                    tag: content.substring(currentStartIndex, currentEndIndex + 4),
                    filepath: filepath,
                    args: dpargs
                });
                dropPointNames.push(contentPlaceholder);
            } else if (currentType === "layout" || currentType === "wrap" || currentType === "hb") {
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
                    dropPointNames.push(createPlaceholder({
                        name: currentName.substring(0, currentName.indexOf('(')),
                        start: currentStartIndex,
                        end: currentEndIndex + 4,
                        type: dropPointType,
                        tag: content.substring(currentStartIndex, currentEndIndex + 4),
                        filepath: filepath,
                        args: layoutArgs
                    }));
                } else {
                    var colonIdx = currentName.indexOf(dropPointSeparatorName);
                    var nameOnly;
                    if (colonIdx > 0) {
                        nameOnly = currentName.substring(0, colonIdx);
                    } else {
                        nameOnly = currentName;
                    }
                    var argsText = currentName.substring(colonIdx + 1);
                    var args = argsText.split(dropPointSeparatorArgs);
                    if (nameOnly.length === 0) {
                        throw new Error("Illegal nameOnly");
                    }
                    dropPointNames.push(createPlaceholder({
                        name: nameOnly,
                        start: currentStartIndex,
                        end: currentEndIndex + 4,
                        type: dropPointType,
                        tag: content.substring(currentStartIndex, currentEndIndex + 4),
                        filepath: filepath,
                        args: args
                    }));
                }
            } else if(currentType === "lorem"){
                var o;
                if(currentName.indexOf('(') >0){
                    var loremName = currentName.substring(0, currentName.indexOf('('));
                    var laremArgs = currentName.substring(currentName.indexOf('(')+1, currentName.lastIndexOf(')'));
                    var loremArgsSplit = laremArgs.split(dropPointSeparatorArgs);
                    o = createPlaceholder({
                        name: loremName,
                        start: currentStartIndex,
                        tag: content.substring(currentStartIndex, currentEndIndex + 4),
                        end: currentEndIndex + 4,
                        type: dropPointType,
                        filepath: filepath,
                        args: loremArgsSplit

                    });

                }else{
                    o = createPlaceholder({
                        name: currentName,
                        start: currentStartIndex,
                        tag: content.substring(currentStartIndex, currentEndIndex + 4),
                        end: currentEndIndex + 4,
                        type: dropPointType,
                        filepath: filepath,
                        args: []

                    });
                }
                dropPointNames.push(o);
            } else {
                if (currentName.length === 0) {
                    throw new Error("Illegal name");
                }
                dropPointNames.push(createPlaceholder({
                    name: currentName,
                    start: currentStartIndex,
                    tag: content.substring(currentStartIndex, currentEndIndex + 4),
                    end: currentEndIndex + 4,
                    type: dropPointType,
                    filepath: filepath,
                    args: []

                }));
            }
            startIdx = currentEndIndex + 4;
        }
        //replaceRelativeReferences(dropPointNames);
        return dropPointNames;
    }

    this.findDropPoints = function(filepath, content, partType){
        return findDropPointsOfType(filepath, content, partType);
    };

    function resolveRelativePath(relativeFilePath, referenceFilePath) {
        return path.normalize(path.dirname(referenceFilePath) + "/" + relativeFilePath);
    }

    function replaceRelativeReferences(dropPointsArray) {
        dropPointsArray.forEach(function (dp) {
            if (utils.isRelativePath(dp.getName())) {
                console.log("Resolving relative droppoint " + dp.getName() + " in path " + dp.getFilePath());
                if(runtime.isProjectPath(dp.getFilePath())){
                    var relative = runtime.toRelativeProjectPath(path.dirname(dp.getFilePath()));
                    console.log("Relative source = " + relative);
                    var newRelative = path.join(relative, dp.getName());
                    console.log("NEW RELATIVE = " + newRelative);
                    if(newRelative === 'aCmp'){
                        console.log("ILLEGAL", dp);
                        console.trace();
                        throw new Error('aCmp');
                    }
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
    }

    function findAllDropPoints(filepath, contents, partTypePrefixes) {
        var partNames = [];
        partTypePrefixes.forEach(function (type, idx) {
            var f = findDropPointsOfType(filepath, contents, type);
            if (f && f.length) {
                f.forEach(function (pn) {
                    partNames.push(pn);
                });
            }
        });
        return partNames;
    }

    this.findAllDropPoints = function (filepath, contents, partTypePrefixes) {
        return findAllDropPoints(filepath, contents, partTypePrefixes);
    };

    function replacePartContents(content, part, partContents, addMarkers) {
        var am = false;
        if(typeof addMarkers === 'boolean'){
            am = addMarkers;
        }
        if(am){
            var partArgs = "";
            if (part.hasArgs()) {
                partArgs = ":" + part.getArgs().join();
            }
            var prefix = '<!-- begin_' + part.getType() + '-' + part.getName()+ partArgs + ' -->';
            var postfix = '<!-- end_' + part.getType() + '-' + part.getName() + partArgs + ' -->';
            return content.substring(0, part.getStart()) + prefix + partContents + postfix + content.substring(part.getEnd());
        }else{
            return content.substring(0, part.getStart()) + partContents + content.substring(part.getEnd());
        }
    }

    this.replacePartContents = replacePartContents;

    function replacePartContentsWithoutMarking(content, part, partContents) {
        return content.substring(0, part.getStart()) + partContents + content.substring(part.getEnd());
    }

    function readLoremLines(){
        var loremTxt = runtime.readAppFile(["core", "assets", "lorem.txt"]);
        return loremTxt.split('\n');
    }

    function applyLoremPlaceholder(part, composed) {
        var lines = readLoremLines();
        var lorem = new Lorem({
            lines: lines
        });
        var partArgs = part.getArgs();
        var partName = part.getName();
        var replacement = lorem.determineReplacement(partName, partArgs);
        return replacePartContents(composed, part, replacement);
    }
    function replaceFilePlaceholder(part, composed, metadata) {
        var partContents;
        try{
            var fileName = runtime.resolveFilePathForPlaceHolder(part);
            if (!runtime.isExistingFilePath(fileName)) {
                console.warn("Doesn't exist: " + fileName);
            } else {
                metadata.deps[fileName] = 1;
                var partData = readFragment(fileName, metadata);
                partContents = ("" + partData.content).trim();
            }
        }catch(e){
            logger.error("Error while processing part");
            logger.info("Error while parsing part: ", part);
            console.trace();
            partContents = createErrorMarkup('Could not process ' + part.getType() + ':' + part.getName());
        }
        return replacePartContents(composed, part, partContents);
    }

    function createErrorMarkup(msg){
        return '<div style="background-color: #f08080">'+msg+'</div>';
    }

    function replaceLayoutPlaceholderByName(layoutPlaceholder, composed, metadata) {
        var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
        metadata.deps[layoutTemplatePath] = 1;
        var layoutTemplateContents = readFragment(layoutTemplatePath, metadata);
        var layoutTemplate = layoutTemplateContents.content.trim();
        var layoutContentDropPoints = findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
        if (runtime.isDebug()) {
            logger.info("Found content drop points in " + layoutTemplatePath + ":", layoutContentDropPoints);
        }
        layoutContentDropPoints.reverse();
        if(runtime.isDebug()){
            logger.info("Processing layout placeholder by name : ", layoutPlaceholder);
        }
        var layoutPlaceholderArgs = layoutPlaceholder.getArgs();
        layoutPlaceholderArgs.reverse();
        if (!(layoutPlaceholderArgs.length > 0 && layoutPlaceholderArgs[0].indexOf('=') > 0)) {
            throw new Error("Not leveraging name based mapping");
        }
        var placeholderArgsByName = {};
        layoutPlaceholderArgs.forEach(function (phArg) {
            var argName = phArg.substring(0, phArg.indexOf('='));
            var argValue = phArg.substring(phArg.indexOf('=') + 1);
            var argValues;
            if (argValue.indexOf(',') > 0) {
                argValues = argValue.split(',');
            } else {
                argValues = [argValue];
            }
            if(runtime.isDebug()){
                logger.info(argName + " == ", argValues);
            }
            placeholderArgsByName[argName] = argValues;
        });
        if(runtime.isDebug()){
            logger.info("generated args by name : ", placeholderArgsByName);
        }
        //by name
        for (var dpIdx = 0; dpIdx < layoutContentDropPoints.length; dpIdx += 1) {
            var layoutContentDropPoint = layoutContentDropPoints[dpIdx];
            if(runtime.isDebug()){
                logger.info("Placeholder args: ", layoutContentDropPoint);
            }
            var specifiedArgs = placeholderArgsByName[layoutContentDropPoint.getName()];
            if (runtime.isDebug()) {
                logger.info("Specified args for " + layoutContentDropPoint.getName() + ":", specifiedArgs);
                logger.info("Found args for droppoint " + layoutContentDropPoint.getName() + ": ", specifiedArgs);
            }
            var namedDropPointReplacement = '';
            if(utils.isDefined(specifiedArgs)){
                specifiedArgs.forEach(function (s) {
                    if (s.charAt(0) === "'" || s.charAt(0) === '"') {
                        namedDropPointReplacement += s.substring(1, s.length - 1);
                    } else {
                        if (!startsWithDropPointPrefix(s)) {
                            console.error("Error parsing droppoint args : ", specifiedArgs);
                            throw new Error("Missing type prefix (eg file:) in " + s);
                        }
                        namedDropPointReplacement += dropPointPrefix + s + dropPointPostfix;
                    }
                });
            }
            if (layoutContentDropPoints[dpIdx].hasArgs()) {
                if(runtime.isDebug()){
                    logger.info("CONTENT WITH WRAP ARGS : ", layoutContentDropPoints[dpIdx]);
                }
                var wrapperArg = layoutContentDropPoints[dpIdx].getArgs()[0];
                var wrapperName = wrapperArg.substring(wrapperArg.indexOf('=')+1);
                var up = (wrapperName.charAt(0) === '/' ? wrapperName : '/' + wrapperName)+".html";
                var wrapperFilePath = runtime.findFileForUrlPathname(up);
                metadata.deps[wrapperFilePath] = 1;
                var wrapperContents = runtime.readFile(wrapperFilePath);
                var contentDropPoints = findDropPointsOfType(wrapperFilePath, wrapperContents, "content");
                contentDropPoints.forEach(function(wdp){
                    if(wdp.isNamed('main')){
                        namedDropPointReplacement = replacePartContents(wrapperContents, wdp, namedDropPointReplacement);
                    }
                });
            }
            if(runtime.isDebug()){
                logger.debug("Replacing named for droppoint with '" + namedDropPointReplacement + "' in markup :" + layoutTemplate);
            }
            layoutTemplate = replacePartContents(layoutTemplate, layoutContentDropPoint, namedDropPointReplacement);
        }
        return replacePartContents(composed, layoutPlaceholder, layoutTemplate);
    }

    function replaceLayoutPlaceholderByOrder(layoutPlaceholder, composed, metadata) {
        try {
            var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
            metadata.deps[layoutTemplatePath] = 1;
        }catch(lpe){
            logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.placeholder);
            return replacePartContents(composed, layoutPlaceholder, createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.placeholder));
        }
        var layoutTemplateContents = readFragment(layoutTemplatePath, metadata);
        var layoutTemplate = layoutTemplateContents.content.trim();
        var layoutContentDropPoints = findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
        if (runtime.isDebug()) {
            logger.info("Found content drop points in " + layoutTemplatePath + ":", layoutContentDropPoints);
        }
        layoutContentDropPoints.reverse();
        var layoutPlaceholderArgs = layoutPlaceholder.getArgs();
        layoutPlaceholderArgs.reverse();
        if(layoutPlaceholderArgs.length > 0){
            var parIdx = layoutPlaceholderArgs[0].indexOf('(');
            var eqIdx = layoutPlaceholderArgs[0].indexOf('=');
            if(eqIdx > 0 && (parIdx < 0 || parIdx > eqIdx )){
                throw new Error("Mapping by name ");
            }
        }
        //by order
        for (var dpIdx = 0; dpIdx < layoutContentDropPoints.length; dpIdx += 1) {
            var currentDroppoint = layoutContentDropPoints[dpIdx];
            var currentDroppointArgs = layoutPlaceholderArgs[dpIdx];
            if(runtime.isDebug()){
                console.log("Processing content droppoint " + dpIdx + ": ", currentDroppoint);
                console.log("Processing content droppoint " + dpIdx + " with args :", currentDroppointArgs);
            }
            var orderedDropPointReplacement = '';
            if(utils.isDefined(currentDroppointArgs)){
                if (currentDroppointArgs.indexOf(',') > 0) {
                    var splitArgs = currentDroppointArgs.split(',');
                    splitArgs.forEach(function (dpArg) {
                        if (dpArg.charAt(0) === "'" || dpArg.charAt(0) === '"') {
                            orderedDropPointReplacement += dpArg.substring(1, dpArg.length - 1);
                        } else {
                            if (!startsWithDropPointPrefix(dpArg)) {
                                throw new Error("Missing type prefix (eg file:) in " + dpArg);
                            }
                            orderedDropPointReplacement += dropPointPrefix + dpArg + dropPointPostfix;
                        }
                    });
                } else {
                    if (currentDroppointArgs.charAt(0) === "'" || currentDroppointArgs.charAt(0) === '"') {
                        orderedDropPointReplacement = currentDroppointArgs.substring(1, currentDroppointArgs.length - 1);
                    } else {
                        if (!startsWithDropPointPrefix(currentDroppointArgs)) {
                            throw new Error("Missing type prefix (eg file:) in " + currentDroppointArgs);
                        }
                        orderedDropPointReplacement = dropPointPrefix + currentDroppointArgs + dropPointPostfix;
                    }
                }
            }
            if (currentDroppoint.getArgs()) {
                if(runtime.isDebug()){
                    logger.debug("CONTENT WITH WRAP ARGS : ", currentDroppoint);
                }
                var wrapperArg = currentDroppoint.getArgs()[0];
                var wrapperName = wrapperArg.substring(wrapperArg.indexOf('=')+1);
                var up = (wrapperName.charAt(0) === '/' ? wrapperName : '/' + wrapperName)+".html";
                var wrapperFilePath = runtime.findFileForUrlPathname(up);
                metadata.deps[wrapperFilePath] = 1;
                var wrapperContents = runtime.readFile(wrapperFilePath);
                var contentDropPoints = findDropPointsOfType(wrapperFilePath, wrapperContents, "content");
                contentDropPoints.forEach(function(wdp){
                    if(wdp.isNamed('main')){
                        orderedDropPointReplacement = replacePartContents(wrapperContents, wdp, orderedDropPointReplacement);
                    }
                });
            }
            layoutTemplate = replacePartContents(layoutTemplate, currentDroppoint, orderedDropPointReplacement);
        }
        return replacePartContents(composed, layoutPlaceholder, layoutTemplate);
    }

    function replaceLayoutPlaceholder(layoutPlaceholder, composed, metadata) {
        try {
            var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
        } catch (e) {
            logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName());
            logger.info("Error for droppoint : ", layoutPlaceholder);
            return replacePartContents(composed, layoutPlaceholder, createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName()));
        }
        metadata.deps[layoutTemplatePath] = 1;
        var layoutTemplateContents = readFragment(layoutTemplatePath, metadata);
        var layoutTemplate = layoutTemplateContents.content.trim();
        var layoutContentDropPoints = findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
        if (runtime.isDebug()) {
            logger.info("Found content drop points in " + layoutTemplatePath + ":", layoutContentDropPoints);
        }
        layoutContentDropPoints.reverse();
        var layoutPlaceholderArgs = layoutPlaceholder.getArgs();
        layoutPlaceholderArgs.reverse();
        if(layoutPlaceholderArgs.length > 0){
            var parIdx = layoutPlaceholderArgs[0].indexOf('(');
            var eqIdx = layoutPlaceholderArgs[0].indexOf('=');
            if(eqIdx > 0 && (parIdx < 0 || parIdx > eqIdx )){
                return replaceLayoutPlaceholderByName(layoutPlaceholder, composed, metadata);
            }
        }
        return replaceLayoutPlaceholderByOrder(layoutPlaceholder, composed, metadata);
    }

    var startsWithDropPointPrefix = function (str) {
        var startsWith = false;
        dropPointTypes.forEach(function (tp) {
            if (str.indexOf(tp + ':') === 0) {
                startsWith = true
            }
        });
        return startsWith;
    };

    function prepareEditableRefs(filePath, contents) {
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
    }

    this.prepareEditableRefs = prepareEditableRefs;

    function findAllIndexesOf(find, content) {
        var idxs = [];
        var from = 0;
        while (from < content.length) {
            var match = content.indexOf(find, from);
            if (match < from) {
                from = content.length;
            } else {
                idxs.push(match);
                from = match + 1;
            }
        }
        return idxs;
    }

    function resolveRelativeLinksInProtostarAttributes(filepath, cnt) {
        var selSameDir = '"ps:./';
        var selParentDir = '"ps:../';
        var cont = cnt;
        var parentSelIdxes = findAllIndexesOf(selParentDir, cont);
        parentSelIdxes.sort();
        parentSelIdxes.reverse();
        parentSelIdxes.forEach(function (idx) {
            var nextQuote = cont.indexOf('"', idx + 5);
            var relPath = cnt.substring(idx + 4, nextQuote);
            var resolvedPath = resolveRelativePath(relPath, filepath);
            logger.info("Resolved relative link " + relPath + " to " + resolvedPath);
            var url = runtime.createUrlPathForFile(resolvedPath);
            if (url.indexOf('/ps/') !== 0) {
                url = url.substring(1);
            }
            cont = cont.substring(0, idx + 1) + url + cont.substring(nextQuote);

        });
        var sameSelIdxes = findAllIndexesOf(selSameDir, cont);
        sameSelIdxes.sort();
        sameSelIdxes.reverse();
        sameSelIdxes.forEach(function (idx) {
            var nextQuote = cont.indexOf('"', idx + 5);
            var relPath = cnt.substring(idx + 4, nextQuote);
            logger.info("Found rel link = " + relPath);
            var resolvedPath = resolveRelativePath(relPath, filepath);
            logger.info("Resolved to " + resolvedPath);
            var url = runtime.createUrlPathForFile(resolvedPath);
            if (url.indexOf('/ps/') !== 0) {
                url = url.substring(1);
            }
            logger.info("End result = " + url);
            cont = cont.substring(0, idx + 1) + url + cont.substring(nextQuote);
        });
        var rg = new RegExp('\"ps:', 'g');
        return cont.replace(rg, '"');
    }

    function readFragment(filePath, metadata) {
        logger.debug("Reading fragment " + filePath);
        var fragment = runtime.readFile(filePath);
        metadata.deps[filePath] = 1;
        var contents = prepareEditableRefs(filePath, fragment);
        var fragmentDropPoints = findAllDropPoints(filePath, contents, runtime.userConfig.dropPointTypes);
        var relativeDP = [];
        fragmentDropPoints.forEach(function(fdp){
            if(fdp.isRelativePathName() || fdp.isDefaultResourceInclusion()){
                relativeDP.push(fdp);
            }
        });
        relativeDP.sort(sortPlaceholdersByDescendingLocation);
        replaceRelativeReferences(relativeDP);
        relativeDP.forEach(function(rdp){
            var newRelTag = dropPointPrefix + rdp.getType() + dropPointSeparatorName + rdp.getName() + dropPointPostfix;
            contents = replacePartContents(contents, rdp, newRelTag);
        });
        var dropPoints = findAllDropPoints(filePath, contents, ['wrap']);
        if (dropPoints.length > 0) {
            contents = applyWrapPlaceholder(dropPoints[0], contents, metadata);
        }
        contents = resolveRelativeLinksInProtostarAttributes(filePath, contents);
        return  {
            content: contents,
            dropPoints: -1
        };
    }

    function applyWrapPlaceholder(partName, composed, metadata) {
        var wrapper;
        var partPath = runtime.resolveFilePathForPlaceHolder(partName);
        metadata.deps[partPath] = 1;
        var wrappedData = readFragment(partPath, metadata);
        wrapper = wrappedData.content.trim();
        var contentDropPoints = findDropPointsOfType(partPath, wrapper, "content");
        var mainContentDropPoint = -1;
        contentDropPoints.forEach(function (dp) {
            if (dp.isNamed('main')) {
                if (mainContentDropPoint !== -1) {
                    throw new Error("Overlapping content:main droppoint in " + partPath);
                }
                mainContentDropPoint = dp;
            }
        });
        if (mainContentDropPoint === -1) {
            throw new Error("Could not find content:main inside " + partPath + " which is being invoked as wrapper");
        }
        composed = replacePartContentsWithoutMarking(composed, partName, ""); //remove the wrap tag
        composed = replacePartContents(wrapper, mainContentDropPoint, composed);
        return composed;//
    }

    function replaceContentPlaceholder(part, composed) {
        return replacePartContents(composed, part, '<!-- content placeholder not called as layout - content:' + part.getName() + ' -->');
    }

    var replaceHandlebarsPlaceholder = function(partName, composed, metadata){
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
                //var allCompiled = '';
                parsedData.forEach(function(d){
                    var compiledInstance = compiledTemplate(d);
                    console.error("HB VIEW = ", compiledInstance);
                    allCompiled += compiledInstance;
                });
                viewReplacement = allCompiled;
            }else{
                compiledInstance = compiledTemplate(parsedData);
                console.error("HB VIEW = ", compiledInstance);
                viewReplacement = compiledInstance;
            }
        }else{
            if(utils.isArray(parsedData)){

                parsedData.forEach(function(d){
                    var compiledInstance = compiledTemplate(d);
                    console.error("HB VIEW = ", compiledInstance);
                    allCompiled += compiledInstance;
                });
                viewReplacement = allCompiled;
            }else{
                compiledInstance = compiledTemplate(parsedData);
                console.error("HB VIEW = ", compiledInstance);
                viewReplacement = compiledInstance;
            }
        }
        composed = replacePartContents(composed, partName, viewReplacement);
        return composed;
    };

    var compositionRun = function (templateFilename, template, partNames, metadata) {
        var composed = "" + template;
        partNames.sort(function (a, b) {
            return -1 * (a.getStart() - b.getStart());
        });
        var dirPath = path.dirname(templateFilename);
        var dirName = path.basename(dirPath);
        var wrapped = false;
        logger.debug("Composition run for template file name: " + templateFilename);

        partNames.forEach(function (partName, i) {
            if (runtime.isDebug()) {
                logger.info("Processing part: ", partName);
            }
            switch (partName.getType()) {
                case "file":
                    composed = replaceFilePlaceholder(partName, composed, metadata);
                    break;
                case "content":
                    composed = replaceContentPlaceholder(partName, composed, metadata);
                    break;
                case "layout":
                    composed = replaceLayoutPlaceholder(partName, composed, metadata);
                    break;
                case "wrap":
                    composed = applyWrapPlaceholder(partName, composed, metadata);
                    wrapped = true;
                    break;
                case "hb":
                    console.log("Handlebars droppoint: ", partName);
                    composed = replaceHandlebarsPlaceholder(partName, composed, metadata);
                    //throw new Error();
                    break;
                case "lorem":
                    composed = applyLoremPlaceholder(partName, composed, metadata);
                    break;
                case "linkCss":
                    if (partName.isNamed('default')) {
                        var defaultCssPath = path.join(dirPath, dirName + ".css");
                        if (templateFilename.indexOf("/index.html") < 0) {
                            defaultCssPath = templateFilename.substring(0, templateFilename.lastIndexOf(".") + 1) + "css";
                        }
                        if (runtime.isDebug()) {
                            logger.info("DEFAULT css path = " + defaultCssPath);
                        }
                    } else {
                        defaultCssPath = runtime.constructProjectPath(partName.getName() + ".css");
                    }
                    if (runtime.isDebug()) {
                        logger.info("Found css path = " + defaultCssPath);
                    }
                    var defaultCssUrl = runtime.createUrlPathForFile(defaultCssPath);
                    metadata.include.style.push(defaultCssUrl);

                    composed = replacePartContentsWithoutMarking(composed, partName, ""); //remove the tag
                    break;
                case "linkScript":
                    var defaultScriptPath;

                    if (partName.isNamed('default')) {
                        defaultScriptPath = path.join(dirPath, dirName + ".js");
                        if (runtime.isDebug()) {
                            logger.info("DEFAULT script path = " + defaultScriptPath);
                        }
                    } else {
                        defaultScriptPath = runtime.constructProjectPath(partName.getName()+".js");
                    }
                    if (runtime.isDebug()) {
                        if (runtime.isDebug()) {
                            logger.info("Found script path = " + defaultScriptPath);
                        }
                    }
                    var defaultScriptUrl = runtime.createUrlPathForFile(defaultScriptPath);
                    metadata.include.script.push(defaultScriptUrl);
                    composed = replacePartContentsWithoutMarking(composed, partName, ""); //remove the tag
                    break;
                default:
                    throw new Error("Unknown type " + partName.getType());
            }
        });
        return composed;
    };

    var composeTemplate = function (filePath, fileContents, maxRuns) {
        if (filePath.substring(filePath.lastIndexOf(".") + 1) !== "html") {
            throw new Error("Should be an *.html file : " + filePath);
        }
        var file = resolveRelativeLinksInProtostarAttributes(filePath, prepareEditableRefs(filePath, "" + fileContents));
        var names = findAllDropPoints(filePath, file, dropPointTypes);
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
            modificationFile = compositionRun(filePath, modificationFile, names, metadata);
            runs += 1;
            names = findAllDropPoints(filePath, modificationFile, dropPointTypes);
        }
        return {
            content: modificationFile,
            metadata: metadata
        };
    };
    parseArgs(args);

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
            var newLatest = utils.findLatestMod(filePath, cached.deps);
            if(cached.sourceMod >= newLatest && cached.sourceSize === st.size){
                return cached.compiled;
            }
        }
        var source = runtime.readFile(filePath);
        var composed = composeTemplate(filePath, source);

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
    this.composeTemplate = function (filePath, fileContents, maxRuns) {
        //return this.composeTemplateCached(filePath);
        logger.info("Compiling template " + filePath + "...");
        return composeTemplate(filePath, fileContents, maxRuns);
    };
}

var countOccurrencesBetweenIndexes = function (content, search, start, end) {
    if (end < start) {
        throw new Error("end must be greater than start : " + start + " vs " + end);
    }
    var idx = start;
    var count = 0;
    while (idx < end) {
        var potential = content.indexOf(search, idx);
        if (potential >= 0) {
            count += 1;
            idx = potential + search.length;
        } else {
            idx = end;
        }
    }
    return count;
};
var findNthOccurrence = function (content, search, n, start) {
    var idx = -1;
    var nextIdx = start;
    var count = 0;
    while (count < n && nextIdx < content.length) {
        var potential = content.indexOf(search, nextIdx);
        if (potential >= 0) {
            count += 1;
            idx = potential;
            nextIdx = potential + search.length;
        } else {
            nextIdx = content.length;

        }
    }
    if (count < n) {
        throw new Error("Could find " + n + "th occurrence of '" + search + "'");
    }
    return idx;
};


module.exports = {
    countOccurrencesBetweenIndexes: countOccurrencesBetweenIndexes,
    findNthOccurrence: findNthOccurrence,
    createTemplateComposer: function (args) {
        return new TemplateComposer(args);
    },
    isDirectory: function (filename) {
        return fs.statSync(filename).isDirectory();
    },
    fileExists: function (filename) {
        return fs.existsSync(filename);
    },
    parseMarker: function (beginMarker, index, closeIdx, contents) {
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
    },
    decompile: function (contents) {
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

                    closeMarkerStart = findNthOccurrence(cnt, closeMarker, othersCount + 1, openMarkerEnd);
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
    },
    decompileRecursive: function (contents) {
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
    },
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