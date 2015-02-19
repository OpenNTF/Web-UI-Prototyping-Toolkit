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
    this.getFullTag = function(){return this._tag};
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
    }
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
        //if (runtime.isDebug()) {
            //logger.info("Constructed placeholder: ", ph);
        //}
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
        var result;
        while ((result = contents.indexOf(crit, startIdx)) >= 0) {
            var end = contents.indexOf(dropPointPostfix, result);
            var name = contents.substring(result + crit.length, end);
            var type = dropPointType;
            if (type === 'content') {
                var contentColonIdx = name.indexOf(dropPointSeparatorName);
                var contentNameOnly;
                if (contentColonIdx > 0) {
                    contentNameOnly = name.substring(0, contentColonIdx);
                } else {
                    contentNameOnly = name;
                }
                var dpargs = undefined;
                if (contentNameOnly.indexOf('(') > 0) {
                    dpargs = [contentNameOnly.substring(contentNameOnly.indexOf('(') + 1, contentNameOnly.length - 1)];
                    contentNameOnly = contentNameOnly.substring(0, contentNameOnly.indexOf('('));
                }
                var contentPlaceholder = createPlaceholder({
                    name: contentNameOnly,
                    start: result,
                    end: end + 4,
                    type: dropPointType,
                    tag: content.substring(result, end + 4),
                    filepath: filepath,
                    args: dpargs
                });
                dropPointNames.push(contentPlaceholder);
            } else if (type === "layout" || type === "wrap") {
                if (name.charAt(name.length - 1) === ')') {
                    var layoutArgsText = name.substring(name.indexOf('(') + 1, name.length - 1);
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
                        throw new Error("All or none of the droppoints should be assigned by name : layout:" + name);
                    }
                    dropPointNames.push(createPlaceholder({
                        name: name.substring(0, name.indexOf('(')),
                        start: result,
                        end: end + 4,
                        type: dropPointType,
                        tag: content.substring(result, end + 4),
                        filepath: filepath,
                        args: layoutArgs
                    }));
                } else {
                    var colonIdx = name.indexOf(dropPointSeparatorName);
                    var nameOnly;
                    if (colonIdx > 0) {
                        nameOnly = name.substring(0, colonIdx);
                    } else {
                        nameOnly = name;
                    }
                    var argsText = name.substring(colonIdx + 1);
                    var args = argsText.split(dropPointSeparatorArgs);
                    if (nameOnly.length === 0) {
                        throw new Error("Illegal nameOnly");
                    }
                    dropPointNames.push(createPlaceholder({
                        name: nameOnly,
                        start: result,
                        end: end + 4,
                        type: dropPointType,
                        tag: content.substring(result, end + 4),
                        filepath: filepath,
                        args: args
                    }));
                }
            } else if(type === "lorem"){
                if(name.indexOf('(') >0){
                    var loremName = name.substring(0, name.indexOf('('));
                    var laremArgs = name.substring(name.indexOf('(')+1, name.lastIndexOf(')'));
                    var loremArgsSplit = laremArgs.split(dropPointSeparatorArgs);
                    dropPointNames.push(createPlaceholder({
                        name: loremName,
                        start: result,
                        tag: content.substring(result, end + 4),
                        end: end + 4,
                        type: dropPointType,
                        filepath: filepath,
                        args: loremArgsSplit

                    }));
                }else{
                    dropPointNames.push(createPlaceholder({
                        name: name,
                        start: result,
                        tag: content.substring(result, end + 4),
                        end: end + 4,
                        type: dropPointType,
                        filepath: filepath,
                        args: []

                    }));
                }
            }else{
                if (name.length === 0) {
                    throw new Error("Illegal name");
                }
                dropPointNames.push(createPlaceholder({
                    name: name,
                    start: result,
                    tag: content.substring(result, end + 4),
                    end: end + 4,
                    type: dropPointType,
                    filepath: filepath,
                    args: []

                }));
            }
            startIdx = end + 4;
        }
        replaceRelativeReferences(dropPointNames);
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
                var initName = dp.getName();
                var ap = resolveRelativePath(dp.getName()+ ".html", dp.getFilePath());
                var ref = runtime.createUrlPathForFile(ap);
                dp.setName(ref.substring(1, ref.length - 5));
                //dp.name = ref.substring(1, ref.length - 5);
                if (runtime.isAppPath(ap)) {
                    dp.setName('/' + dp.getName());
                    //dp.name = '/' + dp.name;
                }
                logger.info("Set name for " + initName + " in " + dp.getFilePath() + " to " + dp.getName());
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

    function Lorem(args){
        var lines = args.lines;
        if(typeof args !== 'object' || !utils.isArray(lines) || lines.length < 1){
            console.error("Illegal Lorem args, expecting property 'lines' containing array of phrases: ", args);
            throw new Error("illegal args: " + args);
        }

        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        }

        function randomIndex() {
            return getRandomInt(0, lines.length -1);
        }

        function paragraph(){
            var minLength = 3;
            var maxLength = 5;
            var length = getRandomInt(minLength, maxLength);
            var out = '';
            for(var idx = 0 ; idx < length ; idx +=1){
                out += phrase();
            }
            return out;
        }
        function phrase(){
            return lines[randomIndex()];
        }
        function word(){
            var minChars = 4;
            var maxChars = 16;

            var p = phrase();
            var w = "";
            var start = 0;
            while(w.length < 1){
                var e = p.indexOf(" ", start);
                //var e = p.indexOf(" ", s+1);
                var m = p.substring(start, e);
                var re = new RegExp("[a-zA-Z]{" + minChars + ","+maxChars+"}", "g");

                if(m.length >= minChars && m.length <= maxChars && re.test(m)){
                    w = m;
                }else{
                    start = e+1;
                }
            }
            if(w.length < 1){
                throw new Error ("Could not find word of minlength " + minChars + " and max " + maxChars + " in phrase " + p);
            }
            return w;
        }
        function paragraphs(count, separator){
            var sep = separator;
            if(!utils.isString(sep)){
                sep = "<br/>";
            }
            var out= "";
            for(var idx = 0 ; idx < count ; idx+=1){
                if(out.length > 0){
                    out+= sep;
                }
                out += paragraph();
            }
            return out;
        }
        function phrases(count, separator){
            var sep = separator;
            if(!utils.isString(sep)){
                sep = " ";
            }
            var out= "";
            for(var idx = 0 ; idx < count ; idx+=1){
                if(out.length > 0){
                    out+= sep;
                }
                out += phrase();
            }
            return out;
        }
        function words(count, separator){
            var sep = separator;
            if(!utils.isString(sep)){
                sep = " ";
            }
            var out= "";
            for(var idx = 0 ; idx < count ; idx+=1){
                if(out.length > 0){
                    out+= sep;
                }
                out += word();
            }
            return out;
        }

        function createOpenTag(tag){
            return '<' + tag.trim() + '>'
        }
        function createCloseTag(tag){
            var t = tag.trim();

            var si = t.indexOf(' ');
            var o;
            if(si > 0){
                o = t.substring(0, si);
            }else{
                o = t;
            }
            return '</' + o + '>'
        }

        function wordTag(tag){
            return createOpenTag(tag) + word() + createCloseTag(tag);
        }

        function phraseTag(tag){
            return createOpenTag(tag) + phrase() + createCloseTag(tag);
        }

        function paragraphTag(tag){
            return createOpenTag(tag) + paragraph() + createCloseTag(tag);
        }
        function paragraphTags(count, tag){
            var out= "";
            for(var idx = 0 ; idx < count ; idx+=1){
                out += paragraphTag(tag);
            }
            return out;
        }
        function phraseTags(count, tag){
            var out= "";
            for(var idx = 0 ; idx < count ; idx+=1){
                out += phraseTag(tag);
            }
            return out;
        }
        function wordTags(count, tag){
            var out= "";
            for(var idx = 0 ; idx < count ; idx+=1){
                out += wordTag(tag);
            }
            return out;
        }

        return {
            randomInt: function(min, max){
                return getRandomInt(min, max);
            },
            paragraph: function(){
                return paragraphs(1);
            },
            phrase: function(){
                return phrases(1);
            },
            word: function(){
                return words(1);
            },
            paragraphs: function(count, separator){
                return paragraphs(count, separator);
            },
            phrases: function(count, separator){
                return phrases(count, separator);
            },
            words: function(count, separator){
                return words(count, separator);
            },
            paragraphTag: function(tag){
                return paragraphTag(tag);
            },
            phraseTag: function(tag){
                return phraseTag(tag);
            },
            wordTag: function(tag){
                return wordTag(tag);
            },
            paragraphTags: function(count, tag){
                return paragraphTags(count, tag);
            },
            phraseTags: function(count, tag){
                return phraseTags(count, tag);
            },
            wordTags: function(count, tag){
                return wordTags(count, tag);
            }
        };
    }

    function readLoremLines(){
        var loremTxt = runtime.readAppFile(["core", "assets", "lorem.txt"]);
        var loremLines = loremTxt.split('\n');
        return loremLines;
    }

    function applyLoremPlaceholder(part, composed) {
        var lines = readLoremLines();
        var lorem = new Lorem({
            lines: lines
        });
        if(runtime.isDebug()){
            console.log("Read lorem lines: ", lines);
            console.log("Applying lorem part: ", part);
        }

        function createArgsValsObject(argsArray){
            var o = {};
            for(var i = 0 ; i < argsArray.length ; i+=1){
                var a= argsArray[i];
                var ei = a.indexOf('=');
                var nm = a.substring(0, ei).trim();
                var val = a.substring(ei+1).trim();
                if(val.charAt(0) === "'" || val.charAt(0) === '"'){
                    val = val.substring(1, val.length-1).trim();
                }
                o[nm] = val;
            }
            return o;
        }
        var replacement = "";
        var caseType = "lower";
        if(!utils.isDefined(part.getArgs()) || (utils.isArray(part.getArgs())&& part.getArgs().length < 1)){
            switch(part.getName()){
                case "word":
                    replacement = lorem.word();
                    break;
                case "paragraph":
                    replacement = lorem.paragraph();
                    break;
                case "phrase":
                    replacement = lorem.phrase();
                    break;
                default:
                    throw new Error("Unknown lorem invocation: " + part.getName());
            }
        }else{
            //tag, separator, count, min, max
            var argVals = createArgsValsObject(part.getArgs());

            if(argVals.hasOwnProperty("case")){
                switch(argVals.case){
                    case "upper":
                        caseType = "upper";
                        break;
                    default:
                        console.error("Unknown case value for lorem case arg: ", argVals.case);
                    case "lower":
                        caseType = "lower";
                        break;
                    case "capitalize":
                        caseType = "capitalize";
                        break;

                }
            }

            if(argVals.hasOwnProperty("tag")){
                if(argVals.hasOwnProperty("count")){
                    switch(part.getName()){
                        case "word":
                            replacement = lorem.wordTags(parseInt(argVals.count,10), argVals.tag);
                            break;
                        case "paragraph":
                            replacement = lorem.paragraphTags(parseInt(argVals.count,10), argVals.tag);
                            break;
                        case "phrase":
                            replacement = lorem.phraseTags(parseInt(argVals.count,10), argVals.tag);
                            break;
                        default:
                            throw new Error("Unknown lorem invocation: " + part.getName());
                    }
                }else{
                    if(argVals.hasOwnProperty("min")){
                        var rnd = lorem.randomInt(parseInt(argVals.min, 10),parseInt(argVals.max, 10));
                        switch(part.getName()){
                            case "word":
                                replacement = lorem.wordTags(rnd, argVals.tag);
                                break;
                            case "paragraph":
                                replacement = lorem.paragraphTags(rnd, argVals.tag);
                                break;
                            case "phrase":
                                replacement = lorem.phraseTags(rnd, argVals.tag);
                                break;
                            default:
                                throw new Error("Unknown lorem invocation: " + part.getName());
                        }

                    }else{
                        switch(part.getName()){
                            case "word":
                                replacement = lorem.wordTag(argVals.tag);
                                break;
                            case "paragraph":
                                replacement = lorem.paragraphTag(argVals.tag);
                                break;
                            case "phrase":
                                replacement = lorem.phraseTag(argVals.tag);
                                break;
                            default:
                                throw new Error("Unknown lorem invocation: " + part.getName());
                        }

                    }

                }
            }else{
                if(argVals.hasOwnProperty("separator")){
                    if(argVals.hasOwnProperty("count")){
                        switch(part.getName()){
                            case "word":
                                replacement = lorem.words(parseInt(argVals.count,10), argVals.separator);
                                break;
                            case "paragraph":
                                replacement = lorem.paragraphs(parseInt(argVals.count,10), argVals.separator);
                                break;
                            case "phrase":
                                replacement = lorem.phrases(parseInt(argVals.count,10), argVals.separator);
                                break;
                            default:
                                throw new Error("Unknown lorem invocation: " + part.getName());
                        }
                    }else{
                        if(argVals.hasOwnProperty("min")) {
                            var rnd = lorem.randomInt(parseInt(argVals.min, 10), parseInt(argVals.max, 10));
                            switch(part.getName()){
                                case "word":
                                    replacement = lorem.words(rnd, argVals.separator);
                                    break;
                                case "paragraph":
                                    replacement = lorem.paragraphs(rnd, argVals.separator);
                                    break;
                                case "phrase":
                                    replacement = lorem.phrases(rnd, argVals.separator);
                                    break;
                                default:
                                    throw new Error("Unknown lorem invocation: " + part.getName());
                            }
                        }else{
                            switch(part.getName()){
                                case "word":
                                    replacement = lorem.word();
                                    break;
                                case "paragraph":
                                    replacement = lorem.paragraph();
                                    break;
                                case "phrase":
                                    replacement = lorem.phrase();
                                    break;
                                default:
                                    throw new Error("Unknown lorem invocation: " + part.getName());
                            }
                        }
                    }
                }else{
                    if(argVals.hasOwnProperty("count")){
                        switch(part.getName()){
                            case "word":
                                replacement = lorem.words(parseInt(argVals.count,10));
                                break;
                            case "paragraph":
                                replacement = lorem.paragraphs(parseInt(argVals.count,10));
                                break;
                            case "phrase":
                                replacement = lorem.phrases(parseInt(argVals.count,10));
                                break;
                            default:
                                throw new Error("Unknown lorem invocation: " + part.getName());
                        }
                    }else{
                        if(argVals.hasOwnProperty("min")) {
                            var rnd = lorem.randomInt(parseInt(argVals.min, 10), parseInt(argVals.max, 10));
                            switch(part.getName()){
                                case "word":
                                    replacement = lorem.words(rnd);
                                    break;
                                case "paragraph":
                                    replacement = lorem.paragraphs(rnd);
                                    break;
                                case "phrase":
                                    replacement = lorem.phrases(rnd);
                                    break;
                                default:
                                    throw new Error("Unknown lorem invocation: " + part.getName());
                            }

                        }else{
                            switch(part.getName()){
                                case "word":
                                    replacement = lorem.word();
                                    break;
                                case "paragraph":
                                    replacement = lorem.paragraph();
                                    break;
                                case "phrase":
                                    replacement = lorem.phrase();
                                    break;
                                default:
                                    throw new Error("Unknown lorem invocation: " + part.getName());
                            }

                        }
                    }
                }
            }
        }
        if(part.isNamed('word')){
            switch(caseType){
                case "upper": replacement = replacement.toUpperCase(); break;
                case "lower": replacement = replacement.toLowerCase(); break;
                case "capitalize": replacement = replacement.substring(0, 1).toUpperCase() + replacement.substring(1).toLowerCase(); break;
            }
        }

        return replacePartContents(composed, part, replacement);

    }
    function replaceFilePlaceholder(part, composed) {
        var partContents;
        try{
            var fileName = runtime.resolveFilePathForPlaceHolder(part);
            if (!runtime.isExistingFilePath(fileName)) {

            } else {
                var partData = readFragment(fileName);
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

    function replaceLayoutPlaceholderByName(layoutPlaceholder, composed) {
        var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
        var layoutTemplateContents = readFragment(layoutTemplatePath);
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

    function replaceLayoutPlaceholderByOrder(layoutPlaceholder, composed) {
        try {
            var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
        }catch(lpe){
            logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.placeholder);
            return replacePartContents(composed, layoutPlaceholder, createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.placeholder));
        }
        var layoutTemplateContents = readFragment(layoutTemplatePath);
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

    function replaceLayoutPlaceholder(layoutPlaceholder, composed) {
        try {
            var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
        } catch (e) {
            logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName());
            logger.info("Error for droppoint : ", layoutPlaceholder);
            return replacePartContents(composed, layoutPlaceholder, createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName()));
        }
        var layoutTemplateContents = readFragment(layoutTemplatePath);
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
                return replaceLayoutPlaceholderByName(layoutPlaceholder, composed);
            }
        }
        return replaceLayoutPlaceholderByOrder(layoutPlaceholder, composed);
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
                    var newc = contents.substring(0, attrstart) + newAttr + contents.substring(attrEnd);
                    contents = newc;
                } else {

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

    function readFragment(filePath) {
        var contents = prepareEditableRefs(filePath, runtime.readFile(filePath));
        var dropPoints = findAllDropPoints(filePath, contents, ['wrap']);
        if (dropPoints.length > 0) {
            contents = applyWrapPlaceholder(dropPoints[0], contents);
        }
        contents = resolveRelativeLinksInProtostarAttributes(filePath, contents);
        return  {
            content: contents,
            dropPoints: -1
        };
    }

    function applyWrapPlaceholder(partName, composed) {
        var wrapper;
        var partPath = runtime.resolveFilePathForPlaceHolder(partName);
        var wrappedData = readFragment(partPath);
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

    var compositionRun = function (templateFilename, template, partNames, metadata) {
        var composed = "" + template;
        partNames.sort(function (a, b) {
            return -1 * (a.getStart() - b.getStart());
        });
        var dirPath = path.dirname(templateFilename);
        var dirName = path.basename(dirPath);
        var wrapped = false;
        if (runtime.isDebug()) {
            logger.info("Composition run for template file name: " + templateFilename);
        }
        partNames.forEach(function (partName, i) {
            if (runtime.isDebug()) {
                logger.info("Processing part: ", partName);
            }
            switch (partName.getType()) {
                case "file":
                    composed = replaceFilePlaceholder(partName, composed);
                    break;
                case "content":
                    composed = replaceContentPlaceholder(partName, composed);
                    break;
                case "layout":
                    composed = replaceLayoutPlaceholder(partName, composed);
                    break;
                case "wrap":
                    composed = applyWrapPlaceholder(partName, composed);
                    wrapped = true;
                    break;
                case "lorem":
                    composed = applyLoremPlaceholder(partName, composed);
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
                        defaultCssPath = runtime.resolveFilePathForPlaceHolder(partName);
                    }
                    if (runtime.isDebug()) {
                        logger.info("Found css path = " + defaultCssPath);
                    }
                    if (runtime.isExistingFilePath(defaultCssPath)) {
                        var defaultCssUrl = runtime.createUrlPathForFile(defaultCssPath);
                        metadata.include.style.push(defaultCssUrl);
                    } else {
                        throw new Error("There is no default style to include for " + templateFilename + ": " + defaultCssPath);
                    }
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
                        defaultScriptPath = runtime.resolveFilePathForPlaceHolder(partName);
                    }
                    if (runtime.isDebug()) {
                        if (runtime.isDebug()) {
                            logger.info("Found script path = " + defaultScriptPath);
                        }
                    }
                    if (runtime.isExistingFilePath(defaultScriptPath)) {
                        var defaultScriptUrl = runtime.createUrlPathForFile(defaultScriptPath);
                        metadata.include.script.push(defaultScriptUrl);
                    } else {
                        throw new Error("There is no default script to include for " + templateFilename + ": " + defaultScriptPath);
                    }
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
            }
        };
        while (names && names.length && runs < mr) {
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
    this.composeTemplate = function (filePath, fileContents, maxRuns) {
        logger.debug("Composing template : " + filePath);
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