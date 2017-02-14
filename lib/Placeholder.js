const utils = require('./utils');
class Placeholder {
    /**
     *
     * @param {String} name
     * @param {String} type
     * @param {Number} start
     * @param {Number} end
     * @param {String} tag
     * @param {String[]} args
     * @param {String} filepath
     */
    constructor({name, type, start, end, tag, args, filepath}) {
        /**
         * @type {String}
         */
        this._name = name;
        /**
         * @type {String}
         */
        this._type = type;
        /**
         * @type {Number}
         */
        this._start = start;
        /**
         * @type {Number}
         */
        this._end = end;
        /**
         * @type {String}
         */
        this._tag = tag;
        /**
         * @type {String[]}
         */
        this._args = args;

        if (!filepath) {
            throw new Error("missing filepath");
        }
        this._filepath = filepath;
        this.validateArgs();
    }
    validateArgs(){
        if(this._args){
            this._args.forEach(function(a, idx){
                if(a.trim().length <3){
                    console.error("error args : ", args);
                    throw new Error("Illegal argument at idx " + idx + " for " + this._tag + " in " + this._filepath);
                }
            });
        }
    }
    get name(){
        return this._name;
    }
    get type(){
        return this._type;
    }
    get start(){
        return this._start;
    }
    get end(){
        return this._end;
    }
    get tag(){
        return this._tag;
    }
    get args(){
        return this._args;
    }
    get filepath(){
        return this._filepath;
    }



    /**
     * @return {String}
     */
    getName() { return this._name;}

    /**
     * @return {String}
     */
    getType() {return this._type;}

    /**
     * @return {Number}
     */
    getStart() {return this._start;}

    /**
     * @return {Number}
     */
    getEnd() {return this._end;}

    /**
     * @return {String}
     */
    getTag() {return this._tag;}

    /**
     * @return {Object.<String,String>}
     */
    getArgsObject() {
        if(!this.isArgsByName()){
            throw new Error("Args are not by name for " + this._tag + " in " + this._filepath);
        }
        const o = {};
        if(utils.isArray(this._args)){
            this._args.forEach(function(arg){
                if(arg.indexOf('=') > 0){
                    const splitArg = arg.split('=');
                    const nm = splitArg[0];
                    if(splitArg[1].indexOf(',')>0){
                        o[nm] = splitArg[1].split(',');
                    }else{
                        o[nm] = splitArg[1];
                    }
                }

            });
        }
        return o;
    }

    /**
     * @return {String[]}
     */
    getArgs() {return this._args;}

    /**
     * @return {boolean}
     */
    hasArgs() {
        return this._args && this._args.length > 0;
    }

    /**
     * @return {boolean}
     */
    isArgsByName() {
        if(!this.hasArgs()){
            throw new Error('Placeholder for ' + this._tag + ' from ' + this._filepath + ' has no args, check hasArgs() first');
        }
        let allArgs = true;
        this.getArgs().forEach(a =>{
            allArgs = allArgs && this.isNamedArg(a);
        });
        return allArgs;
    }

    /**
     * @return {boolean}
     */
    isArgsByOrder() {
        return !this.isArgsByName();
    }

    /**
     * @return {String}
     */
    getFilePath() {return this._filepath;}

    /**
     * @param {String} type
     * @return {boolean}
     */
    isOfType(type) {
        return this._type === type;
    }

    /**
     * @param {String} name
     */
    setName(name) {
        this._name = name;
    }

    /**
     * @param {String} name
     * @return {boolean}
     */
    isNamed(name) {
        return this._name === name;
    }

    /**
     * @return {boolean}
     */
    isRelativePathName() {
        return this._name.indexOf("./") === 0 || this._name.indexOf("../") === 0;
    }

    /**
     * @return {boolean}
     */
    isDefaultResourceInclusion() {
        return this._name === 'default' && (this._type === 'linkScript' || this._type==='linkCss');
    }

    /**
     *
     * @param {String} content
     * @param {String} partContents
     * @param {boolean} addMarkers
     * @return {String}
     */
    replacePartContents(content, partContents, addMarkers) {
        let am = false;
        if(typeof addMarkers === 'boolean'){
            am = addMarkers;
        }
        let newContent;
        if(am){
            let partArgs = "";
            if (this.hasArgs()) {
                partArgs = ":" + this.getArgs().join();
            }
            const prefix = '<!-- begin_' + this.getType() + '-' + this.getName() + partArgs + ' -->';
            const postfix = '<!-- end_' + this.getType() + '-' + this.getName() + partArgs + ' -->';
            newContent = content.substring(0, this.getStart()) + prefix + partContents + postfix + content.substring(this.getEnd());
        }else{
            newContent = content.substring(0, this.getStart()) + partContents + content.substring(this.getEnd());
        }
        return newContent;
    }

    /**
     *
     * @param {String} content
     * @param {String} partContents
     * @return {String}
     */
    replacePartContentsWithoutMarking(content, partContents) {
        return content.substring(0, this.getStart()) + partContents + content.substring(this.getEnd());
    }
    isNamedArg(arg){
        if(arg.trim().length < 3){
            throw new Error("Illegal argument (between single quotes) : '" + arg + "'");
        }
        const eqIdx = arg.indexOf('=');
        if(eqIdx < 1) {
            return false;
        }
        const sqIdx = arg.indexOf('\'');
        if(sqIdx === 0) {
            return false;
        }
        const qIdx = arg.indexOf('"');
        if(qIdx === 0) {
            return false;
        }
        let quoteIdx = -1;
        if(qIdx >0) {
            quoteIdx = qIdx;
        }
        if(sqIdx > 0 && sqIdx < qIdx) {
            quoteIdx = sqIdx;
        }
        if(quoteIdx > 0){
            if(quoteIdx <= eqIdx){
                return false;
            }
        }
        return true;
    }


    /**
     *
     * @param {String} placeholderName
     * @return {String[]}
     */
    static parseLayoutArgs(placeholderName) {
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
    }

    /**
     *
     * @param {String} fullTag
     * @param {String} filepath
     * @param {Number} startIdx
     * @param {Number} endIdx
     * @return {Placeholder}
     */
    static parsePlaceholder(fullTag, filepath, startIdx, endIdx) {
        const tagText = fullTag.trim().substring(4, fullTag.length - 3).trim();
        const type = tagText.substring(0, tagText.indexOf(':'));

        const nameAndArgsPart = tagText.substring(tagText.indexOf(':') + 1);

        const end = (typeof endIdx === 'number') ? endIdx : startIdx + fullTag.length;
        const hasArgs = nameAndArgsPart.indexOf('(') > 1;
        let name;
        let ph;
        if (hasArgs) {
            const args = Placeholder.parseLayoutArgs(nameAndArgsPart);
            name = nameAndArgsPart.substring(0, nameAndArgsPart.indexOf('('));
            ph = new Placeholder({
                name: name,
                start: startIdx,
                end: end,
                type: type,
                tag: fullTag,
                filepath: filepath,
                args: args
            });
        } else {
            name = nameAndArgsPart.trim();
            ph = new Placeholder({
                name: name,
                start: startIdx,
                end: end,
                type: type,
                tag: fullTag,
                filepath: filepath,
                args: []
            });
        }
        return ph;
    }
}


module.exports = Placeholder;