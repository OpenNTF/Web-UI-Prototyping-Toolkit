(function () {
        "use strict";
        var pageCmds = {};

        pageCmds.go_home = function (window, projectWindow) {
            projectWindow.location = '/index.html';
        };
        pageCmds.go_home.label = 'Go Home';
        pageCmds.go_home.description = '';
        pageCmds.go_home.cat = 'list';

        pageCmds.view_source = function (window, projectWindow) {
            projectWindow.location = projectWindow.location.pathname + '?source';
        };
        pageCmds.view_source.label = 'View Source';
        pageCmds.view_source.description = '';

        pageCmds.view_cleaned_source = function (window, projectWindow) {
            projectWindow.location = projectWindow.location.pathname + '?sourceClean';
        };
        pageCmds.view_cleaned_source.label = 'View Clean Source';
        pageCmds.view_cleaned_source.description = '';

        pageCmds.editCurrent = function (window, projectWindow) {
            projectWindow.location = projectWindow.location.pathname + '?edit';
        };
        pageCmds.editCurrent.label = 'Edit This File';
        pageCmds.editCurrent.description = '';

        pageCmds.screenshutCurrent = function (window, projectWindow) {
            projectWindow.location = projectWindow.location.pathname + '?cheese';
        };
        pageCmds.screenshutCurrent.label = 'Screenshot This Page';
        pageCmds.screenshutCurrent.description = '';


    /* temp disabled
        pageCmds.validateCurrent = function (window, projectWindow) {
            projectWindow.location = projectWindow.location.pathname + '?validate';
        };
        pageCmds.validateCurrent.label = 'Validate This Page';
        pageCmds.validateCurrent.description = '';
    */
        pageCmds.grabImages = function (window, projectWindow) {
            projectWindow.protostar.popup.toggle();
            projectWindow.protostar.grabImages();
        };
        pageCmds.grabImages.label = 'Select And Grab Images';
        pageCmds.grabImages.description = '';

        pageCmds.saveRtfChanges = function (window, projectWindow) {
            projectWindow.protostar.popup.toggle();
            projectWindow.protostar.saveRtfChanges();
        };
        pageCmds.saveRtfChanges.label = 'Save RTF Changes';
        pageCmds.saveRtfChanges.description = '';

        pageCmds.view_help = function (window, projectWindow) {
            projectWindow.location = '/pshelp';
        };
        pageCmds.view_help.label = 'Help';
        pageCmds.view_help.description = '';
        pageCmds.view_help.cat = 'ps';

        pageCmds.download_portal_fstype1 = function (window, projectWindow) {
            projectWindow.alert("todo download_portal_fstype1");
        };
        pageCmds.download_portal_fstype1.label = 'Download Portal Static Files';
        pageCmds.download_portal_fstype1.description = '';
        pageCmds.download_portal_fstype1.cat = 'portal';

        pageCmds.download_packaged_components = function (window, projectWindow) {
            projectWindow.alert("todo download_packaged_components");
        };
        pageCmds.download_packaged_components.label = 'Download Packaged Component Dirs';
        pageCmds.download_packaged_components.description = '';
        pageCmds.download_packaged_components.cat = 'project';

        var inNode = false;
        if (typeof module === 'object' && module.hasOwnProperty('exports') && typeof module.exports === 'object') {
            inNode = true;
        } else {
            if (typeof window.protostar !== 'object') {
                window.protostar = {};
            }
            window.protostar.pageCommands = pageCmds;
        }

        for (var cn in pageCmds) {
            var cmd = pageCmds[cn];
            if (!cmd.hasOwnProperty('cat')) {
                cmd.cat = 'page';
            }
            if (inNode) {
                module.exports[cn] = cmd;
            }
        }
})();
