"use strict";
var url = require("url");
var utils = require("../../utils");
var logger = utils.createLogger({sourceFilePath : __filename});
/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var urlPathname = rc.wr.getPathname();//url_parts.pathname;
    var err = 0;
    var template, templatePath;
    if(!rc.runtime.isExistingProjectFilePath(urlPathname.substring(1))){
        logger.info("pathname doesn't exist : " + urlPathname);
        templatePath = rc.wr.getQueryParam('templatePath');
        logger.info("template path = " + templatePath);
        if (rc.runtime.isProjectFileUrlPathname(templatePath)) {
            template = rc.runtime.readProjectFile(templatePath);
            var targetPath = rc.runtime.constructProjectPath(urlPathname.substring(1));
            rc.project.writeFile(targetPath, template);
            logger.info("Copied " + templatePath + " to " + targetPath);
        } else {
            err = "Non existing path " + templatePath;
        }
    }else{
        err = "Refusing to create file at exising path: " + urlPathname;
    }
    var out;
    if (err) {
        out = {
            status: 406,
            headers: {
                "Content-Type": "text/plain"
            },
            content: err
        };
    } else {
        out = {
            status: 302,
            headers: {
                "Location": "http://" + rc.request.headers.host + urlPathname
            }
        };
    }
    return out;
};
module.exports.label = 'Create New Fragment';
module.exports.description = '';
module.exports.noMenu = true;