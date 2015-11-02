(function(window){
    console.log("Running backendCode.js")
    var $ = window.jQuery;

    $('.protostar-runtime-commands *[data-command]').each(function(){
        var l = $(this);
        l.click(function(evt){
            var commandName = $(evt.target).attr('data-command');
            console.log("Clicked command="+commandName);
            var projectWindow = window.projectWindow;
            var newLoc = false;
            switch (commandName){
                case 'go_home': projectWindow.location = '/index.html'; break;
                case 'list-all': window.location = '/?command=list-all'; break;
                case 'list': projectWindow.location = '/?command=list'; break;
                case 'list-referenced': projectWindow.location = '/?command=list-referenced'; break;
                case 'list-referencing': projectWindow.location = '/?command=list-referencing'; break;
                case 'load-all-template-pages': projectWindow.location = '/?command=load-all-template-pages'; break;

                case 'view_source': window.location = projectWindow.location.pathname + '?source'; break;
                case 'view_cleaned_source': window.location = projectWindow.location.pathname + '?sourceCleaned'; break;
                case 'edit': window.location = projectWindow.location.pathname + '?edit'; break;
                case 'cheese': window.location = projectWindow.location.pathname + '?cheese'; break;
                case 'validate': window.location = projectWindow.location.pathname + '?validate'; break;
                case 'grabImages': projectWindow.protostar.popup.toggle();projectWindow.protostar.grabImages(); break;
                case 'saveRtfChanges': projectWindow.protostar.popup.toggle();projectWindow.protostar.saveRtfChanges(); break;
                case 'screenshot-all': window.location = '/?command=screenshot-all'; break;
                case 'validate-all': window.location = '/?command=validate'; break;
                case 'download-zip-build': window.location = '/?command=download-build-zip'; break;


                case 'dxsync_config': window.location = '/?command=list-all'; break;
                case 'dxsync_push': window.location = '/?command=list-all'; break;
                case 'dxsync_pull': window.location = '/?command=list-all'; break;
                case 'wartheme_push': window.location = '/?command=list-all'; break;
                case 'wartheme_pull': window.location = '/?command=list-all'; break;
                case 'scriptportlet_list_pushable': window.location = '/?command=list-scriptportlet-pushable'; break;
                case 'scriptportal_push_all': window.location = '/?command=list-all'; break;
                case 'package_components': window.location = '/?command=list-all'; break;
                case 'download_portal_fstype1': window.location = '/?command=list-all'; break;
                case 'create_theme_war': window.location = '/?command=list-all'; break;
                case 'create_theme_webdav': window.location = '/?command=list-all'; break;

                case 'log_default': window.location = '/?command=log_default'; break;
                case 'log_debug': window.location = '/?command=log_debug'; break;
                case 'log_all': window.location = '/?command=log_all'; break;
                case 'protostar_settings': window.location = '/?command=list-all'; break;
                case 'view_help': window.location = '/pshelp'; break;
                case 'exit': window.location = '/?command=exit'; break;

                default:
                    alert("Unknown command: " + commandName);

                //case 'go_home': projectWindow.location = '/index.html'; break;
            }

        })

    });

})(window);