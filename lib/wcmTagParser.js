var utils = require("./utils");

var wcmTagParser = module.exports;

/**
 *
 * @param {String} wcmPath
 * @param {String} markup
 * @param {wcmTagParser.IbmWcmTag[]} tags
 * @constructor
 */
wcmTagParser.IbmWcmMarkupFragmentInfo = function(wcmPath, markup, tags){
    this.wcmPath = wcmPath;
    this.markup = markup;
    this.tags = tags;
    this.tags.forEach(function(t){
        if(t.hasAttributes()){
            t.attributes = t.getAttributes();
            if(t.hasNestedTagsInAttributes()){
                this.tagsInAttributes = t.getNestedTagsInAttributes();
            }
        }
        if(t.hasBody() && t.hasNestedTagsInBody()){
            this.tagsInBody = t.getNestedTagsInBody();
        }
    });
};

wcmTagParser.IbmWcmMarkupFragmentInfo.prototype.getTopLevelTags = function(){
    var topLevel = [].concat(this.tags.filter(function(t){return !t.isNested();}));
    topLevel.sort(function(a,b){
        return a.startIdx - b.startIdx;
    });
    return topLevel;

};
wcmTagParser.IbmWcmMarkupFragmentInfo.prototype.getAllTags = function(){
    var topLevel = [].concat(this.tags);
    topLevel.sort(function(a,b){
        var an = a.isNested();
        var bn = b.isNested();
        if(an && !bn){
            return a.sourceStart - b.startIdx;
            //return 1;
        }else if(!an && bn ){
            return a.startIdx - b.sourceStart;
            //return -1;
        }

        if(an){
            var o = a.sourceStart - b.sourceStart;
            if(o !== 0){
                return o;
            }
            return -1*(a.sourceEnd - b.sourceEnd);
        }else{
            var o = a.startIdx - b.startIdx;
            if(o !== 0) return o;
            return -1*(a.endIdx - b.endIdx);
        }


        //var an = a.isNested();
        //var bn = b.isNested();
        //if(an && !bn){
        //    return 1;
        //}else if(!an && bn ){
        //    return -1;
        //}else{
        //    var o =a.startIdx - b.startIdx;
        //    if(o !== 0) return o;
        //    return -1*(a.fullTag.length - b.fullTag.length);
        //}

    });
    return topLevel;
};

wcmTagParser.isWcmMarkup = function(str){
    if(wcmTagParser.findWcmTag(str)){
        return true;
    }
    return false;
};

/**
 *
 * @param {String} name
 * @param {Number} startIdx
 * @param {Number} endIdx
 * @param {String} fullTag
 * @param {String} openTag
 * @param {String} [originType]
 * @param {Number} [originStartIdx]
 * @param {Number} [originEndIdx]
 * @constructor
 */
wcmTagParser.IbmWcmTag = function(name, startIdx, endIdx, fullTag, openTag, originType, originStart, originEnd){
    if(fullTag.indexOf('[/') === 0) throw new Error("Cannot save closing tag : fulltag = " + fullTag);

    if(originStart === 1) throw new Error("nested cannot have startidx in origin at 1");
    /**
     *
     * @type {String}
     */
    this.name = name;

    /**
     *
     * @type {Number}
     */
    this.startIdx = startIdx;
    /**
     *
     * @type {Number}
     */
    this.endIdx= endIdx;
    /**
     *
     * @type {String}
     */
    this.fullTag = fullTag;
    /**
     *
     * @type {String}
     */
    this.openTag = openTag;
    /**
     *
     * @type {String}
     */
    this.originType = originType;
    /**
     *
     * @type {Number}
     */
    this.originStart = originStart;
    /**
     *
     * @type {Number}
     */
    this.originEnd = originEnd;


};

/**
 *
 * @return {boolean}
 */
wcmTagParser.IbmWcmTag.prototype.isNested = function(){
    return typeof this.originType === 'string';
};

/**
 *
 * @return {boolean}
 */
wcmTagParser.IbmWcmTag.prototype.hasBody = function(){
    return this.fullTag.indexOf('[/'+this.name) > 0;
};

