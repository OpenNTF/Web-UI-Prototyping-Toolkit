const utils = require("./utils");
const Placeholder = require('./Placeholder');
const logger = utils.createLogger({sourceFilePath: __filename});
function PlaceholderFactory({runtime, composer}) {
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
     * @param {Placeholder} layoutPlaceholder
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function (layoutPlaceholder, composed, metadata) {
        const runtime = this.runtime;
        const t = this;

        function applyContentPlaceholderWrapper(contentTag, orderedDropPointReplacement) {
            const wrapperArg = contentTag.getArgs()[0];
            const wrapperName = wrapperArg.substring(wrapperArg.indexOf('=') + 1);
            const up = (wrapperName.charAt(0) === '/' ? wrapperName : '/' + wrapperName) + ".html";
            const wrapperFilePath = runtime.findFileForUrlPathname(up);
            metadata.deps[wrapperFilePath] = 1;
            const wrapperContents = runtime.readFile(wrapperFilePath);
            const contentDropPoints = t.composer.findDropPointsOfType(wrapperFilePath, wrapperContents, "content");
            contentDropPoints.forEach(function (wdp) {
                if (wdp.isNamed('main')) {
                    orderedDropPointReplacement = wdp.replacePartContents(wrapperContents, orderedDropPointReplacement);
                }
            });
            return orderedDropPointReplacement;
        }

        function calculateOrderedDropPointReplacement(currentContentTagDroppoint, currentLayoutTagArguments) {
            let orderedDropPointReplacement = '';
            if (utils.isDefined(currentLayoutTagArguments)) {
                if (currentLayoutTagArguments.indexOf(',') > 0) {
                    const splitArgs = currentLayoutTagArguments.split(',');
                    splitArgs.forEach(function (currentDropPointArg) {
                        let replacement;
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
                    let otherReplacement;
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
            let namedDropPointReplacement = '';
            if (utils.isDefined(specifiedArgs)) {
                specifiedArgs.forEach(function (currentArg) {
                    if (currentArg.indexOf(',') > 0) {
                        const splitArgs = currentArg.split(',');
                        splitArgs.forEach(function (currentDropPointArg) {
                            let replacement;
                            if (currentDropPointArg.charAt(0) === "'" || currentDropPointArg.charAt(0) === '"') {
                                const unquotedReplacement = currentDropPointArg.substring(1, currentDropPointArg.length - 1);
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
            let layoutTemplatePath;
            try {
                layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutTag);
                metadata.deps[layoutTemplatePath] = 1;
            } catch (lpe) {
                logger.error("Could not process layoutPlaceholder " + layoutTag.placeholder, lpe.stack);
                if (runtime.lenient) {
                    return layoutTag.replacePartContents(composedMarkup, t.composer.createErrorMarkup("Could not process layoutPlaceholder " + layoutTag.placeholder));
                } else {
                    throw new Error("Could not process layoutPlaceholder " + layoutTag.placeholder);
                }
            }
            const layoutContentDropPoints = t.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
            layoutContentDropPoints.reverse();
            const layoutTagArguments = layoutTag.getArgs();
            const argsProvidedCount = layoutTagArguments.length;
            const argsExpectedCount = layoutContentDropPoints.length;
            const argsProvidedExpectedDelta = argsExpectedCount - argsProvidedCount;
            if (layoutTagArguments.length > 0) {
                const parIdx = layoutTagArguments[0].indexOf('(');
                const eqIdx = layoutTagArguments[0].indexOf('=');
                if (eqIdx > 0 && (parIdx < 0 || parIdx > eqIdx )) {
                    throw new Error("Mapping by name ");
                }
            }
            layoutContentDropPoints.forEach(function (currentContentTagDroppoint, dpIdx) {
                const currentLayoutTagArguments = layoutTagArguments[dpIdx - argsProvidedExpectedDelta];
                const replacement = calculateOrderedDropPointReplacement(currentContentTagDroppoint, currentLayoutTagArguments);
                layoutTemplate = currentContentTagDroppoint.replacePartContents(layoutTemplate, replacement);
            });
            return layoutTag.replacePartContents(composedMarkup, layoutTemplate);
        }

        function constructArgumentsByNameObject(layoutPlaceholderArgs) {
            const placeholderArgsByName = {};
            layoutPlaceholderArgs.forEach(function (phArg) {
                const argName = phArg.substring(0, phArg.indexOf('='));
                const argValue = phArg.substring(phArg.indexOf('=') + 1);
                let argValues;
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
            const layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholderByName);
            metadata.deps[layoutTemplatePath] = 1;
            const layoutTagContentDropPoints = t.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
            layoutTagContentDropPoints.reverse();
            const layoutPlaceholderArgs = layoutPlaceholderByName.getArgs();
            layoutPlaceholderArgs.reverse();
            if (!(layoutPlaceholderArgs.length > 0 && layoutPlaceholderArgs[0].indexOf('=') > 0)) {
                throw new Error("Not leveraging name based mapping");
            }
            const placeholderArgsByName = constructArgumentsByNameObject(layoutPlaceholderArgs);
            //by name
            layoutTagContentDropPoints.forEach((currentContentTag, dpIdx) =>{
                const specifiedArgs = placeholderArgsByName[currentContentTag.name];
                const replacement = calculateNamedArgumentReplacement(currentContentTag, specifiedArgs);
                layoutTemplate = currentContentTag.replacePartContents(layoutTemplate, replacement);
            });
            return layoutPlaceholderByName.replacePartContents(composedMarkup, layoutTemplate);
        }

        /**
         *
         * @param {Placeholder} layoutPlaceholder
         * @return {string}
         */
        function resolveLayoutFilePath(layoutPlaceholder) {
            let layoutTemplatePath = null;
            try {
                layoutTemplatePath = runtime.resolveFilePathForPlaceHolder(layoutPlaceholder);
            } catch (e) {
                logger.error("Could not process layoutPlaceholder " + layoutPlaceholder.type + ":" + layoutPlaceholder.name, e.stack);
                logger.info("Error for droppoint : ", layoutPlaceholder);
                if (!runtime.lenient) {
                    throw new Error("Could not process layoutPlaceholder " + layoutPlaceholder.type + ":" + layoutPlaceholder.name);
                }
            }
            return layoutTemplatePath;
        }

        /**
         *
         * @param {string} layoutTemplatePath
         * @param {string} layoutTemplate
         * @return {string[]}
         */
        function collectPassLayoutArgumentNames(layoutTemplatePath, layoutTemplate) {
            const passLayoutArgsDropPointCandidates = t.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "layout");
            const passArgNames = [];
            passLayoutArgsDropPointCandidates.forEach(function (dp) {
                dp.getArgs().forEach(function (arg) {
                    if (arg.indexOf("=content:") > 0 || arg.indexOf("content:") === 0) {
                        const idx = arg.indexOf("content:");
                        const argValue = arg.substring(idx + 8);
                        passArgNames.push(argValue);
                    }
                });
            });
            return passArgNames;
        }

        /**
         *
         * @param {Placeholder} layoutPlaceholder
         * @return {boolean}
         */
        function areLayoutArgsPassedByName(layoutPlaceholder) {
            return layoutPlaceholder.args.length > 0 && layoutPlaceholder.args[0].indexOf('=') > 0 && (layoutPlaceholder.args[0].indexOf('(') < 0 || layoutPlaceholder.args[0].indexOf('(') > layoutPlaceholder.args[0].indexOf('=') );
        }

        let layoutTemplatePath = resolveLayoutFilePath(layoutPlaceholder);
        if (!layoutTemplatePath) {
            return layoutPlaceholder.replacePartContents(composed, this.composer.createErrorMarkup("Could not process layoutPlaceholder " + layoutPlaceholder.type + ":" + layoutPlaceholder.name));
        }
        metadata.deps[layoutTemplatePath] = 1;
        const layoutTemplateContents = this.composer.readFragment(layoutTemplatePath, metadata);
        let layoutTemplate = layoutTemplateContents.content.trim();
        collectPassLayoutArgumentNames(layoutTemplatePath, layoutTemplate).forEach(passArg =>{
            const contentDroppointTagContentsOpener = 'content:' + passArg;
            let repl = -1;
            layoutPlaceholder.args.forEach(layoutPlaceholderArgument =>{
                const argStartCrit = passArg + "=";
                if (layoutPlaceholderArgument.indexOf(argStartCrit) === 0) {
                    repl = layoutPlaceholderArgument.substring(argStartCrit.length);
                }
            });
            const critIdx = layoutTemplate.indexOf(contentDroppointTagContentsOpener);
            if (typeof repl === 'string') {
                layoutTemplate = layoutTemplate.substring(0, critIdx) + repl + layoutTemplate.substring(critIdx + contentDroppointTagContentsOpener.length);
            }
        });
        composed.content = layoutTemplate;
        const layoutContentDropPoints = this.composer.findDropPointsOfType(layoutTemplatePath, layoutTemplate, "content");
        layoutContentDropPoints.reverse();
        layoutPlaceholder.args.reverse();
        let appliedResult;
        if (areLayoutArgsPassedByName(layoutPlaceholder)) {
            appliedResult = replaceLayoutPlaceholderByName(layoutPlaceholder, composed, layoutTemplate);
        } else {
            appliedResult = replaceLayoutPlaceholderByOrder(layoutPlaceholder, composed, layoutTemplate);
        }
        return appliedResult;
    };
    this.parseLayoutArgs = function (placeholderName) {
        const argsStart = placeholderName.indexOf('(');
        const argsEnd = placeholderName.lastIndexOf(')');
        const argsPart = placeholderName.substring(argsStart + 1, argsEnd);
        const searchCol = true;
        const parts = [];
        let lastSep = -1;
        let openParCount = 0;
        for (var i = 0; searchCol && i < argsPart.length; i += 1) {
            const c = argsPart.charAt(i);
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

    /**
     *
     * @param {String} currentName
     * @param {String} fullTag
     * @param {Number} currentStartIndex
     * @param {Number} currentEndIndex
     * @param {String} filepath
     * @return {Placeholder}
     */
    this.parsePlaceholder = function (currentName, fullTag, currentStartIndex, currentEndIndex, filepath) {
        return Placeholder.parsePlaceholder(fullTag, filepath, currentStartIndex, currentEndIndex);
        // var dropPointType = 'layout';
        // var args = this.parseLayoutArgs(currentName);
        // return new Placeholder({
        //     name: currentName.substring(0, currentName.indexOf('(')),
        //     start: currentStartIndex,
        //     end: currentEndIndex,
        //     type: dropPointType,
        //     tag: fullTag,
        //     filepath: filepath,
        //     args: args
        // });
    };
}
module.exports = {
    createFactory: function (args) {
        return new PlaceholderFactory(args);
    }
};