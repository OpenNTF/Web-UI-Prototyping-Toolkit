const utils = require("./utils");
const Placeholder = require('./Placeholder');
const hbsUtils = require("./hbsUtils");
const logger = utils.createLogger({sourceFilePath: __filename});
function PlaceholderFactory({runtime,composer}){
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
     * @param {Placeholder} partName
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function(partName, composed, metadata) {
        let wrapper;
        const t = this;
        const partPath = this.runtime.resolveFilePathForPlaceHolder(partName);
        metadata.deps[partPath] = 1;
        const wrappedData = this.composer.readFragment(partPath, metadata);
        wrapper = wrappedData.content.trim();
        if(utils.endsWith(partPath, '.hbs')){
            wrapper = hbsUtils.replaceHbsBodyPartialWithMainDroppoint(wrapper);
        }
        const contentDropPoints = this.composer.findDropPointsOfType(partPath, wrapper, "content");
        let mainContentDropPoint = -1;
        let mainContentDropPointIdx = -1;

        /*
         [ 'hb:singleObject' ]
         [ 'hb:multiObject(\'home\')' ]
         [ 'hb:multiObject(\'second\')' ]
         [ 'hb:multiArray(1)' ]
         [ 'hb:multiArray(page="home")' ]
         */
        function processArray(firstArg, parsedData){
            let o;
            if(openArgIdx <= 0){
                throw new Error("Illegal tag for array data usage: " + partName.tag);
            }else{
                const argVal = firstArg.substring(firstArg.indexOf('(') + 1, firstArg.lastIndexOf(')'));
                const argValFirstChar = argVal.charAt(0);
                if(argValFirstChar == parseInt(argValFirstChar, 10)){
                    //index
                    const dataIndexArg = parseInt(argVal, 10);

                    o = parsedData[dataIndexArg];
                }else{
                    //propVal
                    const split = argVal.split("=");
                    const propPath = split[0];
                    let propValReq = split[1];
                    if(propValReq.charAt(0) === '\'' ||propValReq.charAt(0) === '"'  ){
                        propValReq = propValReq.substring(1, propValReq.length -1);
                    }
                    let found = false;
                    parsedData.forEach(function(d){
                        let propPathParts;
                        if(propPath.indexOf('.')>0){
                            propPathParts = propPath.split('.');
                            propPathParts.splice(0, 0, d);
                            if(utils.nestedPathExists.apply(undefined, propPathParts)){
                                const nestedVal = utils.getNestedPath(propPathParts);
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
            const openArgIdx = firstArg.indexOf('(');
            let o;
            if(openArgIdx > 0){
                //with sub path
                let argVal = firstArg.substring(firstArg.indexOf('(') + 1, firstArg.lastIndexOf(')'));
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

        let dataArgs = false;
        if(partName.hasArgs() && partName.args[0].indexOf("hb:") === 0){
            const firstArg = partName.args[0];
            var openArgIdx = firstArg.indexOf('(');
            const dataPathName = firstArg.substring(firstArg.indexOf(':') + 1, openArgIdx > 0 ? openArgIdx : firstArg.length);
            const dataPath = t.runtime.constructProjectPath(dataPathName + ".json");
            metadata.deps[dataPath] = 1;
            const dataContents = t.runtime.readFile(dataPath);
            let parsedData = JSON.parse(dataContents);
            if(utils.isArray(parsedData)){
                dataArgs = processArray(firstArg, parsedData);
            }else if(typeof parsedData === 'object'){
                dataArgs = processObject(firstArg, parsedData);
            }else{
                throw new Error();
            }
        }
        for(let di = contentDropPoints.length -1; di >= 0; di -=1){
            const dp = contentDropPoints[di];
            if (dp.isNamed('main')) {
                if (mainContentDropPoint !== -1) {
                    throw new Error("Overlapping content:main droppoint in " + partPath);
                }
                mainContentDropPoint = dp;
                mainContentDropPointIdx = di;
            }else{
                if(partName.hasArgs()){

                    let layoutArgs;
                    if(typeof dataArgs === 'object'){
                        layoutArgs = dataArgs;
                    }else{
                        layoutArgs = partName.getArgsObject();
                    }
                    if(layoutArgs.hasOwnProperty(dp.getName())){
                        const currentArgs = layoutArgs[dp.getName()];
                        if(utils.isArray(currentArgs)){
                            let argsOut = '';
                            currentArgs.forEach(arg =>{
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
                            const arg = currentArgs;
                            const firstArgChar = arg.charAt(0);
                            let repl = '';
                            if (firstArgChar === "'" || firstArgChar === '"') {
                                repl += arg.substring(1, arg.length - 1);
                            } else {
                                if (!t.composer.startsWithDropPointPrefix(arg)) {
                                    //console.error("Error parsing droppoint args : ", dp.getArgs());
                                    //throw new Error("Missing type prefix (eg file:) in " + arg);
                                    repl = arg;
                                }else{
                                    if(arg.indexOf(',')>0){
                                        const splitArgs = arg.split(',');
                                        splitArgs.forEach(function(sa){
                                            repl += t.composer.dropPointPrefix + sa + t.composer.dropPointPostfix;
                                        });
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
        const cps = this.composer.findDropPointsOfType(partPath, wrapper, "content");
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
     * @return {Placeholder}
     */
    this.parsePlaceholder = function(currentName, fullTag, currentStartIndex, currentEndIndex, filepath){
        return Placeholder.parsePlaceholder(fullTag, filepath, currentStartIndex, currentEndIndex);
    };
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};