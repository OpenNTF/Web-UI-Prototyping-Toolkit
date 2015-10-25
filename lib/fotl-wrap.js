var utils = require("./utils");
var Placeholder = utils.Placeholder;
var logger = utils.createLogger({sourceFilePath : __filename});
function PlaceholderFactory(args){
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = args.runtime;
    /**
     * @type {TemplateComposer}
     */
    this.composer = args.composer;
    /**
     *
     * @param {utils.Placeholder} partName
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function(partName, composed, metadata) {
        var wrapper;
        var t = this;
        var partPath = this.runtime.resolveFilePathForPlaceHolder(partName);
        metadata.deps[partPath] = 1;
        var wrappedData = this.composer.readFragment(partPath, metadata);
        wrapper = wrappedData.content.trim();
        var contentDropPoints = this.composer.findDropPointsOfType(partPath, wrapper, "content");
        var mainContentDropPoint = -1;
        var mainContentDropPointIdx = -1;

        /*
         [ 'hb:singleObject' ]
         [ 'hb:multiObject(\'home\')' ]
         [ 'hb:multiObject(\'second\')' ]
         [ 'hb:multiArray(1)' ]
         [ 'hb:multiArray(page="home")' ]
         */
        function processArray(firstArg, parsedData){
            var o;
            if(openArgIdx <= 0){
                throw new Error("Illegal tag for array data usage: " + partName.getTag());
            }else{
                var argVal = firstArg.substring(firstArg.indexOf('(')+1, firstArg.lastIndexOf(')'));
                var argValFirstChar = argVal.charAt(0);
                if(argValFirstChar == parseInt(argValFirstChar, 10)){
                    //index
                    var dataIndexArg = parseInt(argVal, 10);

                    o = parsedData[dataIndexArg];
                }else{
                    //propVal
                    var split = argVal.split("=");
                    var propPath = split[0];
                    var propValReq = split[1];
                    if(propValReq.charAt(0) === '\'' ||propValReq.charAt(0) === '"'  ){
                        propValReq = propValReq.substring(1, propValReq.length -1);
                    }
                    var found = false;
                    parsedData.forEach(function(d){
                        var propPathParts;
                        if(propPath.indexOf('.')>0){
                            propPathParts = propPath.split('.');
                            propPathParts.splice(0, 0, d);
                            if(utils.nestedPathExists.apply(undefined, propPathParts)){
                                var nestedVal = utils.getNestedPath(propPathParts);
                                if(nestedVal === propValReq.substring(1, propValReq.length-1)){
                                    if(found){
                                        throw new Error("dpulicate found");
                                    }
                                    found = d;
                                }
                            }
                        }else{
                            //propPathParts = [propPath];
                            if(d.hasOwnProperty(propPath) && d[propPath] === propValReq){
                                if(found){
                                    throw new Error("dpulicate found");
                                }
                                found = d;
                            }
                        }
                    });
                    if(!found) throw new Error("not found : " + firstArg);
                    o = found;
                }
            }
            return o;
        }

        function processObject(firstArg, parsedData){
            var openArgIdx = firstArg.indexOf('(');
            var o;
            if(openArgIdx > 0){
                //with sub path
                var argVal = firstArg.substring(firstArg.indexOf('(')+1, firstArg.lastIndexOf(')'));
                argVal = argVal.substring(1, argVal.length -1);
                if(!parsedData.hasOwnProperty(argVal)){
                    throw new Error("doesn't exist in object" + argVal);
                }
                o = parsedData[argVal];
            }else{
                //whole obj
                o = parsedData;
            }
            return o;
        }

        var dataArgs = false;
        if(partName.hasArgs() && partName.getArgs()[0].indexOf("hb:") === 0){
            var firstArg = partName.getArgs()[0];
            var openArgIdx = firstArg.indexOf('(');
            var dataPathName = firstArg.substring(firstArg.indexOf(':')+1, openArgIdx >0 ? openArgIdx  : firstArg.length);
            var dataPath = t.runtime.constructProjectPath(dataPathName + ".json");
            metadata.deps[dataPath] = 1;
            var dataContents = t.runtime.readFile(dataPath);
            var parsedData = JSON.parse(dataContents);
            if(utils.isArray(parsedData)){
                dataArgs = processArray(firstArg, parsedData);
            }else if(typeof parsedData === 'object'){
                dataArgs = processObject(firstArg, parsedData);
            }else{
                throw new Error();
            }
        }
        for(var di = contentDropPoints.length -1; di >= 0; di -=1){
            var dp = contentDropPoints[di];
            if (dp.isNamed('main')) {
                if (mainContentDropPoint !== -1) {
                    throw new Error("Overlapping content:main droppoint in " + partPath);
                }
                mainContentDropPoint = dp;
                mainContentDropPointIdx = di;
            }else{
                if(partName.hasArgs()){

                    var layoutArgs;
                    if(typeof dataArgs === 'object'){
                        layoutArgs = dataArgs;
                    }else{
                        layoutArgs = partName.getArgsObject();
                    }
                    if(layoutArgs.hasOwnProperty(dp.getName())){
                        var currentArgs = layoutArgs[dp.getName()];
                        if(utils.isArray(currentArgs)){
                            var argsOut = '';
                            currentArgs.forEach(function(arg){
                                if (arg.charAt(0) === "'" || arg.charAt(0) === '"') {
                                    argsOut += arg.substring(1, arg.length - 1);
                                } else {
                                    if (!t.composer.startsWithDropPointPrefix(arg)) {
                                        logger.error("Error parsing droppoint args : ", dp.getArgs());
                                        throw new Error("Missing type prefix (eg file:) in " + arg);
                                    }
                                    argsOut += t.composer.dropPointPrefix + arg + t.composer.dropPointPostfix;
                                }
                            });
                            wrapper = dp.replacePartContents(wrapper, argsOut);
                        }else if(utils.isString(currentArgs)){
                            var arg = currentArgs;
                            var firstArgChar = arg.charAt(0);
                            var repl = '';
                            if (firstArgChar === "'" || firstArgChar === '"') {
                                repl += arg.substring(1, arg.length - 1);
                            } else {
                                if (!t.composer.startsWithDropPointPrefix(arg)) {
                                    //console.error("Error parsing droppoint args : ", dp.getArgs());
                                    //throw new Error("Missing type prefix (eg file:) in " + arg);
                                    repl = arg;
                                }else{
                                    if(arg.indexOf(',')>0){
                                        var splitArgs = arg.split(',');
                                        splitArgs.forEach(function(sa){
                                            repl += t.composer.dropPointPrefix + sa + t.composer.dropPointPostfix;
                                        })
                                    }else{
                                        repl += t.composer.dropPointPrefix + arg + t.composer.dropPointPostfix;
                                    }
                                }
                            }
                            wrapper = dp.replacePartContents(wrapper, repl);
                        }else{
                            throw new Error();
                        }
                    }
                }
            }
        }
        composed = partName.replacePartContentsWithoutMarking(composed, ""); //remove the wrap tag
        var cps = this.composer.findDropPointsOfType(partPath, wrapper, "content");
        cps.forEach(function(cp){
            if(cp.isNamed('main')){
                composed = cp.replacePartContents(wrapper, composed);
            }
        });
        if (mainContentDropPoint === -1) {
            throw new Error("Could not find content:main inside " + partPath + " which is being invoked as wrapper");
        }
        return composed;

    };
    /**
     *
     * @param {String} currentName
     * @param {String} fullTag
     * @param {Number} currentStartIndex
     * @param {Number} currentEndIndex
     * @param {String} filepath
     * @return {utils.Placeholder}
     */
    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
        return utils.parsePlaceholder(fullTag, filepath, currentStartIndex, currentEndIndex);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};