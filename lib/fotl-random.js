var utils = require("./utils");
var uuid = require("uuid");
var Placeholder = utils.Placeholder;
var logger = utils.createLogger({sourceFilePath : __filename});

function PlaceholderFactory(args){
    this.runtime = args.runtime;
    this.composer = args.composer;

    this.applyPlaceholder = function(part, composed, metadata) {
        var functionName = part.getName();
        var output = "";
        switch(functionName){
            case 'uuid':
                output = uuid.v1();
                break;
            default: throw new Error("Unknown random function: " + functionName + " from tag " + part.getTag())

        }
        return part.replacePartContents(composed, output);
    };

    this.parsePlaceholder = function(tagName, fullTag, startIdx, endIdx, filepath){
        return utils.parseNoArgsPlaceholder(tagName, 'random', startIdx, endIdx, fullTag, filepath);
    }
}


module.exports = {
    createFactory: function(args){
        return new PlaceholderFactory(args);
    }
};