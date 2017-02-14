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
const path = require("path");
const cheerio = require("cheerio");
const utils = require("./utils");

const logger = utils.createLogger({sourceFilePath: __filename});

class HtmlProducer {
    constructor({runtime}) {
        this.runtime = runtime;
    }

    createTemplateName(fileName) {
        return fileName.substring(0, fileName.lastIndexOf("."));
    }

    isHtmlFilename(fileName) {
        return path.extname(fileName) === '.html';
    }

    createCompiledFilename(templateName) {
        return templateName.substring(0, templateName.lastIndexOf('.')) + '-compiled.html';
    }

    createMarkupLink(href, text) {
        return '<a href="' + href + '">' + text + '</a>';
    }

    /**
     *
     * @param {string} fileName
     * @return {boolean}
     */
    isCompiledTemplateFilename(fileName) {
        return fileName.indexOf('-compiled.html') > 0;
    }

    /**
     *
     * @param {string[]} files
     * @return {string}
     */
    createListingMarkup(files) {
        let out = "<h1>ProtoStar Prototypes</h1>\n<ul>";
        const that = this;
        files.forEach(function (fd) {
            const fileUrl = that.runtime.createUrlPathForFile(fd);

            const displayPath = that.runtime.createHtmlFileDisplayName(fd);// fileUrl.substring(1, fileUrl.lastIndexOf('.'));// = removeIndexFromTemplateName(fileUrl.substring(1, fileUrl.lastIndexOf('.')));
            const compiledFileName = that.createCompiledFilename(path.basename(fd));
            const compiledPath = path.join(path.dirname(fd), compiledFileName);
            out += '<li>' + that.createMarkupLink(fileUrl, displayPath) + ' - ' + that.createMarkupLink(fileUrl + '?raw', 'Template') + ' - ' + that.createMarkupLink(fileUrl + '?source', 'Source') + ' - ' + that.createMarkupLink(fileUrl + '?sourceClean', 'Clean Source');
            if (that.runtime.isExistingFilePath(compiledPath)) {
                out += ' - ' + that.createMarkupLink(that.runtime.createUrlPathForFile(compiledPath), 'Compiled');
            }
            out += '</li>\n';
        });
        out += '</ul>\n<a href="?command=delete_compiled">Delete all compiled</a> <a href="?command=compile_all">Compile all</a>';
        return out;
    }


    removeIndexFromTemplateName(displayPath) {
        let dp = displayPath;
        if (dp.length > 6 && dp.substring(dp.length - 6) === '/index') {
            dp = dp.substring(0, dp.length - 6);
        }
        return dp;
    }

    createBareListingEntriesMarkup(files, processLinkJQueryFn) {
        let out = "";
        const that = this;
        files.forEach(function (filepath) {
            const templateName = that.runtime.createUrlPathForFile(filepath);
            const displayName = that.runtime.createHtmlFileDisplayName(filepath);
            const link = '<li><a href="' + "ps:" + templateName + '">' + displayName + '</a>' + '</li>';
            out += link;
        });
        if (typeof processLinkJQueryFn === 'function') {
            const $ = cheerio.load(out);
            processLinkJQueryFn($);
            out = $.html();
        }
        return out;
    }


    createDeletedMarkup(files) {
        let out = "<html><body><h1>Deleted ProtoStar Prototypes</h1><ul>";
        files.forEach(function (fd) {
            out += '<li>' + fd + '</li>';
        });
        out += '</ul><a href="?command=list">List prototypes</a></body></html>';
        return out;
    }


    createCompiledMarkup(files) {
        let out = "<h1>Compiled ProtoStar Prototypes</h1>\n<ul>";
        const that = this;
        files.forEach(function (fd) {
             //fd.name;
            const fileNameWithoutExtension = that.runtime.createHtmlFileDisplayName(fd);
            if (!that.isCompiledTemplateFilename(fd) && that.isHtmlFilename(fd)) {
                out += '<li>Compiled <a href="/' + fileNameWithoutExtension + '-compiled.html">' + fileNameWithoutExtension + '</a> - <a href="' + fileNameWithoutExtension + '.html?raw">Raw</a></li>\n';
            }
        });
        out += '</ul>\n<a href="?command=list">List prototypes</a>';
        return out;
    }
}

module.exports = HtmlProducer;