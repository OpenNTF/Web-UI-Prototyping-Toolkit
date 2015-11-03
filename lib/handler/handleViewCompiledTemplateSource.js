"use strict";
var utils = require("../utils");
var url = require("url");
var templateComposer = require("../templateComposer");
var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleViewCompiledTemplateSource = function (rc) {
    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(parsedUrl.pathname);
    var file = rc.runtime.readFile(requestedFilePath);
    var pathName = parsedUrl.pathname;
    var ts = new Date().getTime();
    var composed = rc.composer.composeTemplate(requestedFilePath, file);

    function createSourcePageMarkup(markup) {
        var preWrapped = '<!doctype html><html><head><title>HTML Sources</title><link rel="stylesheet" href="/ps/ext/highlightjs/styles/default.css"><script src="/ps/ext/highlightjs/highlight.pack.js"></script><script>hljs.initHighlightingOnLoad();</script></head><body><div class="html"><pre><code>';
        var postWrapped = '</code></pre></div></body></html>';
        var comp = markup.toString().trim();
        var quoteSourceMarkupLiteral = function (str) {
            return (str + '').replace(/([?*+^$\\(){}|])/g, "\\$1");
        };
        comp = quoteSourceMarkupLiteral(comp);
        comp = utils.encodeHtmlEntities(comp);
        return preWrapped + comp + postWrapped;
    }

    templateComposer.postProcessComposed(composed, rc.runtime, function (postProcessed) {
        rc.project.updateDynamic();
        var sourceResponse = createSourcePageMarkup(postProcessed);
        utils.writeResponse(rc.response, 200, {"Content-Type": "text/html; charset=utf-8"}, sourceResponse);
        var te = new Date().getTime();
        var taken = te - ts;
        logger.info("Served " + pathName + " using " + requestedFilePath + " in " + taken + "ms");
    });
};
module.exports = handleViewCompiledTemplateSource;