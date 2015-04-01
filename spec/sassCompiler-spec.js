"use strict";
var sassCompiler = require("../lib/sassCompiler");

var originalTimeout;
describe("sassCompiler", function(){

    beforeEach(function() {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
    });
    it("should compile sass", function(done){
            console.log("rendering sass");
            sassCompiler.renderSass('body{background:blue; a{color:black;}}', [], "myCss.css", function(css, cssMap, stats){
                console.log("CSS=",css)
                console.log("CSSMAP=",cssMap)
                console.log("CSS stats=", stats)
                done();
            })
    });
});