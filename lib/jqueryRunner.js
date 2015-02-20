/**
 * Copyright 2014 IBM Corp.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var jsdom;
var cheerio;
var utils = require('./utils');
var fs = require('fs');
var path = require('path');
var logger = utils.createLogger({sourceFilePath : __filename});
try{
    jsdom = require('jsdom');
    logger.info("jsdom node module is installed, will attempt to use fullblown jQuery serverside (make sure the jquery node module is installed as well)");
}catch(jsdomErr){
    logger.info("jsdom node module is not installed, reverting to cheerio");
    cheerio = require("cheerio");
}







var windowIndex = 0;

var runJQueryFunction;
if(jsdom) {
    /**
     * Runs a serverside JQuery function to eg. process/modify the html
     * @param html used to populate the window (aka the html to operate on with JQuery)
     * @param jqueryFunction the actual JQuery function($, window){}, will be executed async
     * @param callback the callback to run after the JQuery function has finished: function(result, errors, window){}
     * @param otherFnArg this will be passed to the JQUery function as 3rd argument after $ and window.
     * An example invocation could be
     * runJQUeryFunction('<html><body>yourmarkup</body></html>', function($, window, otherArg){$(otherArg['tag']).text('changed markup');}, function(resultingMarkup, errors, window){console.log('done');}, {"tag" : "body"});
     * The jquery function gets the passed other argument and returns the modified markup to the callback.
     */
    runJQueryFunction = function (html, jqueryFunction, callback, otherFnArg) {
        windowIndex += 1;
        jsdom.env({
            html: html, done: function (errors, window) {
                try {
                    var $ = require("jquery")(window);
                    try {
                        var result = utils.isDefined(otherFnArg) ? jqueryFunction($, window, otherFnArg) : jqueryFunction($, window);
                        callback(result, errors, window);
                    } finally {
                        window.close();
                    }
                } catch (err) {
                    console.error("Could not create jquery instance");
                    console.trace(err);
                    callback(html, err);
                }
            }
        });
    };
}

var runCheerioFunction;
if(!jsdom){
    runCheerioFunction = function(html, jqueryFunction, callback, otherFnArg) {
        //windowIndex += 1;
        var NoWindowHere = -1;
        var window = NoWindowHere;
        try{
            var $ = cheerio.load(html);
            try {
                var result = utils.isDefined(otherFnArg) ? jqueryFunction($, window, otherFnArg) : jqueryFunction($, window);
                callback(result, undefined, window);
            } finally {
                //window.close();
            }
        }catch(err){
            console.error("Could not create jquery instance");
            console.trace(err);
            callback(html, err);
        }
    };
    runJQueryFunction = runCheerioFunction;
}


var ensureViewScriptsPresent = function($){
    /*
     <script src="/ps/ext/jquery/dist/jquery.js" data-backend-only></script>
     <script src="/ps/ext/Keypress/keypress.js" data-backend-only></script>
     <script src="/ps/ext/ckeditor/ckeditor.js" data-backend-only></script>
     <script src="/ps/assets/views.js" data-backend-only></script>
     */
    var jq=false,kp=false,ck=false,vw=false;
    $('script[src]').each(function(){
        var st = $(this);
        var src = st.attr('src');
        var lastSlash = src.lastIndexOf('/');
        var name = src;
        if(lastSlash>=0){
            name = src.substring(lastSlash+1);
        }
        if(src === '/ps/assets/views.js'){
            vw = true;
        }else if(name === 'ckeditor.js' || name === 'ckeditor.min.js'){
            ck = true;
        }else if(name === 'keypress.js' || (utils.startsWith(name, 'keypress-') && utils.endsWith(name, '.js'))){
            kp = true;
        }else if(name === 'jquery.js' || name === 'jquery.min.js' || (utils.startsWith(name, 'jquery') && utils.endsWith(name, '.js'))){
            jq = true;
        }
    });
    if(!jq){
        $('body').append('<script src="/ps/ext/jquery/dist/jquery.js" data-backend-only></script>');
    }
    if(!kp){
        $('body').append('<script src="/ps/ext/Keypress/keypress.js" data-backend-only></script>');
    }
    if(!ck){
        $('body').append('<script src="/ps/ext/ckeditor/ckeditor.js" data-backend-only></script>');
    }
    if(!vw){
        $('body').append('<script src="/ps/assets/views.js" data-backend-only></script>');
    }
};

