"use strict";

var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
var  http = require("http");
var w3c = require("w3c-validate").createValidator();
var runningValidation = false;

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {

    if (runningValidation) {
        logger.info("Still running screenshotgen");
        rc.response.writeHead(302, {
            "Location": "http://" + rc.request.headers.host
        });
        rc.response.end();
        return false;
    }
    runningValidation = true;

    var allTemplatePaths = rc.project.listAllTemplatePaths();

    logger.info("Validating " + allTemplatePaths.length  + " pages...");
    var urlErrors = {};
    function removeWrite(templatePaths) {
        if (templatePaths.length < 1) {
            logger.info("All are empty");
            return;
        }
        var templatePath = templatePaths[0];
        templatePaths.splice(0, 1);

        var templateUrlPath = rc.runtime.createUrlPathForFile(templatePath);
        var options = {
            host: (process.env["VCAP_APP_HOST"] || 'localhost'),
            port: (process.env["VCAP_APP_PORT"] || 8888),
            path: templateUrlPath
        };

        var createUrlErrorsMarkup = function(urlErrors){
            var out = '<h1>W3C Markup validation errors</h1>';

            Object.keys(urlErrors).forEach(function(url){
                out += '<div>';
                out+='<h3><a href="'+url+'">'+url+'</a></h3>';
                var errors = urlErrors[url];
                if(errors && utils.getObjectType(errors) === 'Array' && errors.length > 0){
                    out+='<dl>';
                    errors.forEach(function(e){
                        out+='<dd>'+ e.error+'</dd><dt><pre><code>'+ utils.encodeHtmlEntities(e.context)+'</code></pre></dt>';
                    });
                    out+='</dl>';
                }else{
                    out += '<p>Valid!</p>';
                }
                out+= '</div>';
            });
            return out;
        };
        var callback = function(valResp) {
            var str = '';
            valResp.on('data', function (chunk) {
                str += chunk;
            });
            valResp.on('end', function () {
                if(rc.runtime.isDebug()){
                    logger.info(str);
                }
                w3c.validate(str, function (err) {
                    logger.info("FINISHED VALIDATING " + templateUrlPath, arguments);
                    if (err) {
                        logger.info("Errors for " + templateUrlPath +": ", err);
                        urlErrors[templateUrlPath] = err;
                    } else {
                        logger.info(templateUrlPath + ' is valid!');
                        urlErrors[templateUrlPath] = "ok";
                    }
                    if (allTemplatePaths.length < 1) {
                        runningValidation = false;
                        rc.response.writeHead(200, {
                            "Content-Type":"text/html; charset=utf-8"
                        });
                        logger.info("FOUND errors: ", urlErrors);
                        var out = createUrlErrorsMarkup(urlErrors);
                        rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdValidate.html');
                        rc.response.end();

                        //response.write(out);
                        //response.end();
                    } else {
                        logger.info("Waiting 1500msec before next ...");
                        setTimeout(function(){
                            logger.info("Invoking");
                            removeWrite(allTemplatePaths);
                        }, 2000);

                    }
                });
            });
        };
        http.request(options, callback).end();
    }
    removeWrite(allTemplatePaths);
    return false;
};
module.exports.label = 'W3C Validate All Pages';
module.exports.description = 'Validates all composed pages with the W3C Validator';
/* temp disabled */
module.exports.noMenu = true;