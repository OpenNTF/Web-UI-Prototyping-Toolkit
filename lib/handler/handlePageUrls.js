var url = require("url");
/**
 *
 * @param {RequestContext} rc
 */
var handlePageUrls = function(rc){
    var templatePaths = rc.project.listAllTemplatePaths().map(function(filePath){
        return rc.runtime.createUrlPathForFile(filePath);
    });
    var currentPath = rc.wr.getQueryParam('current');
    var go = rc.wr.getQueryParam('go').toLowerCase();
    var currentIndex = templatePaths.indexOf(currentPath);
    if(currentIndex < 0){
        throw new Error("no such path " + currentPath);
    }
    var newIndex = currentIndex;
    switch(go){
        case 'next':
            newIndex++;
            break;
        case 'previous':
        case 'prev' :
            newIndex--;
            break;
    }
    if(newIndex >= templatePaths.length){
        newIndex = 0;
    }else if(newIndex < 0){
        newIndex = templatePaths.length-1;
    }
    rc.response.writeHead(200, {
        "Content-Type" : "text/plain; charset=utf-8"
    });
    rc.response.write(templatePaths[newIndex]);
    rc.response.end();
};
module.exports = handlePageUrls;