/**
 *
 * @return {string}
 */
wcmTagParser.IbmWcmTag.prototype.getBody = function(){
    if(!this.hasBody()) throw new Error("has no body: " + this.fullTag);
    var openIdx = this.fullTag.indexOf(this.openTag);
    var bodyStart = openIdx+this.openTag.length;
    var afterBody = this.fullTag.lastIndexOf('[/' + this.name);
    return this.fullTag.substring(bodyStart, afterBody);
};

/**
 *
 * @return {boolean}
 */
wcmTagParser.IbmWcmTag.prototype.hasAttributes = function(){
    var spaceIdx = this.openTag.indexOf(' ');
    var eqIdx = this.openTag.indexOf('=');
    return spaceIdx > 0 && eqIdx > spaceIdx;
};
/**
 *
 * @return {boolean}
 */
wcmTagParser.IbmWcmTag.prototype.hasNestedTagsInAttributes = function(){
    if(this.hasAttributes()){
        var at= this.getAttributes();
        for(var an in at){
            if(wcmTagParser.findWcmTag(at[an])){
                return true;
            }
        }
    }

    return false;
};
/**
 *
 * @return {boolean}
 */
wcmTagParser.IbmWcmTag.prototype.hasNestedTagsInBody = function(){
    if(this.hasBody() && wcmTagParser.findWcmTag(this.getBody())){
        return true;
    }
    return false;
};
/**
 * @param {String} attrName
 * @return {boolean}
 */
wcmTagParser.IbmWcmTag.prototype.hasAttribute = function(attrName){
    return this.hasAttributes() && this.getAttributeNames().indexOf(attrName) >=0;
};

/**
 *
 * @return {Object.<String, wcmTagParser.IbmWcmTag[]>}
 */
wcmTagParser.IbmWcmTag.prototype.getNestedTagsInAttributes = function(){
    var n = {};
    if(!this.hasAttributes())
        return n;

    var at= this.getAttributes();
    for(var an in at){
        var nt = wcmTagParser.collectWcmTags(at[an]);
        if(nt.length){
            n[an] = nt;
            nt.forEach(function(t){
                t.originType = "attr:"+an;
                t.originStart = at[an].indexOf(t.openTag);
                t.originEnd = t.originStart + t.fullTag.length;
            })
        }
    }
    return n;
};
/**
 *
 * @return {wcmTagParser.IbmWcmTag[]}
 */
wcmTagParser.IbmWcmTag.prototype.getNestedTagsInBody = function(){
    if(!this.hasBody()) return [];
    var tb = this.getBody();
    var nt = wcmTagParser.collectWcmTags(tb);
    nt.forEach(function(t){
        t.originType = "body";
        t.originStart = tb.indexOf(t.openTag);
        t.originEnd = t.originStart + t.fullTag.length;
        console.log("nested tag = " + tb.substring(t.originStart, t.originEnd));
    });
    return nt;
};

/**
 *
 * @return {wcmTagParser.IbmWcmTag[]}
 */
wcmTagParser.IbmWcmTag.prototype.getAllNestedTags = function(){
    var bodyTags = this.getNestedTagsInBody();
    var atTags = this.getNestedTagsInAttributes();
    for(var an in atTags){
        bodyTags = bodyTags.concat(atTags[an]);
    }
    return bodyTags;
};

/**
 * @return {string}
 */
wcmTagParser.IbmWcmTag.prototype.getAttributeQuoteChar = function(){
    if(!this.hasAttributes()) throw new Error("has no attrs");
    return this.openTag.charAt(this.openTag.indexOf('=')+1);
};

/**
 * @return {string}
 */
wcmTagParser.IbmWcmTag.prototype.getOriginType = function(){
    if(!this.isNested()) throw new Error("not nested");
    return this.originType;
};

/**
 * @return {Number}
 */
wcmTagParser.IbmWcmTag.prototype.getOriginStart = function(){
    if(!this.isNested()) throw new Error("not nested");
    return this.originStart;
};

/**
 * @return {Number}
 */
