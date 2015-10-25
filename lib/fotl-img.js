var utils = require("./utils");
var fs = require("fs");
var Placeholder = utils.Placeholder;
var path = require("path");
var http = require("http");
var logger = utils.createLogger({sourceFilePath : __filename});

function PlaceholderFactory(args){
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = args.runtime;
    /**
     * @type {TemplateComposer}
     */
    this.composer = args.composer;
    /**
     *
     * @param {utils.Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */

    this.applyPlaceholder = function(part, composed, metadata) {


        /*
        img:random
        img:tags(tag1,tag2,tag3)

         */



        var t = this;
        if(this.runtime.imageCache.isEmpty()){
            setTimeout(function(){
                http.request({
                    'host':'localhost',
                    'port': t.runtime.getPort(),
                    'path': '/?command=photos'
                }, function(){
                    console.log("Received init photos for next invocation");
                }).end();
            },1);

            return part.replacePartContents(composed, 'https://raw.githubusercontent.com/OpenNTF/Web-UI-Prototyping-Toolkit/master/core/assets/icon-protostar.png');

        }

        var randomImage = this.runtime.imageCache.getRandom(1)[0];
        console.log("Random image: ", randomImage);
        return part.replacePartContents(composed, randomImage.media.hasOwnProperty("b") ? randomImage.media.b : randomImage.media.m);
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

    this.parsePlaceholder = function(tagName, fullTag, startIdx, endIdx, filepath){
        return utils.parseNoArgsPlaceholder(tagName, 'img', startIdx, endIdx, fullTag, filepath);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};