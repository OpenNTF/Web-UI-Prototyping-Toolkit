var fs = require("fs");
var path = require("path");
var testUtils = require("../lib/testUtils");
var utils = require("../lib/utils");
var cssFixes = require("../lib/cssFixes");

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
});