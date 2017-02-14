const utils = require("./utils");
const fs = require("fs");
const Placeholder = require('./Placeholder');

const logger = utils.createLogger({sourceFilePath: __filename});

let loremLines = [];


/**
 *
 * @param {{lines:String[]}}args
 * @return {{determineReplacement: determineReplacement}}
 * @constructor
 */
function Lorem(args) {
    const lines = args.lines.filter(function (l) {
        return l.trim().length > 0;
    }).map(function (l) {
        const trim = l.trim();
        return trim.replace(/[ ]{2,}/g, ' ');
    });
    const phrases = [];
    lines.forEach(l =>{
        const tp = l.split(".");
        tp.forEach(p =>{
            const phrase = p.trim();
            if(phrase.length > 0){
                phrases.push(phrase);
            }
        });
    });
    if (typeof args !== 'object' || !utils.isArray(lines) || lines.length < 1) {
        logger.error("Illegal Lorem args, expecting property 'lines' containing array of phrases: ", args);
        throw new Error("illegal args: " + args);
    }

    /**
     *
     * @param {Number} [minLength]
     * @param {Number} [maxLength]
     * @param {String} [caseType]
     * @param {String} [tag]
     * @return {String}
     */
    function doPhrase(minLength, maxLength, caseType, tag) {
        let p;
        if(typeof minLength === 'number'){
            const shuffledPhrases = utils.shuffleArray([].concat(phrases));
            let w = "";
            let shortest = 10000;
            for(let i = 0 ; w.length < 1 && i < shuffledPhrases.length ; i++){
                const l = shuffledPhrases[i];
                const phWords = l.split(" ");
                if(phWords.length < shortest){
                    shortest = phWords.length;
                }
                if(phWords.length >= minLength && phWords.length <= maxLength){
                    w = l;
                }
            }
            if (w.length < 1) {
                throw new Error("Could not find phrase of minlength " + minLength + " words and max " + maxLength + " words in phrase, shortest word length = " + shortest);
            }
            p = w;
        }else{
            p = lines[utils.randomArrayIndex(lines)];
        }
        p = applyCase(p, caseType);
        p = applyTag(p, tag);
        return p;
    }

    /**
     * @param {Number} [minLength]
     * @param {Number} [maxLength]
     * @param {String} [caseType]
     * @param {String} [tag]
     * @return {String}
     */
    function doParagraph(minLength, maxLength, caseType, tag) {
        let count;
        if(typeof minLength === 'number'){
            count = utils.randomInt(minLength, maxLength);
        }else{
            count = 3;
        }
        let out = '';
        for (let idx = 0; idx < count; idx += 1) {
            out += doPhrase();
        }
        out = applyCase(out, caseType);
        out = applyTag(out, tag);
        return out;
    }

    /**
     *
     * @param {Number} [minChars]
     * @param {Number} [maxChars]
     * @param {String} [caseType]
     * @param {String} [tag]
     * @return {string}
     */
    function doWord(minChars, maxChars, caseType, tag){
        if (typeof minChars !== 'number') {
            minChars = 4;
        }
        if (typeof maxChars !== 'number') {
            maxChars = 16;
        }
        const shuffledLines = utils.shuffleArray([].concat(lines));
        let w = "";
        const wordRegexp = new RegExp("[a-zA-Z]{" + minChars + "," + maxChars + "}", "g");
        for(let i = 0 ; w.length < 1 && i < shuffledLines.length ; i++){
            var p = shuffledLines[i];
            let start = 0;
            while (w.length < 1) {
                const e = p.indexOf(" ", start);
                const m = p.substring(start, e);
                if (m.length >= minChars && m.length <= maxChars && wordRegexp.test(m)) {
                    w = m;
                } else {
                    start = e + 1;
                }
            }
        }
        if (w.length < 1) {
            throw new Error("Could not find word of minlength " + minChars + " and max " + maxChars);
        }
        w = applyCase(w, caseType);
        w = applyTag(w, tag);

        return w;
    }

    function applyTag(str, tag){
        let w = str;
        if(typeof tag === 'string'){
            w = createOpenTag(tag) + str + createCloseTag(tag);
        }
        return w;
    }

    function applyCase(str, caseType){
        let w = str;
        if(typeof caseType === 'string'){
            switch (caseType) {
                case "up":
                case "upper":
                    w = w.toUpperCase();
                    break;
                case "low":
                case "lower":
                    w = w.toLowerCase();
                    break;
                case "cap":
                case "capitalize":
                    w = w.substring(0, 1).toUpperCase() + w.substring(1).toLowerCase();
                    break;
            }
        }
        return w;
    }

    function createOpenTag(tag) {
        return '<' + tag.trim() + '>';
    }

    function createCloseTag(tag) {
        const t = tag.trim();
        const si = t.indexOf(' ');
        let o;
        if (si > 0) {
            o = t.substring(0, si);
        } else {
            o = t;
        }
        return '</' + o + '>';
    }

    /**
     *
     * @param {Placeholder} part
     * @return {String}
     */
    function calculateNoArgumentsResult(part) {
        let replacement;
        switch (part.getName()) {
            case "word":
                replacement = doWord();
                break;
            case "paragraph":
                replacement = doParagraph();
                break;
            case "phrase":
                replacement = doPhrase();
                break;
            default:
                logger.error("Could invoke lorem from:", part);
                throw new Error("Unknown lorem invocation: " + part.getTag() + " in " + part.getFilePath());
        }
        return replacement;
    }

    /**
     *
     * @param {Placeholder} part
     * @return {String}
     */
    function hasCountArguments(part) {
        if (part.hasArgs()) {
            const args = part.getArgsObject();
            const hasMin = args.hasOwnProperty("min");
            const hasMax = args.hasOwnProperty("max");
            if (hasMin !== hasMax) {
                throw new Error("min and max attributes must be used together or not at all.  From " + part.getTag() + " in " + part.getFilePath());
            }
            if (hasCount && hasMin) {
                throw new Error("count and min/max attributes are mutually exclusive.  From " + part.getTag() + " in " + part.getFilePath());
            }
            var hasCount = args.hasOwnProperty("count");
            let countArg = hasCount || hasMin || hasMax;
            if (!countArg && args.hasOwnProperty("separator")) {
                throw new Error("separator arg with count or min and max attributes from " + part.getTag() + " in " + part.getFilePath());
            }
            return countArg;
        } else {
            return false;
        }
    }

    /**
     *
     * @param {Placeholder} part
     * @return {String}
     */
    function determineReplacement(part) {
        let replacement;
        if (!part.hasArgs()) {
            replacement = calculateNoArgumentsResult(part);
        } else {
            let count, min, max, separator;
            // let min = undefined, max = undefined;
            // let separator = undefined;
            const argVals = part.getArgsObject();
            if (hasCountArguments(part)) {
                if (argVals.hasOwnProperty("count")) {
                    count = parseInt(argVals.count, 10);
                    if (count != argVals.count) {
                        throw new Error("Illegal count arg :" + count);
                    }
                    //min = -1;
                    //max = -1;
                } else if (argVals.hasOwnProperty("min")) {
                    min = parseInt(argVals.min, 10);
                    max = parseInt(argVals.max, 10);
                    if(min > max) throw new Error("unexepcted min > max in " + part.tag + " in " + part.filepath);
                    count = utils.randomInt(min, max);
                }else{
                    throw new Error("count not set !");
                }
                if(argVals.hasOwnProperty("separator")){
                    separator = utils.unquote(argVals.separator);
                }else{
                    separator =" ";
                }
            } else{
                count = 1;
            }
            //tag, case
            let caseType = "normal";
            if (argVals.hasOwnProperty("case")) {
                switch (utils.unquote(argVals.case).toLowerCase()) {
                    case "upper":
                        caseType = "upper";
                        break;
                    default:
                        throw new Error("Unknown case value for lorem case arg: " + argVals.case + " in " + part.tag + " at " + part.filepath);
                        //break;
                    case "lower":
                        caseType = "lower";
                        break;
                    case "capitalize":
                        caseType = "capitalize";
                        break;
                }
            }

            const loremTag = part.name;

            const partNames = {
                word: 1,
                paragraph: 1,
                phrase: 1
            };
            if(!partNames.hasOwnProperty(loremTag)){
                throw new Error("Unknown lorem tag : " + argVals.case + " in " + part.tag + " at " + part.filepath);
            }

            /**
             *
             * @type {String}
             */
            let tag;// = undefined;
            if(argVals.hasOwnProperty("tag")){
                tag = utils.unquote(argVals.tag);
            }

            replacement = "";

            let minLength;// = undefined;
            if(argVals.hasOwnProperty("minLength")){
                minLength = parseInt(argVals["minLength"], 10);
            }
            let maxLength;// = undefined;
            if(argVals.hasOwnProperty("maxLength")){
                maxLength = parseInt(argVals.maxLength, 10);
            }
            let fn;
            switch (loremTag) {
                case "word":
                    fn = doWord;
                    break;
                case "paragraph":
                    fn = doParagraph;
                    break;
                case "phrase":
                    fn = doPhrase;
                    break;
                default:
                    logger.error("Could invoke lorem from:", part);
                    throw new Error("Unknown lorem invocation " + part.tag + " in " + part.filepath);
            }

            for(let i = 0 ; i < count ; i++){
                if(i > 0){
                    replacement += separator;
                }
                replacement += fn(minLength, maxLength, caseType, tag);
            }
        }
        return replacement;
    }
    return {
        determineReplacement: determineReplacement
    };
}

