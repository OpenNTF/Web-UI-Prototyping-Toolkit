var fs = require("../lib/filesystem");
var path = require("path");
describe("filesystem", function(){
    it("should return a promise", function(done){
        fs.readFile(path.join(__dirname, "../package.json")).done(function(json){
            var parsed = JSON.parse(json);
            expect(parsed.name).toBe("wuipt");
            done();
        }, function(){
            throw new Error()
        })
    });
    it("should catch an error", function(done){
        fs.readFile(path.join(__dirname, "../package.jsonz")).done(function(json){
            //var parsed = JSON.parse(json);
            //expect(parsed.name).toBe("wuipt");
            //done();
            throw new Error();
        }, function(err){
            expect(typeof err).toBe("object");
            done();
        })
    });
});