var fs = require("fs");
var path = require("path");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
var cssFixes = require("../lib/cssFixes");
var uncss = require('uncss');
var bless = require("bless");


describe("File Oriented Templating Language", function(){

    var initDefault;

    beforeEach(function(){
        initDefault = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
    });

    afterEach(function(){
        jasmine.DEFAULT_TIMEOUT_INTERVAL = initDefault ;
    });

    xit("can process files", function(){
        var css = fs.readFileSync('/home/spectre/Projects/WUIPT/projects/cssenh/example.css', 'utf8');
        cssFixes.splitCSSForIE('example.css', css, '-blessed',{}, function(err, files, selCount){
            if(err){
                console.error("Error splitting css files: ", err);
            }else{
                console.log("Found " + selCount + " so plit in files: ", files);
            }
        });
    });

    xit("can find unused styles", function(done){


        //var files   = ['my', 'array', 'of', 'HTML', 'files', 'or', 'http://urls.com'];
        var files   = [
        "/tmp/testbuild/blog.html",
        "/tmp/testbuild/carousel.html",
        "/tmp/testbuild/contacts.html",
        "/tmp/testbuild/grid.html",
        "/tmp/testbuild/index.html",
        "/tmp/testbuild/jumbotron.html",
        "/tmp/testbuild/minimal.html",
        "/tmp/testbuild/questions.html",
        "/tmp/testbuild/solution.html",
        "/tmp/testbuild/solutions.html",
        "/tmp/testbuild/test.html"
        ];
        var inLength = fs.readFileSync("/tmp/testbuild/less/styles.css", 'utf8');

        var options = {
                //ignore       : ['#added_at_runtime', /test\-[0-9]+/],
                //media        : ['(min-width: 700px) handheld and (orientation: landscape)'],
                //csspath      : '../public/css/',
                //raw          : 'h1 { color: green }',
                stylesheets  : ['/less/styles.css'],
                //ignoreSheets : [/fonts.googleapis/],
                timeout      : 1000,
                htmlroot     : '/tmp/testbuild',
                report       : true,
                //uncssrc      : '.uncssrc'
            };

        //uncss(files, options, function (error, output) {
        //    console.log(output);
        //});

        uncss(files, options,function (error, output) {
            var newLength = output.length;
            console.log("Went from " + inLength.length + " to " + newLength)
            done();
        });


        //var rawHtml = '...';
        //
        //uncss(rawHtml, options, function (error, output) {
        //    console.log(output);
        //    done()
        //});
    });


    fit("can retain only used styles in pages", function(done){

        var fd = path.resolve(__dirname, "files/usedStyles")

        //var uncss = require('uncss');

        //var files   = ['my', 'array', 'of', 'HTML', 'files', 'or', 'http://urls.com'];
        //var files   = [
        //    "/tmp/testbuild/blog.html",
        //    "/tmp/testbuild/carousel.html",
        //    "/tmp/testbuild/contacts.html",
        //    "/tmp/testbuild/grid.html",
        //    "/tmp/testbuild/index.html",
        //    "/tmp/testbuild/jumbotron.html",
        //    "/tmp/testbuild/minimal.html",
        //    "/tmp/testbuild/questions.html",
        //    "/tmp/testbuild/solution.html",
        //    "/tmp/testbuild/solutions.html",
        //    "/tmp/testbuild/test.html"
        //];
        var styleSheet = path.resolve(fd, "styles.css");
        var origFile = fs.readFileSync(styleSheet, 'utf8');

        var options = {
            //ignore       : ['#added_at_runtime', /test\-[0-9]+/],
            //media        : ['(min-width: 700px) handheld and (orientation: landscape)'],
            //csspath      : '../public/css/',
            //raw          : 'h1 { color: green }',
            stylesheets  : ['/styles.css'],
            //ignoreSheets : [/fonts.googleapis/],
            timeout      : 1000,
            htmlroot     : fd,
            report       : true,
            //uncssrc      : '.uncssrc'
        };

        cssFixes.removeUnusedCss([fd + path.sep + "index.html"], options, function(err, output, report){
            if(err){
                console.error("ERROR ", err.stack);
            }else{
                var newLength = output.length;
                fs.writeFileSync(styleSheet + ".mod.css", output);
                console.log("Went from " + origFile.length + " to " + newLength);
                console.log("REPORT = ", report);
                for(var k in report){
                    console.log("key = " + k);
                }

            }
            done();

        });

        //uncss(files, options, function (error, output) {
        //    console.log(output);
        //});

        //uncss(files, options,function (error, output) {
        //
        //    //console.log(arguments[2]);
        //    var newLength = output.length;
        //    console.log("Went from " + inLength.length + " to " + newLength)
        //    done();
        //});

        //var rawHtml = '...';
        //
        //uncss(rawHtml, options, function (error, output) {
        //    console.log(output);
        //    done()
        //});
    })
});