var assignUniqueIdsToEditables = function($){
    var ids = {};
    var generatedIdName = "psGenId";
    $("*[data-editable]").each(function () {
        var id = $(this).attr("id");
        if (!(typeof id === 'string' && id.length > 0)) {
            id = generatedIdName;
        }
        var maxIdx;
        if (ids.hasOwnProperty(id)) {
            maxIdx = ids[id];
        } else {
            maxIdx = -1;
        }
        var newIdx = maxIdx + 1;
        ids[id] = newIdx;
        var newId = id + "_" + newIdx;
        $(this).attr("id", newId);
    });
};

var removeMarkupIgnoredForBuild = function($){
    $("*[data-backend-only]").each(function () {
        $(this).replaceWith("");
    });
};

//var determineProtostarAttributeValue = function(attrName, attrValue, runtime, prefix){
//    var origVal = attrValue;
//    var val = origVal.substring(3);
//    logger.info("Processing : " + val);
//    var newVal;
//    if(val.indexOf('./') !== 0 && val.indexOf('../') !== 0){
//        if (val.indexOf("/ps/") === 0) {
//            newVal = val;
//        } else if (val.charAt(0) !== '.' && val.charAt(0) !== '/') {
//            var dirName = val.substring(0, val.indexOf('/'));
//            var namedPathUrl = runtime.resolveNamedPathUrl(dirName);
//            newVal = namedPathUrl + val.substring(val.indexOf('/'));
//        }else {
//            newVal = val;
//        }
//        logger.info("Encoded ps:attr " + origVal + " -> " + newVal);
//        var pf = "";
//        if(typeof prefix === 'string'){
//            pf = prefix;
//        }
//        newVal = pf + newVal;
//    }else{
//        throw new Error("Relative link in ps: attribute : "+ attrName + "='" + attrValue +"' with optional prefix=" + prefix);
//    }
//    return newVal;
//};

var processProtostarAttributes = function($, processingFn /*runtime, prefix*/){
    ['src', 'href'].forEach(function (attrName) {
        var sel = '*[' + attrName + '^="ps:"]';
        $(sel).each(function () {
            var origVal = $(this).attr(attrName);
//            var newVal = determineProtostarAttributeValue(attrName, origVal, runtime, prefix);
            var newVal = processingFn(attrName, origVal);
            if(newVal !== origVal){
                logger.info("Assigning new attribute value " + attrName + "="+newVal);
                $(this).attr(attrName, newVal);
            }
        });
    });
};

var absoluteUrlToTargetFileUrl = function (src, targetDir) {
    var out = src;
    if (src.indexOf("/ps/ext/") === 0) {
        out = targetDir + src;
    } else if (src.indexOf("/ps/nm/") === 0) {
        out = targetDir + src;
    } else if (src.indexOf("/ps/assets/") === 0) {
        out = targetDir + src;
    } else if (src.indexOf("/") === 0) {
        out = (targetDir + src);
    } else {
        logger.debug("Non absolute url: " + src);
    }
    if(out !== src){
        logger.debug("Encoded absolute url to target file url : " + src + " => " + out);
    }
    return out;
};

var replaceAttrRef = function (sel, attrName, targetDir) {
    var src = sel.attr(attrName);
    if(src.indexOf('//') !== 0 && src.indexOf("/") === 0 && src.indexOf(targetDir) !== 0){
        var fileUrl = /*runtime.findFileForUrlPathname(src);*/absoluteUrlToTargetFileUrl(src, targetDir);
        if (src !== fileUrl) {
            sel.attr(attrName, fileUrl);

        }
    }
};
var replaceAttrRefWithRelative = function (sel, attrName, metadata) {
    var templateTargetPath = metadata.templateTargetPath;
    var targetDir = metadata.targetDir;
    var src = sel.attr(attrName);
    logger.debug("Checking for relative for " + attrName + "=" + src);
    if(src.indexOf(targetDir) === 0){
        var relative = path.relative(path.dirname(templateTargetPath), src);
        logger.debug("SETTING RELATIVE PATH from " + path.dirname(templateTargetPath) + " -> " + src + " == " + relative);
        sel.attr(attrName, relative);
    }
};

var convertAbsoluteToTargetReferences = function($, targetDir){
    var config = {
        script:"src",
        link:"href",
        img:"src",
        a: "href"
    };
    var out = {};
    for(var tagName in config){
        var attrName = config[tagName];
        if(utils.isString(attrName)){
            $(tagName + "["+attrName+"]").each(function () {
                replaceAttrRef($(this), attrName, targetDir);
            });
        }else if(utils.isArray(attrName)){
            attrName.forEach(function(an){
                $(tagName + "["+an+"]").each(function () {
                    replaceAttrRef($(this), an, targetDir);
                });
            });
        }else{
            logger.error("Invalid replace attr refs config : ", config);
            throw new Error("Unknown config for key (tag) " + tagName);
        }
    }
    return out;
};


