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
"use strict";
var path = require("path");
var fs = require("fs");
var utils = require("./utils");
var copier = require("./copier");
var logger = utils.createLogger({sourceFilePath : __filename});


var commandsBasePath = path.resolve(__dirname, 'cmd');

var loadedQualifiedCommands = {};


function listRelativeCommandPaths(){
    var children = copier.listDirChildrenFullPathsRecursively(commandsBasePath).filter(function(p){
        return path.extname(p) === '.js';
    }).map(function(p){
        return p.substring(commandsBasePath.length+1);
    });
    return children;
}
function pathSeparatorsToSlash(str){
    if(str.indexOf(path.sep) < 0){
        return str;
    }else{
        return str.split(path.sep).join('/');
    }

}

function createQualifiedCommandName(cp){
    var noExtPath = cp.substring(0, cp.lastIndexOf('.'));
    var qualName = pathSeparatorsToSlash(noExtPath);
    return qualName;
}
function createQualifiedCommandNamePathMap(){
    var o = {};
    listRelativeCommandPaths().forEach(function(cp){
        var noExtPath = cp.substring(0, cp.lastIndexOf('.'));
        var qualName = pathSeparatorsToSlash(noExtPath);
        o[qualName] = '.' + path.sep + 'cmd' + path.sep + noExtPath;
    })
    return o;

}
function createShortCommandNamePathMap(){
    var o = {};
    var multiNames = {};
    listRelativeCommandPaths().forEach(function(cp){
        var qualName = createQualifiedCommandName(cp);
        var shortName;
        if(cp.lastIndexOf(path.sep)>=0){
            shortName = cp.substring(cp.lastIndexOf(path.sep)+1);
        }else{
            shortName = cp;
        }
        shortName = shortName.substring(0, shortName.lastIndexOf('.'));
        var noExtPath = cp.substring(0, cp.lastIndexOf('.'));
        if(multiNames.hasOwnProperty(shortName)){
            multiNames[shortName].push(qualName);
        }else{
            if(o.hasOwnProperty(shortName)){
                multiNames[shortName] = [o[shortName], qualName];
                delete o[shortName];
            }else{
                o[shortName] = qualName;
            }
        }
    });
    o.notShortNames = multiNames;
    return o;
}

var qualifiedCommandNames = createQualifiedCommandNamePathMap();
logger.info("Qualified Command Names = ", qualifiedCommandNames);
var shortCommandNames = createShortCommandNamePathMap();
logger.info("Short Command Names = ", shortCommandNames);
var commandInfo = createCommandInfo();

function runCommand(qualName, rc){
    if(!loadedQualifiedCommands.hasOwnProperty(qualName)){
        logger.info("Loading command " + qualName + " ..");
        loadedQualifiedCommands[qualName] = require(qualifiedCommandNames[qualName]);
    }
    var cmdFn = (loadedQualifiedCommands[qualName]);
    logger.debug("Running command " + qualName);
    return cmdFn(rc);
}

function createCommandInfo(){
    var qn = createQualifiedCommandNamePathMap();
    var sn = createShortCommandNamePathMap();
    var out = {};
    listRelativeCommandPaths().forEach(function(rcp){
        var cp = path.resolve(commandsBasePath, rcp);
        var category = path.basename(path.dirname(cp));
        var qualName = createQualifiedCommandName(rcp);
        var cntLines = fs.readFileSync(cp, 'utf8').split('\n');
        var descLines = cntLines.filter(function(l){
            return l.indexOf('module.exports.') >=0;
        }).map(function(l){
            var c = 'module.exports.';
            var nameVal = l.substring(l.indexOf(c) + c.length).trim();
            var parts = nameVal.split('=');

            return {
                name: parts[0].trim(),
                value: utils.unquote(parts[1].substring(0, parts[1].indexOf(';')).trim()).trim()
            };
        });
        var o = {};
        descLines.forEach(function(dl){
            o[dl.name] = dl.value;
        });
        o.cat = category;
        var shortName = Object.keys(sn).filter(function(k){
            return sn[k] === qualName;
        });
        if(shortName.length >0){
            o.shortName = shortName[0];
        }
        out[qualName] = o;
    });
    return out;
}

module.exports = {
    runCommand: function(commandName, rc){
        if(qualifiedCommandNames.hasOwnProperty(commandName)){
            return runCommand(commandName, rc);
        }else if(shortCommandNames.hasOwnProperty(commandName)){
            return runCommand(shortCommandNames[commandName], rc);
        }else if(shortCommandNames.notShortNames.hasOwnProperty(commandName)){
            throw new Error("Multiple commands with shortName " + commandName + ", need to use qualified: " + shortCommandNames.notShortNames.join(', '));
        }else{
            throw new Error("Unknown command name : ", commandName);
        }
    },
    createCommandInfo:function(){
        return commandInfo;
    }
};

