"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {RequestContext} rc
 */
var handleViewRawSourceRequest = function (rc) {
    function createRawPageMarkup(markup) {
        var preWrapped = '<!doctype html><html><head><title>HTML Sources</title><link rel="stylesheet" href="/ps/ext/highlightjs/styles/default.css"><script src="/ps/ext/highlightjs/highlight.pack.js"></script><script>hljs.initHighlightingOnLoad();</script></head><body><div class="html"><pre><code>';
        var postWrapped = '</code></pre></div></body></html>';
        var comp = markup.toString().trim();
        comp = utils.beautifyHtml(comp);
        return preWrapped + comp + postWrapped;
    }

    var parsedUrl = url.parse(rc.request.url, true);
    var requestedFilePath = rc.runtime.findFileForUrlPathname(parsedUrl.pathname);
    var file = rc.runtime.readFile(requestedFilePath);
    utils.writeResponse(rc.response, 200, {"Content-Type": "text/html; charset=utf-8"}, createRawPageMarkup(file));
};
module.exports = handleViewRawSourceRequest;