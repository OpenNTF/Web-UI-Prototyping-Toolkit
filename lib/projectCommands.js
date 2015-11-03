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

function runCommand(qualName, rc){
    if(!loadedQualifiedCommands.hasOwnProperty(qualName)){
        logger.info("Loading command " + qualName + " ..");
        loadedQualifiedCommands[qualName] = require(qualifiedCommandNames[qualName]);
    }
    return (loadedQualifiedCommands[qualName])(rc);
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
    }
};

