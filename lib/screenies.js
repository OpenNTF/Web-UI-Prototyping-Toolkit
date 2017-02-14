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

var webshot;// = require('webshot');
var fs = require('fs');
var utils = require('./utils');
var logger = utils.createLogger({sourceFilePath : __filename});

var defaultConfig = {
    windowSize: {
        width: 1024,
        height: 768
    }, shotSize: {
        width: "window", // px,"window", "all",
        height: "window" // px,"window", "all"
    },
    shotOffset: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
    },
    quality: 95,
    userAgent: 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 3_2 like Mac OS X; en-us) AppleWebKit/531.21.20 (KHTML, like Gecko) Mobile/7B298g',
    streamType: "png",
    renderDelay: 0,
    timeout: 5000,
    errorIfStatusIsNot200: false,
    customHeader: null

};


module.exports = {
    /**
     * Config example:
     * var config = {
            windowSize: {
                width: windowHeight,
                height: windowWidth
            }
            , shotSize: {
                width: "window", // px,"window", "all",
                height: "window" // px,"window", "all"
            },
            shotOffset: {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            },
            quality: 95,
            userAgent: 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 3_2 like Mac OS X; en-us) AppleWebKit/531.21.20 (KHTML, like Gecko) Mobile/7B298g',
            streamType: "png",
            renderDelay: 0,
            timeout: 5000,
            errorIfStatusIsNot200:false,
            customHeader: null

        };

     * @param url
     * @param targetPath
     * @param config
     */
//    createScreenshot : function(url, targetPath, config){
//        logger.info("Screenshotting " + url + " to " + targetPath);
//        webshot(url, function(err, renderStream) {
//            var file = fs.createWriteStream(targetPath, {encoding: 'binary'});
//            renderStream.on('data', function(data) {
//                file.write(data.toString('binary'), 'binary');
//            });
//        }/*, config*/);
//    },
    createScreenshotAdvanced: function (url, targetPath, windowWidth, windowHeight, callBack) {
        if(!webshot){
            logger.info("Loading webshot ..");
            webshot = require('webshot');
            logger.info("webshot loaded.");
        }
        logger.info("Screenshotting " + url + " to " + targetPath);
        var options = {
            screenSize: {
                width: windowWidth, height: windowHeight
            }, shotSize: {
                width: 'all',
                height: 'all'
            },
            renderDelay: 1200,
            quality: 75,
//            phantomConfig: {
//                zoomFactory: 2.0
//            }

            userAgent: 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 3_2 like Mac OS X; en-us)' + ' AppleWebKit/531.21.20 (KHTML, like Gecko) Mobile/7B298g'
        };

        webshot(url, targetPath, options, function () {
            logger.info("call back args:", arguments);
            logger.info("Written to " + targetPath);
            callBack(targetPath);
        });
    }
};