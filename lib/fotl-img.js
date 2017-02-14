"use strict";
const utils = require("./utils");
const fs = require("fs");
const Placeholder = require('./Placeholder');
const path = require("path");
const http = require("http");
let logger = utils.createLogger({sourceFilePath: __filename});

let initRequestFired = false;

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
     * @param {Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */

    this.applyPlaceholder = function(part, composed, metadata) {
        const fallBackImageUrl = 'http://localhost:' + this.runtime.port + '/ps/assets/icon-protostar.png';
        /*
        img:random
        img:tagged(tag1,tag2,tag3)


        img:url
        img:template

         */

        //switch (part.getName()){
        //    case 'tagged':
        //
        //        break;
        //    case 'random':
        //
        //        break;
        //    default:
        //
        //        break;
        //}

        if(this.runtime.imageCache.isEmpty() ){
            if(!initRequestFired){
                initRequestFired = true;
                setTimeout(() =>{
                    http.request({
                        'host':'localhost',
                        'port': this.runtime.getPort(),
                        'path': '/?command=photos'
                    }, function(){
                        console.log("Received init photos for next invocation");
                    }).end();
                },1);
            }

            return part.replacePartContents(composed, fallBackImageUrl);
        }

        const randomImage = this.runtime.imageCache.getRandom(1)[0];
        return part.replacePartContents(composed, randomImage.media.hasOwnProperty("b") ? randomImage.media.b : randomImage.media.m);
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

    this.parsePlaceholder = function(tagName, fullTag, startIdx, endIdx, filepath){
        return Placeholder.parsePlaceholder(fullTag, filepath, startIdx, endIdx);
    };
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};