var createPageRelativeReferences = function($, targetDir, metadata){
    var templatePath = metadata.templatePath;
    var templateTargetPath = metadata.templateTargetPath;
    logger.info("Ensuring relative refs in target page " + templateTargetPath + "  with source=" + templatePath);
    var config = {
        script:"src",
        link:"href",
        img:"src",
        a: "href"
    };
    var out = {};
    for(var tagName in config){
        var attrName = config[tagName];
        if(utils.isString(attrName)){
            $(tagName + "["+attrName+"]").each(function () {
                replaceAttrRefWithRelative($(this), attrName, metadata);
            });
        }else if(utils.isArray(attrName)){
            attrName.forEach(function(an){
                $(tagName + "["+an+"]").each(function () {
                    replaceAttrRefWithRelative($(this), an, metadata);
                });
            });
        }else{
            logger.error("Invalid replace attr refs config : ", config);
            throw new Error("Unknown config for key (tag) " + tagName);
        }
    }
    return out;
};


var collectReferenceAttributeValues = function($, config){
    var out = {

    };
    for(var tagName in config){
        var attrName = config[tagName];
        $(tagName + "["+attrName+"]").each(function () {
            var imageSource = $(this).attr(attrName);
            if(imageSource.indexOf("//") === 0){
                logger.info("Ignoring external url : " + imageSource);
            } else if(imageSource.indexOf('./') === 0 || imageSource.indexOf('../') === 0){
                logger.error("TODO relative url support : " + imageSource);
            }else{
                if(tagName === "img" && imageSource.indexOf("data:") === 0){
                    logger.info("Ignoring IMG : " + imageSource);
                }else{
                    logger.debug(tagName + " " + imageSource + " from " + $(this)[0].outerHTML);
                    if(!out.hasOwnProperty(tagName)){
                        out[tagName] = {};
                    }
                    out[tagName][imageSource] = 1;
                }
            }
        });
    }
    return out;
};

var insertPlaceholderResources = function($, metadata){
    if (metadata.include.style.length > 0) {
        metadata.include.style.forEach(function (s) {
            $("head").append('<link rel="stylesheet" type="text/css" href="' + s + '"></script>');
        });
    }
    if (metadata.include.headScript.length > 0) {
        metadata.include.headScript.forEach(function (s) {
            $("head").append('<script src="' + s + '"></script>');
        });
    }
    if (metadata.include.script.length > 0) {
        metadata.include.script.forEach(function (s) {
            $("body").append('<script src="' + s + '"></script>');
        });
    }
};

var validateBootstrapGrid  = function($){
    var gridVariants = ['xs','sm','md','lg'];

    $(".row").each(function(){
        var containerFound = false;
        $(this).parents().each(function(){
            if(!containerFound && $(this).hasClass("container") || $(this).hasClass("container-fluid")){
                containerFound = true;
            }
        });
        if(!containerFound){
            var parentEls = $(this).parents()
                .map(function() {
                    return this.tagName;
                })
                .get()
                .join( " " );
            logger.error("bootstrap .row without .container or .container-fluid as parent! Location: " + parentEls);
        }
    });
    gridVariants.forEach(function(gv){
        for(var x = 1; x <= 12 ; x+=1){
            var selector = '.col-'+gv+'-'+x;
            $(selector).each(function(){
                var rowFound = false;
                $(this).parents().each(function(){
                    if(!rowFound && $(this).hasClass("row")){
                        rowFound = true;
                    }
                });
                if(!rowFound){
                    var parentEls = $(this).parents()
                        .map(function() {
                            return this.tagName;
                        })
                        .get()
                        .join( " " );
                    logger.error("bootstrap "+selector+" without .row as parent! Location: " + parentEls);
                }
            });
        }
    });
};


module.exports = {
    runJQuery: runJQueryFunction,
    assignUniqueIdsToEditables:assignUniqueIdsToEditables,
    processProtostarAttributes:processProtostarAttributes,
    insertPlaceholderResources:insertPlaceholderResources,
    removeMarkupIgnoredForBuild:removeMarkupIgnoredForBuild,
    collectReferenceAttributeValues:collectReferenceAttributeValues,
    convertAbsoluteToTargetReferences:convertAbsoluteToTargetReferences,
    ensureViewScriptsPresent:ensureViewScriptsPresent,
    createPageRelativeReferences:createPageRelativeReferences,
    validateBootstrapGrid:validateBootstrapGrid
};
