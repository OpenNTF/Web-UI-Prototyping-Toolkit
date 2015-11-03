"use strict";
var utils = require("../utils");
var url = require("url");

var logger = utils.createLogger({sourceFilePath : __filename});

/**
 *
 * @param {requestContext.RequestContext} rc
 */
var handleRestData = function (rc) {
    var restPrefix = "/ps/rest/";
    var objPrefix = "object";
    var listPrefix = "list";
    var urlParts = url.parse(rc.request.url, true);
    var urlPathname = decodeURIComponent(urlParts.pathname);
    logger.info("REST " + rc.request.method + " " + urlPathname + " with query:", urlParts.query);
    var modelPath;
    var fs = require("fs");
    var modelTypePrefix;
    var isObjectModel = false;
    if (urlPathname.indexOf(restPrefix + objPrefix) === 0) {
        modelTypePrefix = objPrefix;
        isObjectModel = true;
    } else if (urlPathname.indexOf(restPrefix + listPrefix) === 0) {
        modelTypePrefix = listPrefix;
    } else {
        throw new Error("Unsupported urlpathname: " + urlPathname);
    }
    modelPath = urlPathname.substring((restPrefix + modelTypePrefix).length + 1);
    var modelFilePath = rc.runtime.constructProjectPath(modelPath + ".json");
    logger.info("MODEL PATH=" + modelPath + " => " + modelFilePath);
    function handleObjectModelRequest() {
        switch (rc.request.method) {
            case 'GET':
                if (fileExists) {
                    utils.writeResponse(rc.response, 200, {"Content-Type": "application/json; charset=utf-8"}, rc.runtime.readFile(modelFilePath));
                } else {
                    throw new Error("Dont understand " + rc.request.method + " " + urlPathname + " -> there is no file at " + modelFilePath);
                }
                break;
            case 'POST':
                if (fileExists) {
                    console.error("File already exists at " + modelFilePath);
                    rc.response.writeHead(404, {
                        "error-message": "File already exists at " + modelFilePath
                    });
                    rc.response.end();
                } else {
                    var postRequestData = '';
                    rc.request.on('data', function (data) {
                        postRequestData += data;
                        var length = postRequestData.length;
                        if (length > 1e6) {
                            rc.request.connection.destroy();
                            throw new Error("File was getting too large ! " + length);
                        }
                    });
                    rc.request.on('end', function () {
                        var postItem = JSON.parse(postRequestData);
                        if (!postItem.hasOwnProperty("id")) {
                            throw new Error("An id property should be set on the data");
                        }
                        if (postItem.hasOwnProperty("version")) {
                            postItem.version = 1;
                        }
                        postItem.created = new Date().getTime();
                        postItem.updated = new Date().getTime();
                        fs.writeFileSync(modelFilePath, JSON.stringify(postItem), 'utf8');
                        utils.writeResponse(rc.response, 200, {
                            "Content-Type": "application/json; charset=utf-8",
                            "Location": "http://" + rc.request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath
                        }, JSON.stringify(postItem));
                    });
                }
                return;
                //break;
            case 'PUT':
                if (fileExists) {
                    var putRequestData = '';
                    rc.request.on('data', function (data) {
                        putRequestData += data;
                        var length = putRequestData.length;
                        if (length > 1e6) {
                            rc.request.connection.destroy();
                            throw new Error("File was getting too large ! " + length);
                        }
                    });
                    rc.request.on('end', function () {
                        var putItem = JSON.parse(putRequestData);
                        var currentItem = JSON.parse(rc.runtime.readFile(modelFilePath));
                        if (currentItem.hasOwnProperty("version")) {
                            putItem.version = currentItem.version + 1;
                        }
                        if (currentItem.hasOwnProperty("created") || currentItem.hasOwnProperty("updated")) {
                            putItem.updated = new Date().getTime();
                        }
                        fs.writeFileSync(modelFilePath, JSON.stringify(putItem), 'utf8');
                        utils.writeResponse(rc.response, 200, {
                            "Content-Type": "application/json; charset=utf-8",
                            "Location": "http://" + rc.request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath
                        }, JSON.stringify(putItem));
                    });
                } else {
                    console.error("Dont understand " + rc.request.method + " " + urlPathname);
                    rc.response.writeHead(404, {
                        "error-message": "Dont understand " + rc.request.method + " " + urlPathname
                    });
                    rc.response.end();
                }
                return;
            case 'DELETE':
                if (!fileExists) {
                    throw new Error("there is no file to delete at path " + modelFilePath);
                } else {
                    logger.info("DELETE : " + modelFilePath);
                    fs.unlinkSync(modelFilePath);
                    rc.response.writeHead(200);
                    rc.response.end();
                }
                return;
            case 'OPTIONS':
                console.error("No OPTIONS support yet for object mode");
                rc.response.writeHead(404, {
                    "error-message": "No OPTIONS support yet for object mode"
                });
                rc.response.end();
                return;
            case 'HEAD':
                if (fileExists) {
                    rc.response.writeHead(200, {
                        "Content-Type": "application/json; charset=utf-8"
                    });
                    rc.response.end();
                } else {
                    rc.response.writeHead(404);
                    rc.response.end();
                }
                return;
            default:
                console.error("Dont understand " + rc.request.method + " " + urlPathname);
                rc.response.writeHead(404, {
                    "error-message": "Dont understand " + rc.request.method + " " + urlPathname
                });
                rc.response.end();
                return;
        }
    }

    function handleListModelRequest() {
        switch (rc.request.method) {
            case 'GET':
                if (fileExists) {
                    utils.writeResponse(rc.response, 200, {"Content-Type": "application/json; charset=utf-8"}, rc.runtime.readFile(modelFilePath));
                } else if (higherModelFileExists && idPart) {
                    var itemsArray = JSON.parse(rc.runtime.readFile(higherModelFilePath));
                    var itm;
                    itemsArray.forEach(function (i) {
                        if (i.id == idPart) {
                            itm = i;
                        }
                    });
                    if (itm) {
                        utils.writeResponse(rc.response, 200, {"Content-Type": "application/json; charset=utf-8"}, JSON.stringify(itm));
                    } else {
                        utils.writeResponse(rc.response, 404, {"Content-Type": "application/json; charset=utf-8"});
                    }
                } else {
                    throw new Error("Dont understand " + rc.request.method + " " + urlPathname);
                }
                break;
            case 'POST':
                if (fileExists) {
                    var requestData = '';
                    rc.request.on('data', function (data) {
                        requestData += data;
                        // Too much data
                        var length = requestData.length;
                        if (length > 1e6) {
                            rc.request.connection.destroy();
                            throw new Error("File was getting too large ! " + length);
                        }
                    });
                    rc.request.on('end', function () {
                        var postedItem = JSON.parse(requestData);
                        var itemsArray = JSON.parse(rc.runtime.readFile(modelFilePath));
                        var maxId = 0;
                        itemsArray.forEach(function (i) {
                            if (i.id) {
                                if (typeof i.id === 'number' && i.id > maxId) {
                                    maxId = i.id;
                                } else if (typeof i.id === 'string' && parseInt(i.id, 10) == i.id) {
                                    var n = parseInt(i.id, 10);
                                    if (n > maxId) {
                                        maxId = n;
                                    }
                                }
                            }
                        });
                        var newId = maxId + 1;
                        postedItem.id = newId;
                        postedItem.version = 1;
                        var now = new Date().getTime();
                        postedItem.created = now;
                        postedItem.updated = now;
                        itemsArray.push(postedItem);
                        fs.writeFileSync(modelFilePath, JSON.stringify(itemsArray), 'utf8');
                        utils.writeResponse(rc.response, 201, {
                            "Content-Type": "application/json; charset=utf-8",
                            "Location": "http://" + rc.request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath + "/" + newId
                        }, JSON.stringify(postedItem));
                    });
                } else {
                    throw new Error("Dont understand " + rc.request.method + " " + urlPathname);
                }
                return;
            case 'PUT':
                if (higherModelFileExists) {
                    var putRequestData = '';
                    rc.request.on('data', function (data) {
                        putRequestData += data;
                        var length = putRequestData.length;
                        if (length > 1e6) {
                            rc.request.connection.destroy();
                            throw new Error("File was getting too large ! " + length);
                        }
                    });
                    rc.request.on('end', function () {
                        var putItem = JSON.parse(putRequestData);
                        var itemsArray = JSON.parse(rc.runtime.readFile(higherModelFilePath));
                        var itm;
                        var idx = -1;
                        itemsArray.forEach(function (i, dx) {
                            if (i.id == idPart) {
                                itm = i;
                                idx = dx;
                            }
                        });
                        if (!itm || idx < 0) {
                            throw new Error("Cant find item at resource " + higherModelPath + " with id " + idPart);
                        }
                        if (!itm.hasOwnProperty("id") || typeof itm.id !== 'number' || !itm.hasOwnProperty("version") || typeof itm.version !== 'number') {
                            throw new Error("An item should have both id & version set as numbers : " + JSON.stringify(itm));
                        }
                        itemsArray[idx] = putItem;
                        putItem.version = itm.version + 1;
                        putItem.updated = new Date().getTime();
                        fs.writeFileSync(higherModelFilePath, JSON.stringify(itemsArray), 'utf8');
                        utils.writeResponse(rc.response, 200, {
                            "Content-Type": "application/json; charset=utf-8",
                            "Location": "http://" + rc.request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath + "/" + putItem.id
                        }, JSON.stringify(putItem));
                    });
                } else {
                    throw new Error("Dont understand " + rc.request.method + " " + urlPathname);
                }
                return;
            case 'DELETE':
                if (higherModelFileExists) {
                    var putRequestData = '';
                    rc.request.on('data', function (data) {
                        putRequestData += data;
                        var length = putRequestData.length;
                        if (length > 1e6) {
                            rc.request.connection.destroy();
                            throw new Error("File was getting too large ! " + length);
                        }
                    });
                    rc.request.on('end', function () {
                        var itemsArray = JSON.parse(rc.runtime.readFile(higherModelFilePath));
                        var itm;
                        var idx = -1;
                        itemsArray.forEach(function (i, dx) {
                            if (i.id == idPart) {
                                itm = i;
                                idx = dx;
                            }
                        });
                        if (!itm || idx < 0) {
                            throw new Error("Cant find and thus not delete item at resource " + higherModelPath + " with id " + idPart);
                        }
                        itemsArray.splice(idx, 1);
                        fs.writeFileSync(higherModelFilePath, JSON.stringify(itemsArray), 'utf8');
                        rc.response.writeHead(200);
                        rc.response.end();
                    });
                } else {
                    throw new Error("Dont understand " + rc.request.method + " " + urlPathname);
                }
                return;
            case 'OPTIONS':
                throw new Error("Dont understand " + rc.request.method + " " + urlPathname);
            case 'HEAD':
                if (fileExists) {
                    rc.response.writeHead(200, {
                        "Content-Type": "application/json; charset=utf-8"
                    });
                    rc.response.end();
                } else if (higherModelFileExists) {
                    var itemsArray = JSON.parse(rc.runtime.readFile(higherModelFilePath));
                    var itm;
                    var idx;
                    itemsArray.forEach(function (i, dx) {
                        if (i.id == idPart) {
                            itm = i;
                            idx = dx;
                        }
                    });
                    if (!itm) {
                        rc.response.writeHead(404);
                        rc.response.end();
                    } else {
                        rc.response.writeHead(200, {
                            "Content-Type": "application/json; charset=utf-8"
                        });
                    }
                } else {
                    rc.response.writeHead(404);
                    rc.response.end();
                }
                return;
            default:
                throw new Error("Dont understand " + rc.request.method + " " + urlPathname);
        }
    }

    var fileExists = fs.existsSync(modelFilePath);
    if (rc.request.method.toLowerCase() === 'post' && modelTypePrefix === 'object' && urlParts.query.hasOwnProperty("create") && urlParts.query.create === '') {
        logger.info("Creating new list model at " + modelFilePath);
        if (fileExists) {
            console.error("List model already exists at " + modelFilePath);
            rc.response.writeHead(404, {
                "error-message": "List model already exists at " + modelFilePath
            });
            rc.response.end();
        } else {
            fs.writeFileSync(modelFilePath, '[]', 'utf8');
            logger.info("Created new list model at " + modelFilePath);
            utils.writeResponse(rc.response, 201, {
                "Content-Type": "application/json; charset=utf-8",
                "Location": "http://" + rc.request.headers.host + "/ps/rest/" + modelTypePrefix + "/" + modelPath
            }, '[]');
        }
        return;
    }
    var data;
    var idPart;
    if (!fileExists) {
        var higherModelPath = modelPath.substring(0, modelPath.lastIndexOf('/'));
        var higherModelFilePath = rc.runtime.constructProjectPath(higherModelPath + ".json");
        var higherModelFileExists = fs.existsSync(higherModelFilePath);
        idPart = modelPath.substring(modelPath.lastIndexOf('/') + 1);
    } else {
        data = rc.runtime.readFile(modelFilePath);
    }
    if (isObjectModel) {
        handleObjectModelRequest();
    } else {
        handleListModelRequest();
    }
};
module.exports = handleRestData;