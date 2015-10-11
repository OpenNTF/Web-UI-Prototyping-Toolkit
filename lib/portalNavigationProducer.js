/**
 * This module generates navigation based on detected project templates for the AngularJS Bootstrap Theme by Stephan Hesmer
 * available for WebSphere Portal at http://www.openntf.org/main.nsf/project.xsp?r=project/AngularJS%20and%20Bootstrap%20Theme%20for%20IBM%20WebSphere%20Portal
 */

var path = require("path");
var cheerio = require("cheerio");
var jqueryRunner = require("./jqueryRunner");

/**
 *
 * @param {Project} project
 * @return {{id: string, link: string, contentLink: string, themeID: string, profileRef: string, title: {value: string, locale: string, dir: string}, isHidden: boolean, isDraft: boolean, children: Array}}
 */
function generateNavigation(project) {
    var files = project.listAllTemplatePaths();
    files.sort();
    var root = {
        "id": "root",
        "link": "?uri=/",
        "contentLink": "?uri=/",
        "themeID": "themeId",
        "profileRef": "profiles/profile_deferred.json",
        "title": {
            "value": "Root", "locale": "en", "dir": "ltr"
        },
        "isHidden": false,
        "isDraft": false,
        "children": []
    };
    files.forEach(function (templatePath) {
        var e = constructNavEntry(templatePath, project);
        root.children.push(e);
    });
    return root;
}
/**
 *
 * @param {String} templatePath
 * @param {Project} project
 * @return {{id: string, link: string, contentLink: string, themeID: string, profileRef: string, title: {value: (string|*), locale: string, dir: string}, isHidden: boolean, isDraft: boolean, children: Array}}
 */
function constructNavEntry(templatePath, project) {
    var templateUrlPath = project.runtime.createUrlPathForFile(templatePath);
    var baseName = path.basename(templatePath);
    var pageName = baseName.substring(0, baseName.lastIndexOf('.'));
    var cmp;
    if(project.runtime.cachingEnabled){
        cmp = project.composer.composeTemplateCached(templatePath).content;
    }else{
        cmp = project.composer.composeTemplate(templatePath).content;
    }
    var $ = cheerio.load(cmp);
    var pageTitle = pageName;
    if($("title").length > 0){
        pageTitle = $("title").text();
    }
    var rootPage = {
        "id": "pageId_"+pageName,
        "link": "?uri="+templateUrlPath,
        "contentLink": "?uri="+templateUrlPath,
        "themeID": "themeId",
        "profileRef": "profiles/profile_deferred.json",
        "title": {
            "value": pageTitle,
            "locale": "en",
            "dir": "ltr"
        },
        "isHidden": false,
        "isDraft": false,
        "children": []
    };
    return rootPage;
}
module.exports = {
    generateNavigation: generateNavigation
};