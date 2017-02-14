"use strict";

var url = require("url");
var fs = require("fs");
var utils = require("../../utils");
var cheerio = require("cheerio");
var osTmpdir = require("os-tmpdir");
var path = require("path");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
module.exports =  function (rc) {
    var imageCache = rc.runtime.imageCache;
    var defaultTags = ["deep", "space", "nasa"];
    if(rc.wr.containsQueryParam("random_cached")){
        if(!imageCache.isEmpty()){
            var imgResp = imageCache.getRandom(100);
            logger.debug("Writing for 100 random from cache");
            utils.writeResponse(rc.response, 200, {
                "Content-Type": "application/json; charset=utf-8"
            }, imgResp);
            return;
        }
    }else if(rc.wr.containsQueryParam("all_cached")){
        if(!imageCache.isEmpty()){
            var all = imageCache.getAll();
            utils.shuffleArray(all);
            var out = all;
            logger.debug("Writing for all_cached");
            utils.writeResponse(rc.response, 200, {
                "Content-Type": "application/json; charset=utf-8"
            }, JSON.stringify(out));
            return;
        }
    }

    var tagsString;
    if(rc.wr.containsQueryParam('tags')){
        logger.debug("Querying for images with tags: ", rc.wr.getQueryParam('tags'));
        tagsString = rc.wr.getQueryParam('tags');

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
    opt.path = "/services/feeds/photos_public.gne" + "?" + "tags="+tagsString+"&" + "format="+"json";
    //opt.path = "/services/feeds/photos_public.gne" + "?"/* + "tags="+tagsString+"&"*/ + "format="+"json";
    var imagesFound = false;
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
        imagesFound = data.items.length > 0;

        if (imagesFound) {
            var str = JSON.stringify(data.items);
            logger.debug("Writing received for " + tagsString);
            utils.writeResponse(rc.response, 200, {
                "Content-Type": "application/json; charset=utf-8"
            }, str);
        } else {
            var hop = new utils.HttpRequestOptions();
            hop.host = 'www.nasa.gov';
            hop.path = '/rss/dyn/lg_image_of_the_day.rss';
            utils.downloadHttpTextualData(hop, function(err, imagesRss){
                if(err){
                    logger.error("ERR : ", err);
                }else{
                    logger.debug("Found : ", imagesRss);
                    fs.writeFileSync(osTmpdir() + path.sep + 'tesImages.xml', imagesRss, 'utf8');
                    var images = [];
                    var $  = cheerio.load(imagesRss);
                    $('channel item').each(function(){
                        var t = $(this);
                        var title = t.find("title").html();
                        var description = t.find("description").html();
                        var enc = t.find("enclosure");
                        var imageUrl = enc.attr("url");
                        var imageSize = enc.attr("length");
                        var imageType = enc.attr("type");
                        var date = t.find("pubDate").text();
                        var link = t.find("link").text();
                        images.push({
                            title:title,
                            description: description,
                            url: imageUrl,
                            size: imageSize,
                            type : imageType,
                            date : date,
                            link : link,
                            media: {
                                m: imageUrl,
                                b: imageUrl
                            }
                        });


                    });
                    logger.info("Loaded "+images.length+" images: ", images);
                    imageCache.storeAll(images);
                    utils.writeResponse(rc.response, 200, {
                        "Content-Type": "application/json; charset=utf-8"
                    }, JSON.stringify(images));
                }

            });
        }


    });
};
module.exports.label = 'Download Photos JSON Feed';
module.exports.description = 'Retrieves photos from Flickr based on the comma separated tags in the "tags" query parameter';
module.exports.noMenu = true;