let lastLines = '';
let lastMod = 0;

/**
 *
 * @param loremPath
 * @param checkInterval
 * @return {{lastModTime: Number, lines: String[]}|Number}
 */
const readLoremLines = function (loremPath, checkInterval) {
    //var loremPath = this.runtime.constructAppPath(["core", "assets", "lorem.txt"]);
    const newModTime = fs.statSync(loremPath).mtime;
    if (lastLines === '' || (newModTime > lastMod) && (lastMod - new Date().getTime() > checkInterval)) {
        const loremTxt = fs.readFileSync(loremPath, 'utf8');
        loremLines = loremTxt.split('\n');
        lastLines = loremLines;
        lastMod = newModTime;
        logger.debug("Read " + loremLines.length + " lines for lorem");

    } else {
        loremLines = lastLines;
    }
    return {
        lastModTime: newModTime,
        lines: loremLines
    };
};


function PlaceholderFactory({runtime}) {
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = runtime;
    this.checkInterval = 5000;
    this.loremLines = [];
    this.lastModTime = 0;
    this.readLoremLines = function () {
        const newLines = readLoremLines(this.runtime.constructAppPath(["core", "assets", "lorem.txt"]), this.checkInterval);
        this.loremLines = newLines.lines;
        this.lastModTime = newLines.lastModTime;
        return this.loremLines;

    };

    /**
     *
     * @param {Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function (part, composed, metadata) {
        this.readLoremLines();
        const t = this;
        const lorem = new Lorem({
            lines: t.loremLines
        });
        const replacement = lorem.determineReplacement(part);
        return part.replacePartContents(composed, replacement);
    };

    /**
     *
     * @param {String} tagName
     * @param {String} fullTag
     * @param {Number} startIdx
     * @param {Number} endIdx
     * @param {String} filepath
     * @return {Placeholder}
     */
    this.parsePlaceholder = function (tagName, fullTag, startIdx, endIdx, filepath) {
        return Placeholder.parsePlaceholder(fullTag, filepath, startIdx, endIdx);
    };
}

module.exports = {
    Lorem: Lorem,
    createFactory: function (args) {
        return new PlaceholderFactory(args);
    }

};