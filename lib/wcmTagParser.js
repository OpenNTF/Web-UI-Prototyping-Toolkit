const utils = require("./utils");

class WcmTagParser {
    constructor() {

    }

    isWcmMarkup(str) {
        return !!WcmTagParser.findWcmTag(str);

    }

    /**
     * @param {String} tag
     * @return {string}
     */
    static extractWcmShortTagName(tag) {
        const spaceIdx = tag.indexOf(' ');
        const closeIdx = tag.indexOf(']');
        let short = '';
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
    }

    /**
     *
     * @param {String} str
     * @return {IbmWcmTag[]}
     */
    collectAllWcmTagsIncludingNested(str) {
        let found = WcmTagParser.findWcmTag(str);
        let all = [];
        while(found){
            all.push(found);
            found = WcmTagParser.findWcmTag(str, found.endIdx);
        }
        console.log("TopLevel tags = " + all.length);
        let checkForNested = [].concat(all);
        const allNested = [];
        while(checkForNested.length > 0){
            const tc = checkForNested.shift();
            if(tc.hasNestedTagsInAttributes()){
                const nta = tc.getNestedTagsInAttributes();
                function processAttribute(attrName){ // jshint ignore:line
                    const nestedAttrTags = nta[attrName];
                    nestedAttrTags.forEach(function(natc){
                        allNested.push(natc);
                        natc.sourceStart = str.indexOf(natc.openTag, tc.startIdx);
                        natc.sourceEnd = natc.sourceStart + natc.fullTag.length;
                    });
                }
                Object.keys(nta).forEach(processAttribute);
            }
            if(tc.hasNestedTagsInBody()){
                const tagsInBody = tc.getNestedTagsInBody();
                checkForNested = checkForNested.concat(tagsInBody);
                tagsInBody.forEach(function(tib){ // jshint ignore:line
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
     * @return {IbmWcmMarkupFragmentInfo}
     */
    createIbmWcmMarkupFragmentInfo(wcmPath, markup) {
        return new IbmWcmMarkupFragmentInfo(wcmPath, markup, this.collectAllWcmTagsIncludingNested(markup));
    }

    /**
     *
     * @param {String} str
     * @return {IbmWcmTag[]}
     */
    static collectWcmTags(str) {
        let found = WcmTagParser.findWcmTag(str);
        const all = [];
        while(found){
            all.push(found);
            found = WcmTagParser.findWcmTag(str, found.endIdx);
        }
        let checkForNested = [].concat(all);
        while(checkForNested.length > 0){
            const tc = checkForNested.shift();
            if(tc.hasNestedTagsInAttributes()){
                const nta = tc.getNestedTagsInAttributes();
                Object.keys(nta).forEach(function(attrName){ // jshint ignore:line
                    const nestedAttrTags = nta[attrName];
                    nestedAttrTags.forEach(function(natc){
                        natc.sourceStart = str.indexOf(natc.openTag, tc.startIdx);
                        natc.sourceEnd = natc.sourceStart + natc.fullTag.length;
                    });
                });
            }
            if(tc.hasNestedTagsInBody()){
                const tagsInBody = tc.getNestedTagsInBody();
                checkForNested = checkForNested.concat(tagsInBody);
                tagsInBody.forEach(function(tib){ // jshint ignore:line
                    tib.sourceStart = str.indexOf(tib.openTag, tc.startIdx);
                    tib.sourceEnd = tib.sourceStart + tib.fullTag.length;

                });
            }
        }
        return all;
    }

    /**
     *
     * @param {String} str
     * @param {Number} [startIdx=0]
     * @return {IbmWcmTag|undefined}
     */
    static findWcmTag(str, startIdx) {
        if(typeof str !== 'string'){
            throw new Error("should have string arg");
        }
        if(str.trim().length < 1){
            return;
        }else{
            if(!startIdx){
                startIdx = 0;
            }
            let out;
            if(startIdx < str.length){
                const openBracketIndex = str.indexOf('[', startIdx);
                const openBracketFound = openBracketIndex >= 0;
                if(openBracketFound && str.length > (openBracketIndex+5)){
                    const nextChar = str.charAt(openBracketIndex + 1);
                    if((/[A-Z]/.test(nextChar))){
                        let closeBracketIdx = str.indexOf(']', openBracketIndex + 1);
                        let opensFound = utils.countOccurrences(str.substring(openBracketIndex, closeBracketIdx + 1), '[');
                        let closesFound = utils.countOccurrences(str.substring(openBracketIndex, closeBracketIdx + 1), ']');
                        if(opensFound !== closesFound){
                            console.log("Found "+opensFound+" opens in " + str.substring(openBracketIndex, closeBracketIdx));
                        }
                        while(opensFound !== closesFound){
                            closeBracketIdx = str.indexOf(']', closeBracketIdx+1);
                            opensFound = utils.countOccurrences(str.substring(openBracketIndex, closeBracketIdx+1), '[');
                            closesFound = utils.countOccurrences(str.substring(openBracketIndex, closeBracketIdx+1), ']');
                        }
                        const openTag = str.substring(openBracketIndex, closeBracketIdx + 1);
                        if(closeBracketIdx > openBracketIndex){
                            const tagIclBrackets = str.substring(openBracketIndex, closeBracketIdx + 1);


                            let fullTag = tagIclBrackets;


                            const shortName = this.extractWcmShortTagName(tagIclBrackets);
                            const crit = '[/' + shortName;
                            const closeTagOpenIdx = str.indexOf(crit, closeBracketIdx);
                            if(closeTagOpenIdx > closeBracketIdx){
                                const realClose = str.indexOf(']', closeTagOpenIdx);
                                if(realClose > closeTagOpenIdx){
                                    fullTag = str.substring(openBracketIndex, realClose+1);
                                    out = new IbmWcmTag(shortName,  openBracketIndex, realClose+1, fullTag, openTag);

                                }else{
                                    out = new IbmWcmTag(shortName,  openBracketIndex, closeBracketIdx, fullTag, openTag);
                                }
                            }else{
                                out = new IbmWcmTag(shortName,  openBracketIndex, closeBracketIdx, fullTag, openTag);
                            }
                        }
                    }

                }
            }
            return out;
        }
    }
}

class IbmWcmMarkupFragmentInfo {
    /**
     *
     * @param {String} wcmPath
     * @param {String} markup
     * @param {IbmWcmTag[]} tags
     * @constructor
     */
    constructor(wcmPath, markup, tags) {
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
    }

    getTopLevelTags() {
        const topLevel = [].concat(this.tags.filter(function (t) {
            return !t.isNested();
        }));
        topLevel.sort(function(a,b){
            return a.startIdx - b.startIdx;
        });
        return topLevel;

    }

    getAllTags() {
        const topLevel = [].concat(this.tags);
        topLevel.sort(function(a,b){
            let an = a.isNested();
            let bn = b.isNested();
            if(an && !bn){
                return a.sourceStart - b.startIdx;
                //return 1;
            }else if(!an && bn ){
                return a.startIdx - b.sourceStart;
                //return -1;
            }

            if(an){
                const o = a.sourceStart - b.sourceStart;
                if(o !== 0){
                    return o;
                }
                return -1*(a.sourceEnd - b.sourceEnd);
            }else{
                const d = a.startIdx - b.startIdx;
                if(d !== 0) return d;
                return -1*(a.endIdx - b.endIdx);
            }
        });
        return topLevel;
    }
}

class IbmWcmTag {
    /**
     *
     * @param {String} name
     * @param {Number} startIdx
     * @param {Number} endIdx
     * @param {String} fullTag
     * @param {String} openTag
     * @param {String} [originType]
     * @param {Number} [originStart]
     * @param {Number} [originEnd]
     * @constructor
     */
    constructor(name, startIdx, endIdx, fullTag, openTag, originType, originStart, originEnd) {
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


    }

    /**
     *
     * @return {boolean}
     */
    isNested() {
        return typeof this.originType === 'string';
    }

    /**
     *
     * @return {boolean}
     */
    hasBody() {
        return this.fullTag.indexOf('[/'+this.name) > 0;
    }

    /**
     *
     * @return {string}
     */
    getBody() {
        if(!this.hasBody()) throw new Error("has no body: " + this.fullTag);
        const openIdx = this.fullTag.indexOf(this.openTag);
        const bodyStart = openIdx + this.openTag.length;
        const afterBody = this.fullTag.lastIndexOf('[/' + this.name);
        return this.fullTag.substring(bodyStart, afterBody);
    }

    /**
     *
     * @return {boolean}
     */
    hasAttributes() {
        const spaceIdx = this.openTag.indexOf(' ');
        const eqIdx = this.openTag.indexOf('=');
        return spaceIdx > 0 && eqIdx > spaceIdx;
    }

    /**
     *
     * @return {boolean}
     */
    hasNestedTagsInAttributes() {
        if(this.hasAttributes()){
            const at = this.getAttributes();
            for(let an in at){
                if(WcmTagParser.findWcmTag(at[an])){
                    return true;
                }
            }
        }

        return false;
    }

    /**
     *
     * @return {boolean}
     */
    hasNestedTagsInBody() {
        return this.hasBody() && !!WcmTagParser.findWcmTag(this.getBody());

    }

    /**
     * @param {String} attrName
     * @return {boolean}
     */
    hasAttribute(attrName) {
        return this.hasAttributes() && this.getAttributeNames().indexOf(attrName) >=0;
    }

    /**
     *
     * @return {Object.<String, IbmWcmTag[]>}
     */
    getNestedTagsInAttributes() {
        const n = {};
        if (this.hasAttributes()) {
            const at = this.getAttributes();
            Object.keys(at).forEach(an =>{
                const nt = WcmTagParser.collectWcmTags(at[an]);
                if (nt.length) {
                    n[an] = nt;
                    nt.forEach(t =>{
                        t.originType = "attr:" + an;
                        t.originStart = at[an].indexOf(t.openTag);
                        t.originEnd = t.originStart + t.fullTag.length;
                    });
                }
            });
        }
        return n;
    }

    /**
     *
     * @return {IbmWcmTag[]}
     */
    getNestedTagsInBody() {
        let o;
        if (this.hasBody()) {
            const tb = this.getBody();
            const nt = WcmTagParser.collectWcmTags(tb);
            nt.forEach(function (t) {
                t.originType = "body";
                t.originStart = tb.indexOf(t.openTag);
                t.originEnd = t.originStart + t.fullTag.length;
                console.log("nested tag = " + tb.substring(t.originStart, t.originEnd));
            });
            o = nt;
        } else {
            o = [];
        }
        return o;
    }

    /**
     *
     * @return {IbmWcmTag[]}
     */
    getAllNestedTags() {
        let bodyTags = this.getNestedTagsInBody();
        const atTags = this.getNestedTagsInAttributes();
        Object.keys(atTags).forEach(an =>{
            bodyTags = bodyTags.concat(atTags[an]);
        });
        return bodyTags;
    }

    /**
     * @return {string}
     */
    getAttributeQuoteChar() {
        if(!this.hasAttributes()) throw new Error("has no attrs");
        return this.openTag.charAt(this.openTag.indexOf('=')+1);
    }

    /**
     * @return {string}
     */
    getOriginType() {
        if(!this.isNested()) throw new Error("not nested");
        return this.originType;
    }

    /**
     * @return {Number}
     */
    getOriginStart() {
        if(!this.isNested()) throw new Error("not nested");
        return this.originStart;
    }

    /**
     * @return {Number}
     */
    getOriginEnd() {
        if(!this.isNested()) throw new Error("not nested");
        return this.originEnd;
    }

    /**
     * @return {string}
     */
    getNestedAttributeQuoteChar() {
        const qc = this.getAttributeQuoteChar();
        return qc === '"' ? '\'' : '"';
    }

    /**
     *
     * @return {String[]}
     */
    getAttributeNames() {
        const qc = this.getAttributeQuoteChar();
        const q = new RegExp(' [a-zA-Z-_]+=' + qc, 'g');
        return (this.openTag.match(q) || []).map(function(h){
            return h.substring(1, h.indexOf('='));
        });
    }

    /**
     *
     * @return {Object.<String,String>}
     */
    getAttributes() {
        const attributeNames = this.getAttributeNames();
        const m = {};
        attributeNames.forEach(an =>{
            const attrStartQuery = an + '=' + this.getAttributeQuoteChar();
            const attrStart = this.openTag.indexOf(attrStartQuery);
            const closeIdx = this.openTag.indexOf(this.getAttributeQuoteChar(), attrStart + attrStartQuery.length);
            m[an] = this.openTag.substring(attrStart+attrStartQuery.length, closeIdx);
        });

        return m;
    }
}


module.exports = WcmTagParser;