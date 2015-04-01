/**
 * Copyright 2014 IBM Corp.
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var path = require("path");
var cheerio = require("cheerio");
var utils = require("./utils");

var logger = utils.createLogger({sourceFilePath : __filename});

function HtmlProducer(args) {
    var instance = this;
    var createTemplateName = function (fileName) {
        return fileName.substring(0, fileName.lastIndexOf("."));
    };

    var isHtmlFilename = function (fileName) {
        return fileName.substring(fileName.lastIndexOf('.') + 1) === 'html';
    };

    var createCompiledFilename = function (templateName) {
        return templateName.substring(0, templateName.lastIndexOf('.')) + '-compiled.html';
    };

    var createMarkupLink = function (href, text) {
        return '<a href="' + href + '">' + text + '</a>';
    };

    var isCompiledTemplateFilename = function (fileName) {
        return fileName.indexOf('-compiled.html') > 0;
    };

    function createListingMarkup(files) {
        var out = "<h1>ProtoStar Prototypes</h1>\n<ul>";
        var that = this;
        files.forEach(function (fd) {
            var fileUrl = that.runtime.createUrlPathForFile(fd);

            var displayPath = that.runtime.createHtmlFileDisplayName(fd);// fileUrl.substring(1, fileUrl.lastIndexOf('.'));// = removeIndexFromTemplateName(fileUrl.substring(1, fileUrl.lastIndexOf('.')));
            var compiledFileName = createCompiledFilename(path.basename(fd));
            var compiledPath = path.join(path.dirname(fd), compiledFileName);
            out += '<li>' + createMarkupLink(fileUrl, displayPath) + ' - ' + createMarkupLink(fileUrl+ '?raw', 'Template')
                + ' - ' + createMarkupLink(fileUrl + '?source', 'Source') + ' - ' + createMarkupLink(fileUrl + '?sourceClean', 'Clean Source');
            if (instance.runtime.isExistingFilePath(compiledPath)) {
                out += ' - ' + createMarkupLink(that.runtime.createUrlPathForFile(compiledPath), 'Compiled');
            }
            out += '</li>\n';
        });
        out += '</ul>\n<a href="?command=delete_compiled">Delete all compiled</a> <a href="?command=compile_all">Compile all</a>';
        return out;
    }

    this.createListingMarkup = createListingMarkup;

    function createBareListingEntriesMarkup(files, processLinkJQueryFn) {
        var out = "";
        var that = this;
        files.forEach(function (filepath) {
            var templateName = that.runtime.createUrlPathForFile(filepath);
            var displayName = that.runtime.createHtmlFileDisplayName(filepath);
            var link = '<li><a href="' + "ps:" + templateName + '">' + displayName + '</a>' + '</li>';
            out += link;
        });
        if(typeof processLinkJQueryFn === 'function'){
            var $ = cheerio.load(out);
            processLinkJQueryFn($);
            out = $.html();
        }
        return out;
    }

    var removeIndexFromTemplateName = function (displayPath) {
        var dp = displayPath;
        if (dp.length > 6 && dp.substring(dp.length - 6) === '/index') {
            dp = dp.substring(0, dp.length - 6);
        }
        return dp;
    };
    this.removeIndexFromTemplateName = removeIndexFromTemplateName;
    this.createBareListingEntriesMarkup = createBareListingEntriesMarkup;
    function createDeletedMarkup(files) {
        var out = "<html><body><h1>Deleted ProtoStar Prototypes</h1><ul>";
        files.forEach(function (fd) {
            var fileName = fd;
            out += '<li>' + fileName + '</li>';
        });
        out += '</ul><a href="?command=list">List prototypes</a></body></html>';
        return out;
    }

    this.createDeletedMarkup = createDeletedMarkup;
    function createCompiledMarkup(files) {
        var out = "<h1>Compiled ProtoStar Prototypes</h1>\n<ul>";
        var that = this;
        files.forEach(function (fd) {
            var file = fd; //fd.name;
            var fileNameWithoutExtension = that.runtime.createHtmlFileDisplayName(fd);;
            if (!isCompiledTemplateFilename(file) && isHtmlFilename(file)) {
                out += '<li>Compiled <a href="/' + fileNameWithoutExtension + '-compiled.html">' + fileNameWithoutExtension + '</a> - <a href="' + fileNameWithoutExtension + '.html?raw">Raw</a></li>\n';
            }
        });
        out += '</ul>\n<a href="?command=list">List prototypes</a>';
        return out;
    }

    this.createCompiledMarkup = createCompiledMarkup;

    this.parseArgs = function (arg) {
        this.runtime = arg.runtime;
    };
    this.parseArgs(args);
}

module.exports = {
    createHtmlProducer: function (args) {
        return new HtmlProducer(args);
    }
};