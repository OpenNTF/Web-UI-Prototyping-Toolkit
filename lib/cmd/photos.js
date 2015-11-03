"use strict";

var url = require("url");
var utils = require("../utils");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports =  function (rc) {
    var imageCache = rc.runtime.imageCache;
    var url_parts = url.parse(rc.request.url, true);
    var defaultTags = ["deep", "space", "nasa"];
    if(url_parts.query.hasOwnProperty("random_cached")){
        if(!imageCache.isEmpty()){
            var imgResp = imageCache.getRandom(100);
            console.log("Writing for 100 random from cache");
            utils.writeResponse(rc.response, 200, {
                "Content-Type": "application/json; charset=utf-8"
            }, imgResp);
            return;
        }
    }else if(url_parts.query.hasOwnProperty("all_cached")){
        if(!imageCache.isEmpty()){
            var all = imageCache.getAll();
            utils.shuffleArray(all);
            var out = all;
            console.log("Writing for all_cached");
            utils.writeResponse(rc.response, 200, {
                "Content-Type": "application/json; charset=utf-8"
            }, JSON.stringify(out));
            return;
        }
    }

    var tagsString;
    if(url_parts.query.hasOwnProperty("tags")){
        logger.debug("Querying for images with tags: ", url_parts.query.tags);
        tagsString = url_parts.query.tags;

        tagsString = tagsString.replace(/[ ]/g,',');
    }else{
        tagsString = defaultTags.join(",");
    }
    var findForTagsString = function (i) {
        return i.tagsString === tagsString;
    };
    var cachedForTagsString = imageCache.filter(findForTagsString);
    if(cachedForTagsString.length > 0){
        logger.debug("Writing from cache for " + tagsString);
        utils.writeResponse(rc.response, 200, {
            "Content-Type": "application/json; charset=utf-8"
        }, JSON.stringify(cachedForTagsString));
        return;
    }

    var opt = new utils.HttpRequestOptions();
    opt.host = "api.flickr.com";
    if(tagsString +"" === '[object,Arguments]') {
        throw new Error();
    }
    opt.path = "/services/feeds/photos_public.gne" + "?tags="+tagsString+"&format="+"json";
    utils.downloadJsonpData(opt, function(err, data){
        if(err){
            //throw new Error("Error getting flickr photos: " + err);
            rc.response.writeHead(500);
            rc.response.end();
            return;
        }
        data.items.forEach(function(i){
            i.tagsString = tagsString;
            i.id = imageCache.keyFn(i);
        });
        imageCache.storeAll(data.items);
        var str = JSON.stringify(data.items);
        logger.debug("Writing received for " + tagsString);
        utils.writeResponse(rc.response, 200, {
            "Content-Type": "application/json; charset=utf-8"
        }, str);
    });
};
