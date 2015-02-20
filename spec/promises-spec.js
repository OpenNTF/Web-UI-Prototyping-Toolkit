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

//var Q = require("q");
var fs = require("fs")
if(false)
describe("promises", function(){
    it("should work :-)", function(done){
        function dirExists(path){
            console.log("fn start");
            var deferred = Q.defer();
            fs.exists(path, deferred.resolve);
            console.log("fn return");
            return deferred.promise;
        }
        console.log("invoking");
        dirExists("/home/spectre").then(function(exists){
            console.log("in then");
            expect(exists).toBe(true);
            console.log("done");
            done();
        });

    });
});