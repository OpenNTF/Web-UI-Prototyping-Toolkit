"use strict";

module.exports = function (request, response, project) {
    var files = project.listProjectTemplatePaths();
    files.sort();
    var hp = createHtmlProducer(project);
    var out = hp.createListingMarkup(files) + project.readViewScriptsMarkup();
    composer.renderBackendView(request, response, out, 'cmdList.html');
    response.end();
}