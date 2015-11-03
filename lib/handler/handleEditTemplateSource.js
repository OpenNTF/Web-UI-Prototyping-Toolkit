"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleEditTemplateSource = function (rc) {
    function listAceThemes() {
        var entries = rc.runtime.listDir(rc.runtime.findFileForUrlPathname('/ps/ext/ace-builds/src'));
        logger.info("ACE THEMES : ", entries);
        var themes = [];
        var themePrefix = 'theme-';
        entries.forEach(function (name) {
            var f = name.trim();
            logger.debug("Processing :: ", f);
            var ti = f.indexOf(themePrefix);
            if (ti === 0 && f.indexOf(".js") > 0) {
                themes.push(f.substring(ti + themePrefix.length, f.length - 3));
            }
        });
        logger.info("Read " + themes.length + " theme names");
        return themes;
    }

    var parsedUrl = url.parse(rc.request.url, true);
    var pathName = parsedUrl.pathname;
    var editSources = "" + rc.runtime.readFile(rc.runtime.constructAppPath(["core", "assets", "edit.html"]));
    var crit = '___EDIT_PATH___';
    var out = utils.replaceTextFragment(editSources, crit, pathName);
    var themes = listAceThemes();
    var themesString = themes.join(',');
    out = utils.replaceTextFragment(out, '___THEMES_PLACEHOLDER___', themesString);
    utils.writeResponse(rc.response, 200, {"Content-Type": "text/html; charset=utf-8"}, out);
};
module.exports = handleEditTemplateSource;