wcmTagParser.IbmWcmTag.prototype.getOriginEnd = function(){
    if(!this.isNested()) throw new Error("not nested");
    return this.originEnd;
};

/**
 * @return {string}
 */
wcmTagParser.IbmWcmTag.prototype.getNestedAttributeQuoteChar = function(){
    var qc = this.getAttributeQuoteChar();
    return qc === '"' ? '\'' : '"';
};

/**
 *
 * @return {String[]}
 */
wcmTagParser.IbmWcmTag.prototype.getAttributeNames = function(){
    var qc = this.getAttributeQuoteChar();
    var q = / [a-zA-Z-_]+='/;
    q = new RegExp(' [a-zA-Z-_]+=' + qc, 'g');
    return (this.openTag.match(q) || []).map(function(h){
        return h.substring(1, h.indexOf('='));
    });
};
/**
 *
 * @return {Object.<String,String>}
 */
wcmTagParser.IbmWcmTag.prototype.getAttributes = function(){
    var attributeNames = this.getAttributeNames();
    var m = {};
    var ot = this.openTag;
    var qc = this.getAttributeQuoteChar();
    attributeNames.forEach(function(an){
        var attrStartQuery = an + '=' + qc;
        var attrStart = ot.indexOf(attrStartQuery);
        var closeIdx = ot.indexOf(qc, attrStart + attrStartQuery.length);
        m[an] = ot.substring(attrStart+attrStartQuery.length, closeIdx);
    });

    return m;
};

/**
 * @param {String} tag
 * @return {string}
 */
wcmTagParser.extractWcmShortTagName = function(tag){
    var spaceIdx = tag.indexOf(' ');
    var closeIdx = tag.indexOf(']');
    var short = '';
    if(spaceIdx > 0 && closeIdx > 0){
        short = tag.substring(1, Math.min(spaceIdx, closeIdx));
    }else if(spaceIdx >0){
        short = tag.substring(1, spaceIdx);
    }else if(closeIdx>0){
        short = tag.substring(1, closeIdx);
    }else{
        throw new Error("could not extract short name from : " + tag);
    }
    if(short.charAt(0) ==='/') throw new Error("Invalid: " + tag + "=>" + short);
    return short;
};

/**
 *
 * @param {String} str
 * @return {wcmTagParser.IbmWcmTag[]}
 */
wcmTagParser.collectAllWcmTagsIncludingNested = function(str){
    var found = wcmTagParser.findWcmTag(str);
    var all = [];
    while(found){
        all.push(found);
        found = wcmTagParser.findWcmTag(str, found.endIdx);
    }
    console.log("TopLevel tags = " + all.length);
    var checkForNested = [].concat(all);
    var allNested = [];
    while(checkForNested.length > 0){
        var tc = checkForNested.shift();
        if(tc.hasNestedTagsInAttributes()){
            var nta = tc.getNestedTagsInAttributes();
            Object.keys(nta).forEach(function(attrName){
                var nestedAttrTags = nta[attrName];
                nestedAttrTags.forEach(function(natc){
                    allNested.push(natc);
                    natc.sourceStart = str.indexOf(natc.openTag, tc.startIdx);
                    natc.sourceEnd = natc.sourceStart + natc.fullTag.length;
                })
            });
        }
        if(tc.hasNestedTagsInBody()){
            var tagsInBody = tc.getNestedTagsInBody();
            checkForNested = checkForNested.concat(tagsInBody);
            tagsInBody.forEach(function(tib){
                allNested.push(tib);
                tib.sourceStart = str.indexOf(tib.openTag, tc.startIdx);
                tib.sourceEnd = tib.sourceStart + tib.fullTag.length;
            });
        }
    }
    all = all.concat(allNested);
    return all;
}

/**
 *
 * @param {String} wcmPath
 * @param {String} markup
 * @return {wcmTagParser.IbmWcmMarkupFragmentInfo}
 */
wcmTagParser.createIbmWcmMarkupFragmentInfo = function(wcmPath, markup){
    return new wcmTagParser.IbmWcmMarkupFragmentInfo(wcmPath, markup, wcmTagParser.collectAllWcmTagsIncludingNested(markup));
}

