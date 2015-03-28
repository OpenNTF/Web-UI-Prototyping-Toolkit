var utils = require("./utils");
var Placeholder = utils.Placeholder;

var logger = utils.createLogger({sourceFilePath : __filename});

function PlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(layoutPlaceholder, composed, metadata) {
        var runtime = this.runtime;
        var t = this;
        function replaceLayoutPlaceholderByOrder(layoutPlaceholder, composed, metadata) {
            try {
                var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
                metadata.deps[layoutTemplatePath] = 1;
            }catch(lpe){
                logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.placeholder, lpe);
                return layoutPlaceholder.replacePartContents(composed, t.composer.createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.placeholder));
            }
            var layoutTemplateContents = t.composer.readFragment(layoutTemplatePath, metadata);
            var layoutTemplate = layoutTemplateContents.content.trim();
            var layoutContentDropPoints = t.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
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
                if (currentDroppoint.getArgs()) {
                    var wrapperArg = currentDroppoint.getArgs()[0];
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
            }
            return layoutPlaceholder.replacePartContents(composed, layoutTemplate);
            //return replacePartContents(composed, layoutPlaceholder, layoutTemplate);
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
            logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName(), e);
            logger.info("Error for droppoint : ", layoutPlaceholder);
            return layoutPlaceholder.replacePartContents(composed, this.composer.createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName()));
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

    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
        var t= this;
        var dropPointType='layout';
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
            return new Placeholder({
                name: currentName.substring(0, currentName.indexOf('(')),
                start: currentStartIndex,
                end: currentEndIndex,
                type: dropPointType,
                tag: fullTag,
                filepath: filepath,
                args: layoutArgs
            });
            //dropPointNames.push(ph);
        } else {
            var colonIdx = currentName.indexOf(t.composer.dropPointSeparatorName);
            var nameOnly;
            if (colonIdx > 0) {
                nameOnly = currentName.substring(0, colonIdx);
            } else {
                nameOnly = currentName;
            }
            var argsText = currentName.substring(colonIdx + 1);
            var args = argsText.split(t.composer.dropPointSeparatorArgs);
            if (nameOnly.length === 0) {
                throw new Error("Illegal nameOnly");
            }
            //dropPointNames.push(ph);
            return new Placeholder({
                name: nameOnly,
                start: currentStartIndex,
                end: currentEndIndex,
                type: dropPointType,
                tag: fullTag,
                filepath: filepath,
                args: args
            });
        }

    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};