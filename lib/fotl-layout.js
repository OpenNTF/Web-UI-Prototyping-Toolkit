var utils = require("./utils");
var Placeholder = utils.Placeholder;
var logger = utils.createLogger({sourceFilePath: __filename});
function PlaceholderFactory(args) {
    this.runtime = args.runtime;
    this.composer = args.composer;
    this.applyPlaceholder = function (layoutPlaceholder, composed, metadata) {
        var runtime = this.runtime;
        var t = this;

        function applyContentPlaceholderWrapper(contentTag, orderedDropPointReplacement) {
            var wrapperArg = contentTag.getArgs()[0];
            var wrapperName = wrapperArg.substring(wrapperArg.indexOf('=') + 1);
            var up = (wrapperName.charAt(0) === '/' ? wrapperName : '/' + wrapperName) + ".html";
            var wrapperFilePath = runtime.findFileForUrlPathname(up);
            metadata.deps[wrapperFilePath] = 1;
            var wrapperContents = runtime.readFile(wrapperFilePath);
            var contentDropPoints = t.composer.findDropPointsOfType(wrapperFilePath, wrapperContents, "content");
            contentDropPoints.forEach(function (wdp) {
                if (wdp.isNamed('main')) {
                    orderedDropPointReplacement = wdp.replacePartContents(wrapperContents, orderedDropPointReplacement);
                }
            });
            return orderedDropPointReplacement;
        }

        function calculateOrderedDropPointReplacement(currentContentTagDroppoint, currentLayoutTagArguments) {
            var orderedDropPointReplacement = '';
            if (utils.isDefined(currentLayoutTagArguments)) {
                if (currentLayoutTagArguments.indexOf(',') > 0) {
                    var splitArgs = currentLayoutTagArguments.split(',');
                    splitArgs.forEach(function (currentDropPointArg) {
                        var replacement;
                        if (currentDropPointArg.charAt(0) === "'" || currentDropPointArg.charAt(0) === '"') {
                            if (currentContentTagDroppoint.hasArgs()) {
                                replacement = applyContentPlaceholderWrapper(currentContentTagDroppoint, currentDropPointArg.substring(1, currentDropPointArg.length - 1));
                            } else {
                                replacement = currentDropPointArg.substring(1, currentDropPointArg.length - 1);
                            }
                        } else {
                            if (!t.composer.startsWithDropPointPrefix(currentDropPointArg)) {
                                throw new Error("Missing type prefix (eg file:) in " + currentDropPointArg);
                            }
                            if (currentContentTagDroppoint.hasArgs()) {
                                replacement = applyContentPlaceholderWrapper(currentContentTagDroppoint, t.composer.dropPointPrefix + currentDropPointArg + t.composer.dropPointPostfix);
                            } else {
                                replacement = t.composer.dropPointPrefix + currentDropPointArg + t.composer.dropPointPostfix;
                            }
                        }
                        orderedDropPointReplacement += replacement;
                    });
                } else {
                    var otherReplacement;
                    if (currentLayoutTagArguments.charAt(0) === "'" || currentLayoutTagArguments.charAt(0) === '"') {
                        if (currentContentTagDroppoint.hasArgs()) {
                            otherReplacement = applyContentPlaceholderWrapper(currentContentTagDroppoint, currentLayoutTagArguments.substring(1, currentLayoutTagArguments.length - 1));
                        } else {
                            otherReplacement = currentLayoutTagArguments.substring(1, currentLayoutTagArguments.length - 1);
                        }
                    } else {
                        if (!t.composer.startsWithDropPointPrefix(currentLayoutTagArguments)) {
                            throw new Error("Missing type prefix (eg file:) in " + currentLayoutTagArguments);
                        }
                        if (currentContentTagDroppoint.hasArgs()) {
                            otherReplacement = applyContentPlaceholderWrapper(currentContentTagDroppoint, t.composer.dropPointPrefix + currentLayoutTagArguments + t.composer.dropPointPostfix);
                        } else {
                            otherReplacement = t.composer.dropPointPrefix + currentLayoutTagArguments + t.composer.dropPointPostfix;
                        }
                    }
                    orderedDropPointReplacement = otherReplacement;
                }
            }
            return orderedDropPointReplacement;
        }

        function calculateNamedArgumentReplacement(currentContentTag, specifiedArgs) {
            var namedDropPointReplacement = '';
            if (utils.isDefined(specifiedArgs)) {
                specifiedArgs.forEach(function (currentArg) {
                    if (currentArg.indexOf(',') > 0) {
                        var splitArgs = currentArg.split(',');
                        splitArgs.forEach(function (currentDropPointArg) {
                            var replacement;
                            if (currentDropPointArg.charAt(0) === "'" || currentDropPointArg.charAt(0) === '"') {
                                var unquotedReplacement = currentDropPointArg.substring(1, currentDropPointArg.length - 1);
                                if (currentContentTag.hasArgs()) {
                                    replacement = applyContentPlaceholderWrapper(currentContentTag, unquotedReplacement);
                                } else {
                                    replacement = unquotedReplacement;
                                }
                            } else {
                                if (!t.composer.startsWithDropPointPrefix(currentDropPointArg)) {
                                    throw new Error("Missing type prefix (eg file:) in " + currentDropPointArg);
                                }
                                if (currentContentTag.hasArgs()) {
                                    replacement = applyContentPlaceholderWrapper(currentContentTag, t.composer.dropPointPrefix + currentDropPointArg + t.composer.dropPointPostfix);
                                } else {
                                    replacement = t.composer.dropPointPrefix + currentDropPointArg + t.composer.dropPointPostfix;
                                }
                            }
                            namedDropPointReplacement += replacement;
                        });
                    } else {
                        if (currentArg.charAt(0) === "'" || currentArg.charAt(0) === '"') {
                            if (currentContentTag.hasArgs()) {
                                namedDropPointReplacement += applyContentPlaceholderWrapper(currentContentTag, currentArg.substring(1, currentArg.length - 1));
                            } else {
                                namedDropPointReplacement += currentArg.substring(1, currentArg.length - 1);
                            }
                        } else {
                            if (!t.composer.startsWithDropPointPrefix(currentArg)) {
                                logger.error("Error parsing droppoint args : ", specifiedArgs);
                                throw new Error("Missing type prefix (eg file:) in " + currentArg);
                            }
                            if (currentContentTag.hasArgs()) {
                                namedDropPointReplacement += applyContentPlaceholderWrapper(currentContentTag, t.composer.dropPointPrefix + currentArg + t.composer.dropPointPostfix);
                            } else {
                                namedDropPointReplacement += t.composer.dropPointPrefix + currentArg + t.composer.dropPointPostfix;
                            }
                        }
                    }
                });
            }
            return namedDropPointReplacement;
        }

        function replaceLayoutPlaceholderByOrder(layoutTag, composedMarkup, layoutTemplate) {
            try {
                var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutTag);
                metadata.deps[layoutTemplatePath] = 1;
            } catch (lpe) {
                logger.error("Could not process layoutPlaceholder " + layoutTag.placeholder, lpe.stack);
                if (runtime.lenient) {
                    return layoutTag.replacePartContents(composedMarkup, t.composer.createErrorMarkup("Could not process layoutPlaceholder " + layoutTag.placeholder));
                } else {
                    throw new Error("Could not process layoutPlaceholder " + layoutTag.placeholder);
                }
            }
            var layoutContentDropPoints = t.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
            layoutContentDropPoints.reverse();
            var layoutTagArguments = layoutTag.getArgs();
            var argsProvidedCount = layoutTagArguments.length;
            var argsExpectedCount = layoutContentDropPoints.length;
            var argsProvidedExpectedDelta = argsExpectedCount - argsProvidedCount;
            if (layoutTagArguments.length > 0) {
                var parIdx = layoutTagArguments[0].indexOf('(');
                var eqIdx = layoutTagArguments[0].indexOf('=');
                if (eqIdx > 0 && (parIdx < 0 || parIdx > eqIdx )) {
                    throw new Error("Mapping by name ");
                }
            }
            layoutContentDropPoints.forEach(function (currentContentTagDroppoint, dpIdx) {
                var currentLayoutTagArguments = layoutTagArguments[dpIdx - argsProvidedExpectedDelta];
                var replacement = calculateOrderedDropPointReplacement(currentContentTagDroppoint, currentLayoutTagArguments);
                layoutTemplate = currentContentTagDroppoint.replacePartContents(layoutTemplate, replacement);
            });
            return layoutTag.replacePartContents(composedMarkup, layoutTemplate);
        }

        function constructArgumentsByNameObject(layoutPlaceholderArgs) {
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
            return placeholderArgsByName;
        }

        function replaceLayoutPlaceholderByName(layoutPlaceholderByName, composedMarkup, layoutTemplate) {
            var layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholderByName);
            metadata.deps[layoutTemplatePath] = 1;
            var layoutTagContentDropPoints = t.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
            layoutTagContentDropPoints.reverse();
            var layoutPlaceholderArgs = layoutPlaceholderByName.getArgs();
            layoutPlaceholderArgs.reverse();
            if (!(layoutPlaceholderArgs.length > 0 && layoutPlaceholderArgs[0].indexOf('=') > 0)) {
                throw new Error("Not leveraging name based mapping");
            }
            var placeholderArgsByName = constructArgumentsByNameObject(layoutPlaceholderArgs);
            //by name
            layoutTagContentDropPoints.forEach(function (currentContentTag, dpIdx) {
                var specifiedArgs = placeholderArgsByName[currentContentTag.getName()];
                var replacement = calculateNamedArgumentReplacement(currentContentTag, specifiedArgs);
                layoutTemplate = currentContentTag.replacePartContents(layoutTemplate, replacement);
            });
            return layoutPlaceholderByName.replacePartContents(composedMarkup, layoutTemplate);
        }

        function resolveLayoutFilePath(layoutPlaceholder) {
            var layoutTemplatePath = null;
            try {
                layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
            } catch (e) {
                logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName(), e.stack);
                logger.info("Error for droppoint : ", layoutPlaceholder);
                if (!runtime.lenient) {
                    throw new Error("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName());
                }
            }
            return layoutTemplatePath;
        }

        function collectPassLayoutArgumentNames(layoutTemplatePath, layoutTemplate) {
            var passLayoutArgsDropPointCandidates = t.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "layout");
            var passArgNames = [];
            passLayoutArgsDropPointCandidates.forEach(function (dp) {
                dp.getArgs().forEach(function (arg) {
                    if (arg.indexOf("=content:") > 0 || arg.indexOf("content:") === 0) {
                        var idx = arg.indexOf("content:");
                        var argValue = arg.substring(idx + 8);
                        passArgNames.push(argValue);
                    }
                });
            });
            return passArgNames;
        }

        function areLayoutArgsPassedByName(layoutPlaceholder) {
            return layoutPlaceholder.getArgs().length > 0 && layoutPlaceholder.getArgs()[0].indexOf('=') > 0 && (layoutPlaceholder.getArgs()[0].indexOf('(') < 0 || layoutPlaceholder.getArgs()[0].indexOf('(') > layoutPlaceholder.getArgs()[0].indexOf('=') );
        }

        var layoutTemplatePath = resolveLayoutFilePath(layoutPlaceholder);
        if (!layoutTemplatePath) {
            return layoutPlaceholder.replacePartContents(composed, this.composer.createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.getType() + ":" + layoutPlaceholder.getName()));
        }
        metadata.deps[layoutTemplatePath] = 1;
        var layoutTemplateContents = this.composer.readFragment(layoutTemplatePath, metadata);
        var layoutTemplate = layoutTemplateContents.content.trim();
        collectPassLayoutArgumentNames(layoutTemplatePath, layoutTemplate).forEach(function (passArg) {
            var contentDroppointTagContentsOpener = 'content:' + passArg;
            var repl = -1;
            layoutPlaceholder.getArgs().forEach(function (layoutPlaceholderArgument) {
                var argStartCrit = passArg + "=";
                if (layoutPlaceholderArgument.indexOf(argStartCrit) === 0) {
                    repl = layoutPlaceholderArgument.substring(argStartCrit.length);
                }
            });
            var critIdx = layoutTemplate.indexOf(contentDroppointTagContentsOpener);
            if (typeof repl === 'string') {
                layoutTemplate = layoutTemplate.substring(0, critIdx) + repl + layoutTemplate.substring(critIdx + contentDroppointTagContentsOpener.length);
            }
        });
        composed.content = layoutTemplate;
        var layoutContentDropPoints = this.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
        layoutContentDropPoints.reverse();
        layoutPlaceholder.getArgs().reverse();
        var appliedResult;
        if (areLayoutArgsPassedByName(layoutPlaceholder)) {
            appliedResult = replaceLayoutPlaceholderByName(layoutPlaceholder, composed, layoutTemplate);
        } else {
            appliedResult = replaceLayoutPlaceholderByOrder(layoutPlaceholder, composed, layoutTemplate);
        }
        return appliedResult;
    };
    this.parseLayoutArgs = function (placeholderName) {
        var argsStart = placeholderName.indexOf('(');
        var argsEnd = placeholderName.lastIndexOf(')');
        var argsPart = placeholderName.substring(argsStart + 1, argsEnd);
        var searchCol = true;
        var parts = [];
        var lastSep = -1;
        var openParCount = 0;
        for (var i = 0; searchCol && i < argsPart.length; i += 1) {
            var c = argsPart.charAt(i);
            if (c === '(') {
                openParCount += 1;
            } else if (c === ')') {
                openParCount -= 1;
            }
            if (c === ';') {
                if (openParCount === 0) {
                    if (lastSep > 0) {
                        parts.push(argsPart.substring(lastSep + 1, i).trim());
                    } else {
                        parts.push(argsPart.substring(0, i).trim());
                    }
                    lastSep = i;
                }
            }
        }
        if (lastSep < 0) {
            parts.push(argsPart.substring(0, i).trim());
        } else {
            parts.push(argsPart.substring(lastSep + 1, i).trim());
        }
        return parts;
    };
    this.parsePlaceholder = function (currentName, fullTag, currentStartIndex, currentEndIndex, filepath) {
        var dropPointType = 'layout';
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
    createFactory: function (args) {
        return new PlaceholderFactory(args);
    }
};