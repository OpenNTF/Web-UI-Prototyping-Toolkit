const path = require("path");
const utils = require("./utils");
const Placeholder = require('./Placeholder');
const RecursiveDirLister = require('./RecursiveDirLister');
let logger = utils.createLogger({sourceFilePath: __filename});

function LoadScriptsPlaceholderFactory({runtime,composer}){
    /**
     * @type {ProtostarRuntime}
     */
    this.runtime = runtime;
    /**
     * @type {TemplateComposer}
     */
    this.composer = composer;

    /**
     *
     * @param {Placeholder} part
     * @param {String} composed
     * @param metadata
     * @return {String}
     */

    this.applyPlaceholder = function(part, composed, metadata) {
        const scriptsLocation = part.name;
        const projectPath = this.runtime.constructProjectPath(scriptsLocation);
        const projRoot = this.runtime.constructProjectPath("");
        const dirFiles = new RecursiveDirLister({
            runtime: this.runtime
        }).listRecursive(projectPath);

        const scriptFilePaths = [];
        const scriptFullPaths = [];
        const inline = part.args.length > 0 && part.args.indexOf('combine=true') >= 0;
        let allJs = '';
        dirFiles.forEach(filePath =>{
            if(path.extname(filePath) === '.js'){
                scriptFullPaths.push(filePath);
                scriptFilePaths.push(filePath.substring(projRoot.length));
                if(inline){
                    allJs += '\n\n//Content from ' + filePath + '\n\n' + this.runtime.readFile(filePath);
                }
            }
        });
        let out;
        if(inline){
            scriptFullPaths.sort();
            out = '\n<!-- start loadScripts for '+scriptsLocation+' -->\n';
            out += '<script type="text/javascript">\n'+allJs+'\n</script>\n';
            out+= '<!-- end loadScripts for '+scriptsLocation+' -->\n';
        }else{
            utils.createShuffled(scriptFilePaths);
            out = '\n<!-- start loadScripts for '+scriptsLocation+' -->\n';
            scriptFilePaths.forEach(function(sfp){
                out += '<script type="text/javascript" src="'+sfp.split('\\').join('/')+'"></script>\n';
            });
            out+= '<!-- end loadScripts for '+scriptsLocation+' -->\n';
        }
        return part.replacePartContents(composed, out);
    };

    /**
     *
     * @param {String} tagName
     * @param {String} fullTag
     * @param {Number} startIdx
     * @param {Number} endIdx
     * @param {String} filepath
     * @return {Placeholder}
     */
    this.parsePlaceholder = function(tagName, fullTag, startIdx, endIdx, filepath){
        return Placeholder.parsePlaceholder(fullTag, filepath, startIdx, endIdx);
    };
}


module.exports = {
    createFactory: function(args){
        return new LoadScriptsPlaceholderFactory(args);
    }
};