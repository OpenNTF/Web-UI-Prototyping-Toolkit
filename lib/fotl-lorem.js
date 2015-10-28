var utils = require("./utils");
var fs = require("fs");
var Placeholder = utils.Placeholder;

var logger = utils.createLogger({sourceFilePath: __filename});

var loremLines = [];


/**
 *
 * @param {{lines:String[]}}args
 * @return {{determineReplacement: determineReplacement}}
 * @constructor
 */
function Lorem(args) {
    var lines = args.lines.filter(function(l){
        return l.trim().length > 0;
    }).map(function(l){
        var trim = l.trim();return trim.replace(/[ ]{2,}/g,' ');
    });
    var phrases = [];
    lines.forEach(function(l){
        var tp = l.split(".");
        tp.forEach(function(p){
            var phrase = p.trim();
            if(phrase.length > 0){
                phrases.push(phrase);
            }
        })
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
        var p;
        if(typeof minLength === 'number'){
            var shuffledPhrases = utils.shuffleArray([].concat(phrases));
            var w = "";
            var shortest = 10000;
            for(var i = 0 ; w.length < 1 && i < shuffledPhrases.length ; i++){
                var l = shuffledPhrases[i];
                var phWords = l.split(" ");
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
        var count;
        if(typeof minLength === 'number'){
            count = utils.randomInt(minLength, maxLength);
        }else{
            count = 3;
        }
        var out = '';
        for (var idx = 0; idx < count; idx += 1) {
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
        var shuffledLines = utils.shuffleArray([].concat(lines));
        var w = "";
        var wordRegexp = new RegExp("[a-zA-Z]{" + minChars + "," + maxChars + "}", "g");
        for(var i = 0 ; w.length < 1 && i < shuffledLines.length ; i++){
            var p = shuffledLines[i];
            var start = 0;
            while (w.length < 1) {
                var e = p.indexOf(" ", start);
                var m = p.substring(start, e);
                if (m.length >= minChars && m.length <= maxChars && wordRegexp.test(m)) {
                    w = m;
                } else {
                    start = e + 1;
                }
            }
        }
        if (w.length < 1) {
            throw new Error("Could not find word of minlength " + minChars + " and max " + maxChars + " in phrase " + p);
        }
        w = applyCase(w, caseType);
        w = applyTag(w, tag);

        return w;
    }

    function applyTag(str, tag){
        var w = str;
        if(typeof tag === 'string'){
            w = createOpenTag(tag) + str + createCloseTag(tag);
        }
        return w;
    }

    function applyCase(str, caseType){
        var w = str;
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
        return '<' + tag.trim() + '>'
    }

    function createCloseTag(tag) {
        var t = tag.trim();
        var si = t.indexOf(' ');
        var o;
        if (si > 0) {
            o = t.substring(0, si);
        } else {
            o = t;
        }
        return '</' + o + '>'
    }

    /**
     *
     * @param {utils.Placeholder} part
     * @return {String}
     */
    function calculateNoArgumentsResult(part) {
        var replacement;
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
                console.error("Could invoke lorem from:", part);
                throw new Error("Unknown lorem invocation: " + part.getTag() + " in " + part.getFilePath());
        }
        return replacement;
    }

    /**
     *
     * @param {utils.Placeholder} part
     * @return {String}
     */
    function hasCountArguments(part) {
        if (part.hasArgs()) {
            var args = part.getArgsObject();
            var hasMin = args.hasOwnProperty("min");
            var hasMax = args.hasOwnProperty("max");
            if (hasMin !== hasMax) {
                throw new Error("min and max attributes must be used together or not at all.  From " + part.getTag() + " in " + part.getFilePath());
            }
            if (hasCount && hasMin) {
                throw new Error("count and min/max attributes are mutually exclusive.  From " + part.getTag() + " in " + part.getFilePath());
            }
            var hasCount = args.hasOwnProperty("count");
            var countArg = hasCount || hasMin || hasMax;
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
     * @param {utils.Placeholder} part
     * @return {String}
     */
    function determineReplacement(part) {
        var replacement;
        if (!part.hasArgs()) {
            replacement = calculateNoArgumentsResult(part);
        } else {
            var count= undefined;
            var min= undefined,max= undefined;
            var separator= undefined;
            var argVals = part.getArgsObject();
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
                    if(min > max) throw new Error("unexepcted min > max in " + part.getTag() + " in " + part.getFilePath());
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
            var caseType = "normal";
            if (argVals.hasOwnProperty("case")) {
                switch (utils.unquote(argVals.case).toLowerCase()) {
                    case "upper":
                        caseType = "upper";
                        break;
                    default:
                        throw new Error("Unknown case value for lorem case arg: " + argVals.case + " in " + part.getTag() + " at " + part.getFilePath());
                        //break;
                    case "lower":
                        caseType = "lower";
                        break;
                    case "capitalize":
                        caseType = "capitalize";
                        break;
                }
            }

            var loremTag = part.getName();

            var partNames = {
                word:1,
                paragraph:1,
                phrase:1
            };
            if(!partNames.hasOwnProperty(loremTag)){
                throw new Error("Unknown lorem tag : " + argVals.case + " in " + part.getTag() + " at " + part.getFilePath());
            }

            /**
             *
             * @type {String}
             */
            var tag = undefined;
            if(argVals.hasOwnProperty("tag")){
                tag = utils.unquote(argVals.tag);
            }

            replacement = "";

            var minLength = undefined;
            if(argVals.hasOwnProperty("minLength")){
                minLength = parseInt(argVals["minLength"], 10);
            }
            var maxLength = undefined;
            if(argVals.hasOwnProperty("maxLength")){
                maxLength = parseInt(argVals.maxLength, 10);
            }
            var fn;
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
                    console.error("Could invoke lorem from:", part)
                    throw new Error("Unknown lorem invocation " + part.getTag() + " in " + part.getFilePath());
            }

            for(var i = 0 ; i < count ; i++){
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

var lastLines = '';
var lastMod = 0;

/**
 *
 * @param loremPath
 * @param checkInterval
 * @return {{lastModTime: Number, lines: String[]}|Number}
 */
var readLoremLines = function (loremPath, checkInterval) {
    //var loremPath = this.runtime.constructAppPath(["core", "assets", "lorem.txt"]);
    var newModTime = fs.statSync(loremPath).mtime;
    if (lastLines === '' || (newModTime > lastMod) && (lastMod - new Date().getTime() > checkInterval)) {
        var loremTxt = fs.readFileSync(loremPath, 'utf8');
        loremLines = loremTxt.split('\n');
        lastLines = loremLines;
        lastMod = newModTime;
        console.log("Read " + loremLines.length + " lines for lorem");

    }else{
        loremLines = lastLines;
    }
    return {
        lastModTime : newModTime,
        lines: loremLines
    };
};


function PlaceholderFactory(args) {
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = args.runtime;
    this.checkInterval = 5000;
    this.loremLines = [];
    this.lastModTime = 0;
    this.readLoremLines = function () {
        var newLines = readLoremLines(this.runtime.constructAppPath(["core", "assets", "lorem.txt"]), this.checkInterval);
        this.loremLines = newLines.lines;
        this.lastModTime = newLines.lastModTime;
        return this.loremLines;

    };

    /**
     *
     * @param {utils.Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */
    this.applyPlaceholder = function (part, composed, metadata) {
        this.readLoremLines();
        var t = this;
        var lorem = new Lorem({
            lines: t.loremLines
        });
        var replacement = lorem.determineReplacement(part);
        return part.replacePartContents(composed, replacement);
    };

    /**
     *
     * @param {String} tagName
     * @param {String} fullTag
     * @param {Number} startIdx
     * @param {Number} endIdx
     * @param {String} filepath
     * @return {utils.Placeholder}
     */
    this.parsePlaceholder = function (tagName, fullTag, startIdx, endIdx, filepath) {
        var ph = utils.parsePlaceholder(fullTag, filepath, startIdx, endIdx);
        return ph;
    }
}

module.exports = {
    Lorem: Lorem,
    createFactory: function (args) {
        return new PlaceholderFactory(args);
    }

};