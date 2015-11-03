"use strict";

/**
 *
 * @param {requestContext.RequestContext} rc
 */
module.exports=function (rc) {
    var files = rc.project.listAllTemplatePaths();
    files.sort();
    var menu = "";
    var out = "";
    files.forEach(function(f){
        var urlPath = rc.runtime.createUrlPathForFile(f);
        var urlPathId = ("" + urlPath).replace(new RegExp('[./]', 'g'), '_');
        menu+='<li><a href="#'+urlPathId+'">'+urlPath+'</a></li>';
        out+=
            '<div class="col-md-12"><h2 id="'+urlPathId+'">'+urlPath+'</h2><a href="#generated-menu">Go to menu</a><div class="embed-responsive embed-responsive-4by3"><iframe class="embed-responsive-item" src="'+urlPath+'" ></iframe></div></div>';
    });
    out = '<div class="row">' + out + "</div>" + rc.project.readViewScriptsMarkup();
    var menuMarkup = '<div class="row"><div class="col-md-12"><ul id="generated-menu">'+menu+'</ul></div></div>';
    out = menuMarkup + out;
    rc.composer.renderBackendView(rc.request, rc.response, out, 'cmdList.html');
    rc.response.end();
};
module.exports.label = 'Load All Pages';
module.exports.description = '';