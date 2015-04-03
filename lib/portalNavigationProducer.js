/**
 * This module generates navigation based on detected project templates for the AngularJS Bootstrap Theme by Stephan Hesmer
 * available for WebSphere Portal at http://www.openntf.org/main.nsf/project.xsp?r=project/AngularJS%20and%20Bootstrap%20Theme%20for%20IBM%20WebSphere%20Portal
 */

var path = require("path");
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
        var e = constructNavEntry(templatePath, project.runtime);
        root.children.push(e);
    });
    return root;
}
function constructNavEntry(templatePath, runtime) {
    var templateUrlPath = runtime.createUrlPathForFile(templatePath);
    var baseName = path.basename(templatePath);
    var pageName = baseName.substring(0, baseName.lastIndexOf('.'));
    var rootPage = {
        "id": "pageId_"+pageName,
        "link": "?uri="+templateUrlPath,
        "contentLink": "?uri="+templateUrlPath,
        "themeID": "themeId",
        "profileRef": "profiles/profile_deferred.json",
        "title": {
            "value": pageName,
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