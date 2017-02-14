"use strict";
var path = require("path");
var copier = require("../../copier");
var handlebars = require("handlebars");

/**
 *
 * @param {RequestContext} rc
 */
module.exports=function (rc) {
    var pchbs = handlebars.compile(rc.runtime.readAppFile('core', 'assets', 'projectCenter.hbs'));
    var markup = pchbs({});
    rc.composer.renderNewBackendView(markup, {
        title: "Portal Center - Protostar",
        pageTitle: "Portal Center"//,
        //pageSubtitle: ''
    }, rc.response);
};
module.exports.label = 'Portal Center';
module.exports.description = 'Centralized access to Portal Theme and Script Portlet integrations';
module.exports.noMenu = true;
