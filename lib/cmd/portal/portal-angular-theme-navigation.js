"use strict";

var portalNavGen = require("../../portalNavigationProducer");

/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var nav = portalNavGen.generateNavigation(rc.project);
    return {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        },
        content: JSON.stringify(nav)
    };
};
module.exports.label = 'Generate Portal Navigation';
module.exports.description = '';
module.exports.noMenu = true;