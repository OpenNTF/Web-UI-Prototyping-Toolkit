const utils = require('./utils');
const path = require('path');
const logger = utils.createLogger({sourceFilePath : __filename});
class RecursiveDirLister {
    /**
     * Example args:
     * fileNameFilter = fn(filename, filepath)
     * fileStatFilter = fn(stat, filename, filepath)
     * fileContentFilter = fn(content, filename, filepath, stat)
     * resultConverter= fn(filename, filepath, stat)
     * ignoredPaths = []
     * ignoredNames = []
     * matchFiles (true)
     * matchDirs (false)
     * @param args
     * @constructor
     */

    constructor(args) {
        this.runtime = args.runtime;
        this.fileNameFilter = args.fileNameFilter;
        this.fileStatFilter = args.fileStatFilter;
        this.fileContentFilter = args.fileContentFilter;
        this.ignoredPaths = args.ignoredPaths;
        this.ignoredPathsMap = {};
        const self = this;
        if (utils.isArray(this.ignoredPaths)) {
            this.ignoredPaths.forEach(function (ignored) {
                self.ignoredPathsMap[ignored] = 1;
            });
        }
        this.ignoredNames = args.ignoredNames;
        this.ignoredNamesMap = {};
        if (utils.isArray(this.ignoredNames)) {
            this.ignoredNames.forEach(function (ignored) {
                self.ignoredNamesMap[ignored] = 1;
            });
        }
        this.matchFiles = args.matchFiles || true;
        this.matchDirs = args.matchDirs || false;
        this.resultConverter = args.resultConverter;
    }

    isIgnored(filename, filePath) {
        return this.ignoredNamesMap.hasOwnProperty(filename) || this.ignoredPathsMap.hasOwnProperty(filePath);
    }

    /**
     *
     * @param {String[]|String} dirpaths
     * @return {String[]}
     */
    listRecursive(dirpaths) {
        const that = this;
        let dirs;
        if (utils.isArray(dirpaths)) {
            dirs = dirpaths;
        } else if (utils.isString(dirpaths)) {
            dirs = utils.functionArgsToArray(arguments);
        } else {
            throw new Error("Illegal dirs argument (should be different dir paths or array of dirpaths): " + dirpaths);
        }
        const filterNames = utils.isFunction(this.fileNameFilter);
        const filterStat = utils.isFunction(this.fileStatFilter);
        const filterContent = utils.isFunction(this.fileContentFilter);
        const matches = [];
        let convertResults = utils.isFunction(this.resultConverter);

        function processFn(fileName) {
            const fullFilePath = path.join(dir, fileName);
            let pathOk = true;
            if (!that.isIgnored(fileName, fullFilePath)) {
                if (filterNames && !that.fileNameFilter(fileName, fullFilePath)) {
                    pathOk = false;
                }
                const stat = that.runtime.statPath(fullFilePath);
                if (pathOk && filterStat && !that.fileStatFilter(stat, fileName, fullFilePath)) {
                    pathOk = false;
                }
                if (pathOk && filterContent) {
                    if (stat.isFile()) {
                        pathOk = that.fileContentFilter(that.runtime.readFile(fullFilePath), fileName, fullFilePath, stat);
                    }
                }
                if (pathOk) {
                    if (stat.isFile()) {
                        if (that.matchFiles) {
                            if (convertResults) {
                                matches.push(that.resultConverter(fileName, fullFilePath, stat));
                            } else {
                                matches.push(fullFilePath);
                            }
                        }
                    } else if (stat.isDirectory()) {
                        if (that.matchDirs) {
                            if (convertResults) {
                                matches.push(that.resultConverter(fileName, fullFilePath, stat));
                            } else {
                                matches.push(fullFilePath);
                            }
                        }
                    } else {
                        throw new Error("unknown file type: " + fullFilePath);
                    }
                }
                if (stat.isDirectory()) {
                    dirs.push(fullFilePath);
                }
            } else {
                logger.trace("Ingored path: " + dir + path.sep + fileName);
                // ignored path
            }
        }

        let dir;
        while (dirs.length > 0) {
            dir = dirs[0];
            dirs.splice(0, 1);
            const fileNames = this.runtime.listDir(dir);
            fileNames.forEach(processFn);
        }
        if (!convertResults) {
            matches.sort();
        }
        return matches;
    }
}

module.exports = RecursiveDirLister;