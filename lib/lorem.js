var utils = require("./utils");

function Lorem(args){
    var lines = args.lines;
    if(typeof args !== 'object' || !utils.isArray(lines) || lines.length < 1){
        console.error("Illegal Lorem args, expecting property 'lines' containing array of phrases: ", args);
        throw new Error("illegal args: " + args);
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    function randomIndex() {
        return getRandomInt(0, lines.length -1);
    }

    function paragraph(){
        var minLength = 3;
        var maxLength = 5;
        var length = getRandomInt(minLength, maxLength);
        var out = '';
        for(var idx = 0 ; idx < length ; idx +=1){
            out += phrase();
        }
        return out;
    }
    function phrase(){
        return lines[randomIndex()];
    }
    function word(){
        var minChars = 4;
        var maxChars = 16;

        var p = phrase();
        var w = "";
        var start = 0;
        while(w.length < 1){
            var e = p.indexOf(" ", start);
            //var e = p.indexOf(" ", s+1);
            var m = p.substring(start, e);
            var re = new RegExp("[a-zA-Z]{" + minChars + ","+maxChars+"}", "g");

            if(m.length >= minChars && m.length <= maxChars && re.test(m)){
                w = m;
            }else{
                start = e+1;
            }
        }
        if(w.length < 1){
            throw new Error ("Could not find word of minlength " + minChars + " and max " + maxChars + " in phrase " + p);
        }
        return w;
    }
    function paragraphs(count, separator){
        var sep = separator;
        if(!utils.isString(sep)){
            sep = "<br/>";
        }
        var out= "";
        for(var idx = 0 ; idx < count ; idx+=1){
            if(out.length > 0){
                out+= sep;
            }
            out += paragraph();
        }
        return out;
    }
    function phrases(count, separator){
        var sep = separator;
        if(!utils.isString(sep)){
            sep = " ";
        }
        var out= "";
        for(var idx = 0 ; idx < count ; idx+=1){
            if(out.length > 0){
                out+= sep;
            }
            out += phrase();
        }
        return out;
    }
    function words(count, separator){
        var sep = separator;
        if(!utils.isString(sep)){
            sep = " ";
        }
        var out= "";
        for(var idx = 0 ; idx < count ; idx+=1){
            if(out.length > 0){
                out+= sep;
            }
            out += word();
        }
        return out;
    }

    function createOpenTag(tag){
        return '<' + tag.trim() + '>'
    }
    function createCloseTag(tag){
        var t = tag.trim();

        var si = t.indexOf(' ');
        var o;
        if(si > 0){
            o = t.substring(0, si);
        }else{
            o = t;
        }
        return '</' + o + '>'
    }

    function wordTag(tag){
        return createOpenTag(tag) + word() + createCloseTag(tag);
    }

    function phraseTag(tag){
        return createOpenTag(tag) + phrase() + createCloseTag(tag);
    }

    function paragraphTag(tag){
        return createOpenTag(tag) + paragraph() + createCloseTag(tag);
    }
    function paragraphTags(count, tag){
        var out= "";
        for(var idx = 0 ; idx < count ; idx+=1){
            out += paragraphTag(tag);
        }
        return out;
    }
    function phraseTags(count, tag){
        var out= "";
        for(var idx = 0 ; idx < count ; idx+=1){
            out += phraseTag(tag);
        }
        return out;
    }
    function wordTags(count, tag){
        var out= "";
        for(var idx = 0 ; idx < count ; idx+=1){
            out += wordTag(tag);
        }
        return out;
    }
    function createArgsValsObject(argsArray){
        var o = {};
        for(var i = 0 ; i < argsArray.length ; i+=1){
            var a= argsArray[i];
            var ei = a.indexOf('=');
            var nm = a.substring(0, ei).trim();
            var val = a.substring(ei+1).trim();
            if(val.charAt(0) === "'" || val.charAt(0) === '"'){
                val = val.substring(1, val.length-1).trim();
            }
            o[nm] = val;
        }
        return o;
    }

    function determineReplacement(partName, partArgs){
        var replacement = "";
        var caseType = "lower";


        if(!utils.isDefined(partArgs) || (utils.isArray(partArgs)&& partArgs.length < 1)){
            switch(partName){
                case "word":
                    replacement = word();
                    break;
                case "paragraph":
                    replacement = paragraph();
                    break;
                case "phrase":
                    replacement = phrase();
                    break;
                default:
                    throw new Error("Unknown lorem invocation: " + partName);
            }
        }else{
            //tag, separator, count, min, max
            var argVals = createArgsValsObject(partArgs);

            if(argVals.hasOwnProperty("case")){
                switch(argVals.case){
                    case "upper":
                        caseType = "upper";
                        break;
                    default:
                        console.error("Unknown case value for lorem case arg: ", argVals.case);
                        break;
                    case "lower":
                        caseType = "lower";
                        break;
                    case "capitalize":
                        caseType = "capitalize";
                        break;

                }
            }

            if(argVals.hasOwnProperty("tag")){
                if(argVals.hasOwnProperty("count")){
                    switch(partName){
                        case "word":
                            replacement = wordTags(parseInt(argVals.count,10), argVals.tag);
                            break;
                        case "paragraph":
                            replacement = paragraphTags(parseInt(argVals.count,10), argVals.tag);
                            break;
                        case "phrase":
                            replacement = phraseTags(parseInt(argVals.count,10), argVals.tag);
                            break;
                        default:
                            throw new Error("Unknown lorem invocation: " + partName);
                    }
                }else{
                    if(argVals.hasOwnProperty("min")){
                        var rnd = getRandomInt(parseInt(argVals.min, 10),parseInt(argVals.max, 10));
                        switch(partName){
                            case "word":
                                replacement = wordTags(rnd, argVals.tag);
                                break;
                            case "paragraph":
                                replacement = paragraphTags(rnd, argVals.tag);
                                break;
                            case "phrase":
                                replacement = phraseTags(rnd, argVals.tag);
                                break;
                            default:
                                throw new Error("Unknown lorem invocation: " + partName);
                        }

                    }else{
                        switch(partName){
                            case "word":
                                replacement = wordTag(argVals.tag);
                                break;
                            case "paragraph":
                                replacement = paragraphTag(argVals.tag);
                                break;
                            case "phrase":
                                replacement = phraseTag(argVals.tag);
                                break;
                            default:
                                throw new Error("Unknown lorem invocation: " + partName);
                        }

                    }

                }
            }else{
                if(argVals.hasOwnProperty("separator")){
                    if(argVals.hasOwnProperty("count")){
                        switch(partName){
                            case "word":
                                replacement = words(parseInt(argVals.count,10), argVals.separator);
                                break;
                            case "paragraph":
                                replacement = paragraphs(parseInt(argVals.count,10), argVals.separator);
                                break;
                            case "phrase":
                                replacement = phrases(parseInt(argVals.count,10), argVals.separator);
                                break;
                            default:
                                throw new Error("Unknown lorem invocation: " + partName);
                        }
                    }else{
                        if(argVals.hasOwnProperty("min")) {
                            var rnd = getRandomInt(parseInt(argVals.min, 10), parseInt(argVals.max, 10));
                            switch(partName){
                                case "word":
                                    replacement = words(rnd, argVals.separator);
                                    break;
                                case "paragraph":
                                    replacement = paragraphs(rnd, argVals.separator);
                                    break;
                                case "phrase":
                                    replacement = phrases(rnd, argVals.separator);
                                    break;
                                default:
                                    throw new Error("Unknown lorem invocation: " + partName);
                            }
                        }else{
                            switch(partName){
                                case "word":
                                    replacement = word();
                                    break;
                                case "paragraph":
                                    replacement = paragraph();
                                    break;
                                case "phrase":
                                    replacement = phrase();
                                    break;
                                default:
                                    throw new Error("Unknown lorem invocation: " + partName);
                            }
                        }
                    }
                }else{
                    if(argVals.hasOwnProperty("count")){
                        switch(partName){
                            case "word":
                                replacement = words(parseInt(argVals.count,10));
                                break;
                            case "paragraph":
                                replacement = paragraphs(parseInt(argVals.count,10));
                                break;
                            case "phrase":
                                replacement = phrases(parseInt(argVals.count,10));
                                break;
                            default:
                                throw new Error("Unknown lorem invocation: " + partName);
                        }
                    }else{
                        if(argVals.hasOwnProperty("min")) {
                            var rnd = getRandomInt(parseInt(argVals.min, 10), parseInt(argVals.max, 10));
                            switch(partName){
                                case "word":
                                    replacement = words(rnd);
                                    break;
                                case "paragraph":
                                    replacement = paragraphs(rnd);
                                    break;
                                case "phrase":
                                    replacement = phrases(rnd);
                                    break;
                                default:
                                    throw new Error("Unknown lorem invocation: " + partName);
                            }

                        }else{
                            switch(partName){
                                case "word":
                                    replacement = word();
                                    break;
                                case "paragraph":
                                    replacement = paragraph();
                                    break;
                                case "phrase":
                                    replacement = phrase();
                                    break;
                                default:
                                    throw new Error("Unknown lorem invocation: " + partName);
                            }

                        }
                    }
                }
            }
        }
        if(partName === 'word'){
            switch(caseType){
                case "upper": replacement = replacement.toUpperCase(); break;
                case "lower": replacement = replacement.toLowerCase(); break;
                case "capitalize": replacement = replacement.substring(0, 1).toUpperCase() + replacement.substring(1).toLowerCase(); break;
            }
        }
        return replacement;
    }


    return {
        randomInt: function(min, max){
            return getRandomInt(min, max);
        },
        paragraph: function(){
            return paragraphs(1);
        },
        phrase: function(){
            return phrases(1);
        },
        word: function(){
            return words(1);
        },
        paragraphs: function(count, separator){
            return paragraphs(count, separator);
        },
        phrases: function(count, separator){
            return phrases(count, separator);
        },
        words: function(count, separator){
            return words(count, separator);
        },
        paragraphTag: function(tag){
            return paragraphTag(tag);
        },
        phraseTag: function(tag){
            return phraseTag(tag);
        },
        wordTag: function(tag){
            return wordTag(tag);
        },
        paragraphTags: function(count, tag){
            return paragraphTags(count, tag);
        },
        phraseTags: function(count, tag){
            return phraseTags(count, tag);
        },
        wordTags: function(count, tag){
            return wordTags(count, tag);
        },
        determineReplacement: determineReplacement
    };
}

module.exports = {
    Lorem:Lorem
};