/**
 *
 * @param {String} str
 * @return {wcmTagParser.IbmWcmTag[]}
 */
wcmTagParser.collectWcmTags = function(str){
    var found = wcmTagParser.findWcmTag(str);
    var all = [];
    while(found){
        all.push(found);
        found = wcmTagParser.findWcmTag(str, found.endIdx);
    }
    var checkForNested = [].concat(all);
    while(checkForNested.length > 0){
        var tc = checkForNested.shift();
        if(tc.hasNestedTagsInAttributes()){
            var nta = tc.getNestedTagsInAttributes();
            Object.keys(nta).forEach(function(attrName){
                var nestedAttrTags = nta[attrName];
                nestedAttrTags.forEach(function(natc){
                    natc.sourceStart = str.indexOf(natc.openTag, tc.startIdx);
                    natc.sourceEnd = natc.sourceStart + natc.fullTag.length;
                })
            });
        }
        if(tc.hasNestedTagsInBody()){
            var tagsInBody = tc.getNestedTagsInBody();
            checkForNested = checkForNested.concat(tagsInBody);
            tagsInBody.forEach(function(tib){
                tib.sourceStart = str.indexOf(tib.openTag, tc.startIdx);
                tib.sourceEnd = tib.sourceStart + tib.fullTag.length;

            })
        }
    }
    return all;
};


/**
 *
 * @param {String} str
 * @param {Number} [startIdx=0]
 * @return {wcmTagParser.IbmWcmTag}
 */
wcmTagParser.findWcmTag = function(str, startIdx){
    if(typeof str !== 'string'){
        throw new Error("should have string arg")
    }
    if(str.trim().length < 1){
        return;
    }
    if(!startIdx){
        startIdx = 0;
    }
    var out;
    if(startIdx < str.length){
        var openBracketIndex = str.indexOf('[', startIdx);

        var openBracketFound = openBracketIndex >= 0;
        if(openBracketFound){
            var closeBracketIdx = str.indexOf(']', openBracketIndex+1);
            var opensFound = utils.countOccurrences(str.substring(openBracketIndex, closeBracketIdx+1), '[');
            var closesFound = utils.countOccurrences(str.substring(openBracketIndex, closeBracketIdx+1), ']');
            if(opensFound !== closesFound){
                console.log("Found "+opensFound+" opens in " + str.substring(openBracketIndex, closeBracketIdx));
            }
            while(opensFound !== closesFound){
                closeBracketIdx = str.indexOf(']', closeBracketIdx+1);
                opensFound = utils.countOccurrences(str.substring(openBracketIndex, closeBracketIdx+1), '[');
                closesFound = utils.countOccurrences(str.substring(openBracketIndex, closeBracketIdx+1), ']');
            }
            var openTag = str.substring(openBracketIndex, closeBracketIdx+1);
            if(closeBracketIdx > openBracketIndex){
                var tagIclBrackets = str.substring(openBracketIndex, closeBracketIdx + 1);


                var fullTag = tagIclBrackets;


                var shortName= wcmTagParser.extractWcmShortTagName(tagIclBrackets);
                var crit = '[/' + shortName;
                var closeTagOpenIdx = str.indexOf(crit, closeBracketIdx);
                if(closeTagOpenIdx > closeBracketIdx){
                    var realClose = str.indexOf(']', closeTagOpenIdx);
                    if(realClose > closeTagOpenIdx){
                        fullTag = str.substring(openBracketIndex, realClose+1);
                        out = new wcmTagParser.IbmWcmTag(shortName,  openBracketIndex, realClose+1, fullTag, openTag);

                    }else{
                        out = new wcmTagParser.IbmWcmTag(shortName,  openBracketIndex, closeBracketIdx, fullTag, openTag);
                    }
                }else{
                    out = new wcmTagParser.IbmWcmTag(shortName,  openBracketIndex, closeBracketIdx, fullTag, openTag);
                }
            }
        }
    }
    return out;
};
