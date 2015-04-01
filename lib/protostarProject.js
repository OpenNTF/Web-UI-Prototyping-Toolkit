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

var utils = require("./utils");
var htmlProducerFactory = require("./htmlProducer");

var logger = utils.createLogger({sourceFilePath : __filename});
var ignoredNames = [".git",
    ".idea",
    "node_modules",
    "bower_components",
    ".workspace",
    ".settings"];


function Project(args) {
    this.runtime = args.runtime;
    this.composer = args.composer;
    this.lessParserAdditionalArgs = {
        globalVars: {'themeName':'flatly'},
        modifyVars: {'themeName':'flatly'}
    };

    this.htmlProducer = htmlProducerFactory.createHtmlProducer({
        runtime: this.runtime
    });

    this.resolveProjectFile = function (pathName) {
        return this.runtime.constructProjectPath(pathName);
    };

    this.projectPathExists = function (pathName) {
        return this.runtime.isExistingProjectPath(pathName);
    };

    this.writeDynamicFile = function (fileName, content, args) {
        this.runtime.writeFile(this.runtime.constructProjectPath(["_dynamic" , fileName]), content, args);
    };

    this.readFile = function (projectPath) {
        return this.runtime.readProjectFile(projectPath);
    };

    this.writeFile = function (projectPath, content, args) {
        this.runtime.writeFileCreatingParents(projectPath, content, args);
    };

    this.isHtmlFilename = function (fileName) {
        return path.extname(fileName) === ".html";
    };

    this.listProjectTemplatePaths = function(){
        var dirPath = this.runtime.constructProjectPath("");
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return that.runtime.isProjectPath(filepath) && !that.runtime.isNamedPathChild(filepath) && fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };
    this.listProjectJadeTemplatePaths = function(){
        var dirPath = this.runtime.constructProjectPath("");
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return that.runtime.isProjectPath(filepath) && !that.runtime.isNamedPathChild(filepath) && fileStat.isFile() && (path.extname(filename) === '.jade');
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };

    this.listTemplatePaths = function (dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("")
        }
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };

    this.listAllTemplatePaths = function (dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("")
        }
        logger.debug("Finding all prototype page paths in " + dirPath);
        var htmlFiles = this.listProjectTemplatePaths();
        var that = this;
        var pathsIdx = {};
        htmlFiles.forEach(function (p) {
            pathsIdx[p] = 1;
        });
        logger.debug("All HTML paths: ", pathsIdx);
        htmlFiles.forEach(function (p) {
            //var c = that.runtime.readFile(p);
            var cc = that.composer.composeTemplateCached(p).content;
            if(cc.indexOf('<html') < 0 || cc.indexOf('</html>') < 0 || cc.indexOf('{%') >=0){
                delete pathsIdx[p];
            }
        });
        logger.debug("All HTML paths that have <html and </html>: ", pathsIdx);
        var reffed = this.listAllReferencedPaths(dirPath);
        reffed.forEach(function (r) {
            if (pathsIdx.hasOwnProperty(r)) {
                delete pathsIdx[r];
            }
        });
        logger.debug("Only those that aren't referenced from anywhere: ", pathsIdx);
        var layouts = this.listAllLayouts(dirPath);
        layouts.forEach(function (r) {
            if (pathsIdx.hasOwnProperty(r)) {
                delete pathsIdx[r];
            }
        });
        logger.debug("Only non-layouts: ", pathsIdx);
        var templateFileNames = [];
        for (var path in pathsIdx) {
            if (pathsIdx.hasOwnProperty(path)) {
                templateFileNames.push(path);
            }
        }
        templateFileNames.sort();
        logger.debug("All template paths: ", templateFileNames);
        return templateFileNames;
    };

    this.toRelativePath = function (fullPath) {
        return this.runtime.toRelativeProjectPath(fullPath);
    };

    this.isInSubdir = function (fullPath) {
        return this.runtime.isProjectPath(fullPath) && this.toRelativePath(fullPath).indexOf("/") > 0;
    };

    this.getUserConfig = function(){
        return this.userConfig;
    };

    this.listPathsWithReferences = function (dirPath, dropPointTypes) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("");
        }
        var that = this;
        var dpTypes = dropPointTypes || this.runtime.userConfig.dropPointTypes;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            },
            fileContentFilter: function (content, fileName, filepath, fileStat) {
                return that.composer.findAllDropPoints(filepath, content, dpTypes).length > 0;
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };

    this.listAllLayouts = function (dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("");
        }
        var that = this;
        var lister = utils.createRecursiveDirLister({
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            },
            fileContentFilter: function (content, fileName, filepath, fileStat) {
                return content.indexOf('<!-- content:') >= 0;
            }
        });
        var matches = lister.listRecursive(dirPath);
        this.sortPathNames(matches);
        matches.sort();
        return matches;
    };

    this.sortString = function (a, b) {
        if (a < b) {
            return -1;
        } else if (a > b) {
            return 1;
        } else {
            return 0;
        }
    };
    this.sortPathNames = function (paths) {
        var that = this;
        paths.sort(function (a, b) {
            var ps = that.sortString(a.path, b.path);
            if (ps === 0) {
                ps = that.sortString(a.name, b.name);
            }
            return ps;
        });
    };
    this.listAllReferencedPaths = function (dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("")
        }
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isHtmlFilename(filename) && !that.isCompiledTemplateFilename(filename);
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        var out = [];
        var done = {};
        matches.forEach(function (filePath) {
            var content = that.runtime.readFile(filePath);
            var dropPoints = that.composer.findAllDropPoints(filePath, content, ["layout", "file", "wrap"]);
            for (var di = 0; di < dropPoints.length; di += 1) {
                var dp = dropPoints[di];
                try{
                    var resolvedPath = that.runtime.resolveFilePathForPlaceHolder(dp);
                    if(that.runtime.isDebug()){
                        logger.info("Path " + filePath + " references " + resolvedPath);
                    }
                    if (!done.hasOwnProperty(resolvedPath)) {
                        done[resolvedPath] = 1;
                        out.push(resolvedPath);
                    }
                }catch(e){
                    logger.error("Could not process drop point " + dp.getType()+ ":" + dp.getName(), e.stack);
                    logger.error("Skipping..");
                    //logger.trace();
                }
            }
        });
        out.sort();
        return out;
    };

    this.isCompiledTemplateFilename = function (fileName) {
        return fileName.indexOf('-compiled.html') > 0;
    };

    this.toFileUrl = function (fullPath) {
        return this.runtime.createUrlPathForFile(fullPath);
    };

    this.listCompiledTemplatePaths = function (dirPath) {
        if (!dirPath) {
            dirPath = this.runtime.constructProjectPath("")
        }
        var that = this;
        var lister = utils.createRecursiveDirLister({
            ignoredNames: ignoredNames,
            runtime: this.runtime,
            fileStatFilter: function (fileStat, filename, filepath) {
                return fileStat.isFile() && that.isCompiledTemplateFilename(filename);
            }
        });
        var matches = lister.listRecursive(dirPath);
        matches.sort();
        return matches;
    };
    this.updateDynamic = function () {
        var dynamicDirPath = this.runtime.constructProjectPath("_dynamic");
        this.runtime.mkdirs(dynamicDirPath);
        var files = this.listAllTemplatePaths();//listPathsWithReferences();
        this.runtime.writeFile(this.runtime.constructProjectPath(["_dynamic", "list-referencing-bare.html"]), this.htmlProducer.createBareListingEntriesMarkup(files, function($){
            $("li").addClass("wpthemeNavListItem wpthemeLeft");

            $("a").addClass("wpthemeLeft");
            $("a").eq(0).addClass("wpthemeFirst");
        }));
        this.runtime.writeFile(this.runtime.constructProjectPath(["_dynamic", "list-compiled-bare.html"]), this.htmlProducer.createBareListingEntriesMarkup(this.listCompiledTemplatePaths()));
    };
    function readViewScriptsMarkup() {
        return this.runtime.readAppFile(["core", "assets", "viewScripts.html"]);
    }

    this.readViewScriptsMarkup = readViewScriptsMarkup;
}

module.exports = {
    createProject: function (args) {
        return new Project(args);
    }
};