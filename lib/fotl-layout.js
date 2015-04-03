var utils = require("./utils");
var Placeholder = utils.Placeholder;

var logger = utils.createLogger({sourceFilePath : __filename});

function PlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(layoutPlaceholder, composed, metadata) {
        //console.log("Replacing lph:", layoutPlaceholder);
        var runtime = this.runtime;
        var t = this;
        function replaceLayoutPlaceholderByOrder(layoutPlaceholder, composed, metadata) {
            try {
                var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
                metadata.deps[layoutTemplatePath] = 1;
            }catch(lpe){
                logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.placeholder, lpe.stack);
                if(runtime.lenient){
                    return layoutPlaceholder.replacePartContents(composed, t.composer.createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.placeholder));
                }else{
                    throw new Error("Could not process layoutPlaceholder " + layoutPlaceholder.placeholder);
                }

            }
            var layoutTemplateContents = t.composer.readFragment(layoutTemplatePath, metadata);
            var layoutTemplate = layoutTemplateContents.content.trim();
            var layoutContentDropPoints = t.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
            layoutContentDropPoints.reverse();

            var layoutPlaceholderArgs = layoutPlaceholder.getArgs();
            var argsProvidedCount = layoutPlaceholderArgs.length;
            var argsExpectedCount = layoutContentDropPoints.length;
            var argsProvidedExpectedDelta = argsExpectedCount - argsProvidedCount;

            //layoutPlaceholderArgs.reverse();
            if(layoutPlaceholderArgs.length > 0){
                var parIdx = layoutPlaceholderArgs[0].indexOf('(');
                var eqIdx = layoutPlaceholderArgs[0].indexOf('=');
                if(eqIdx > 0 && (parIdx < 0 || parIdx > eqIdx )){
                    throw new Error("Mapping by name ");
                }
            }
            layoutContentDropPoints.forEach(function(currentDroppoint, dpIdx){
                var currentDroppointArgs = layoutPlaceholderArgs[dpIdx - argsProvidedExpectedDelta];
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
                                if (!t.composer.startsWithDropPointPrefix(dpArg)) {
                                    throw new Error("Missing type prefix (eg file:) in " + dpArg);
                                }
                                orderedDropPointReplacement += t.composer.dropPointPrefix + dpArg + t.composer.dropPointPostfix;
                            }
                        });
                    } else {
                        if (currentDroppointArgs.charAt(0) === "'" || currentDroppointArgs.charAt(0) === '"') {
                            orderedDropPointReplacement = currentDroppointArgs.substring(1, currentDroppointArgs.length - 1);
                        } else {
                            if (!t.composer.startsWithDropPointPrefix(currentDroppointArgs)) {
                                throw new Error("Missing type prefix (eg file:) in " + currentDroppointArgs);
                            }
                            orderedDropPointReplacement = t.composer.dropPointPrefix + currentDroppointArgs + t.composer.dropPointPostfix;
                        }
                    }
                }
                if (currentDroppoint.getArgs() && currentDroppoint.getArgs().length > 0) {
                    var wrapperArg = currentDroppoint.getArgs()[0];
                    console.log("WRAPPER ARG = ",wrapperArg);
                    var wrapperName = wrapperArg.substring(wrapperArg.indexOf('=')+1);
                    var up = (wrapperName.charAt(0) === '/' ? wrapperName : '/' + wrapperName)+".html";
                    var wrapperFilePath = runtime.findFileForUrlPathname(up);
                    metadata.deps[wrapperFilePath] = 1;
                    var wrapperContents = runtime.readFile(wrapperFilePath);
                    var contentDropPoints = t.composer.findDropPointsOfType(wrapperFilePath, wrapperContents, "content");
                    contentDropPoints.forEach(function(wdp){
                        if(wdp.isNamed('main')){
                            orderedDropPointReplacement = wdp.replacePartContents(wrapperContents, orderedDropPointReplacement);
                        }
                    });
                }
                layoutTemplate = currentDroppoint.replacePartContents(layoutTemplate, orderedDropPointReplacement);

            });
            return layoutPlaceholder.replacePartContents(composed, layoutTemplate);
        }

        function replaceLayoutPlaceholderByName(layoutPlaceholder, composed, metadata) {
            var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
            metadata.deps[layoutTemplatePath] = 1;
            var layoutTemplateContents = t.composer.readFragment(layoutTemplatePath, metadata);
            var layoutTemplate = layoutTemplateContents.content.trim();
            var layoutContentDropPoints = t.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
            layoutContentDropPoints.reverse();
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
                placeholderArgsByName[argName] = argValues;
            });

            //by name
            for (var dpIdx = 0; dpIdx < layoutContentDropPoints.length; dpIdx += 1) {
                var layoutContentDropPoint = layoutContentDropPoints[dpIdx];
                var specifiedArgs = placeholderArgsByName[layoutContentDropPoint.getName()];
                var namedDropPointReplacement = '';
                if(utils.isDefined(specifiedArgs)){
                    specifiedArgs.forEach(function (s) {
                        if (s.charAt(0) === "'" || s.charAt(0) === '"') {
                            namedDropPointReplacement += s.substring(1, s.length - 1);
                        } else {
                            if (!t.composer.startsWithDropPointPrefix(s)) {
                                console.error("Error parsing droppoint args : ", specifiedArgs);
                                throw new Error("Missing type prefix (eg file:) in " + s);
                            }
                            namedDropPointReplacement += t.composer.dropPointPrefix + s + t.composer.dropPointPostfix;
                        }
                    });
                }
                if (layoutContentDropPoints[dpIdx].hasArgs()) {
                    var wrapperArg = layoutContentDropPoints[dpIdx].getArgs()[0];
                    var wrapperName = wrapperArg.substring(wrapperArg.indexOf('=')+1);
                    var up = (wrapperName.charAt(0) === '/' ? wrapperName : '/' + wrapperName)+".html";
                    var wrapperFilePath = runtime.findFileForUrlPathname(up);
                    metadata.deps[wrapperFilePath] = 1;
                    var wrapperContents = runtime.readFile(wrapperFilePath);
                    var contentDropPoints = t.composer.findDropPointsOfType(wrapperFilePath, wrapperContents, "content");
                    contentDropPoints.forEach(function(wdp){
                        if(wdp.isNamed('main')){
                            namedDropPointReplacement = wdp.replacePartContents(wrapperContents, namedDropPointReplacement);
                        }
                    });
                }
                layoutTemplate = layoutContentDropPoint.replacePartContents(layoutTemplate, namedDropPointReplacement);
            }
            return layoutPlaceholder.replacePartContents(composed , layoutTemplate);
        }

        try {
            var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
        } catch (e) {
            logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName(), e.stack);
            logger.info("Error for droppoint : ", layoutPlaceholder);
            if(runtime.lenient){
                return layoutPlaceholder.replacePartContents(composed, this.composer.createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName()));
            }else{
                throw new Error("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName());
            }

        }
        metadata.deps[layoutTemplatePath] = 1;
        var layoutTemplateContents = this.composer.readFragment(layoutTemplatePath, metadata);
        var layoutTemplate = layoutTemplateContents.content.trim();
        var layoutContentDropPoints = this.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
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
    };

    this.parseLayoutArgs = function(placeholderName){
        //var eqIdx = placeholderName.indexOf('=');
        //var colIdx = placeholderName.indexOf(':');
        //var q1Idx= placeholderName.indexOf('\'');
        //var q2Idx = placeholderName.indexOf('"');
        var argsStart = placeholderName.indexOf('(');
        var argsEnd = placeholderName.lastIndexOf(')');
        var argsPart = placeholderName.substring(argsStart+1, argsEnd);
        //console.log("ARGS PART = " + argsPart);
        //var byName = eqIdx > 0 && eqIdx < colIdx && eqIdx <q1Idx && eqIdx < q2Idx;
        var searchCol = true;
        var parts = [];
        var lastSep = -1;
        var openParCount = 0;
        for(var i = 0 ; searchCol && i < argsPart.length ; i+=1){
            var c = argsPart.charAt(i);
            if(c === '('){
                openParCount += 1;
            }else if(c === ')'){
                openParCount -=1;
            }
            if(c === ';'){
                if(openParCount === 0){
                    if(lastSep > 0){
                        parts.push(argsPart.substring(lastSep+1, i).trim());
                    }else{
                        parts.push(argsPart.substring(0, i).trim());
                    }
                    lastSep = i;
                }
            }
        }
        if(lastSep < 0){
            parts.push(argsPart.substring(0, i).trim());
        }else{
            parts.push(argsPart.substring(lastSep+1, i).trim());
        }
        return parts;
    };

    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
        var t= this;
        var dropPointType='layout';
        var args = this.parseLayoutArgs(currentName);
        return new Placeholder({
            name: currentName.substring(0, currentName.indexOf('(')),
            start: currentStartIndex,
            end: currentEndIndex,
            type: dropPointType,
            tag: fullTag,
            filepath: filepath,
            args: args
        });
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};