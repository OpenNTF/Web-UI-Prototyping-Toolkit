var utils = require("./utils");
var Placeholder = utils.Placeholder;
function PlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

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
                        console.log("LOOKING FOR " + propPath + " = " + propValReq + " in ", d);
                        var propPathParts;
                        if(propPath.indexOf('.')>0){
                            propPathParts = propPath.split('.');
                            propPathParts.splice(0, 0, d);
                            if(utils.nestedPathExists.apply(undefined, propPathParts)){
                                var nestedVal = utils.getNestedPath(propPathParts);
                                console.log("NESTED VAL = " + nestedVal);
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
        if(partName.getArgs().length === 1 && partName.getArgs()[0].indexOf("hb:") === 0){
            var firstArg = partName.getArgs()[0];
            var openArgIdx = firstArg.indexOf('(');
            var dataPathName = firstArg.substring(firstArg.indexOf(':')+1, openArgIdx >0 ? openArgIdx  : firstArg.length);
            console.log("datapath = " + dataPathName);
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
            console.log("DATA ARG for " + firstArg + " = ", dataArgs);
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

                var layoutArgs;
                if(typeof dataArgs === 'object'){
                    layoutArgs = dataArgs;
                }else{
                    layoutArgs = partName.getArgsObject();
                }
                if(layoutArgs.hasOwnProperty(dp.getName())){
                    var currentArgs = layoutArgs[dp.getName()];
                    console.log("Found arg for " + dp.getName() + " : ", currentArgs);
                    if(utils.isArray(currentArgs)){
                        var argsOut = '';
                        currentArgs.forEach(function(arg){
                            if (arg.charAt(0) === "'" || arg.charAt(0) === '"') {
                                argsOut += arg.substring(1, arg.length - 1);
                            } else {
                                if (!t.composer.startsWithDropPointPrefix(arg)) {
                                    console.error("Error parsing droppoint args : ", dp.getArgs());
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

    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
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
            var ph = new Placeholder({
                name: currentName.substring(0, currentName.indexOf('(')),
                start: currentStartIndex,
                end: currentEndIndex,
                type: 'wrap',
                tag: fullTag,
                filepath: filepath,
                args: layoutArgs
            });
            return ph;
        } else {
            var colonIdx = currentName.indexOf(this.composer.dropPointSeparatorName);
            var nameOnly;
            if (colonIdx > 0) {
                nameOnly = currentName.substring(0, colonIdx);
            } else {
                nameOnly = currentName;
            }
            var argsText = currentName.substring(colonIdx + 1);
            var args = argsText.split(this.composer.dropPointSeparatorArgs);
            if (nameOnly.length === 0) {
                throw new Error("Illegal nameOnly");
            }
            var ph = new Placeholder({
                name: nameOnly,
                start: currentStartIndex,
                end: currentEndIndex,
                type: 'wrap',
                tag: fullTag,
                filepath: filepath,
                args: args
            });
            return ph;
        }

    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};