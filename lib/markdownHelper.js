var marked = require('marked');

var createTableOfContents = function(source){
    var FOUR_SPACES = "    ";
    var leftIndents = [""];
    for(var i = 1; i < 10; i++) {
        leftIndents.push(leftIndents[i-1] + FOUR_SPACES);
    }
    function processData(data) {
        var lines = data.split('\n');
        var titles = [];
        var depths = [];
        var minDepth = 1000000;
        for(var i = 0; i < lines.length; i++) {
            var m = lines[i].match(/^\s*(#+)(.*)$/);
            if (!m) continue;
            minDepth = Math.min(minDepth, m[1].length);
            depths.push(m[1].length);
            titles.push(m[2]);
        }
        for(var j = 0; j < depths.length; j++) {
            depths[j] -= minDepth;
        }
        var toc = createTOC(depths, titles).join('\n');
        var tocRegexp = /^\s*<!-- TOC -->\s*$/;
        for(var k = 0; k <lines.length; k++) {
            if (tocRegexp.test(lines[k])) {
                lines[k] = '## Contents\n'+toc;
            }
        }
        return lines.join('\n');
    }

    function createTOC(depths, titles) {
        var ans = [];
        for(var i = 0; i < depths.length; i++) {
            ans.push(tocLine(depths[i], titles[i]));
        }
        return ans;
    }

    function titleToUrl(title) {
        return title.trim().toLowerCase().replace(/\s/g, '-').replace(/[^-0-9a-z]/g, '');
    }

    function tocLine(depth, title) {
        return leftIndents[depth] + "- [" + title.trim() + "](#" + titleToUrl(title) + ")";
    }
    return processData(source);
};

function compileMarkdown(source){
    return marked(source);
}

module.exports = {
    createTableOfContents:createTableOfContents,
    compileMarkdown:compileMarkdown
};