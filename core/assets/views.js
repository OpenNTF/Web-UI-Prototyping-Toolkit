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

$(function(){

    window.appendToTop = function(markup) {
        if($("body > .container").length > 0){
            $("body > .container").first().prepend($(markup));
        }else if($("body > .container-fluid").length > 0){
            $("body > .container-fluid").first().prepend($(markup));
        }else{
            $("body").prepend($(markup));
        }
    };

    window.notifyError = function(msgMarkup) {
        appendToTop($('<div class="alert alert-danger">' + msgMarkup + '</div>'));
    };

    window. notifyWarning = function(msgMarkup) {
        appendToTop($('<div class="alert alert-warning">' + msgMarkup + '</div>'));
    };

    window. notifySuccess = function(msgMarkup) {
        appendToTop($('<div class="alert alert-success">' + msgMarkup + '</div>'));
    };

    window. notifyInfo = function(msgMarkup) {
        appendToTop($('<div class="alert alert-info">' + msgMarkup + '</div>'));
    };

    //window. updateEntityFieldValue = function(args) {
    //    console.log("Updating entityField value: ", args);
    //    $.ajax({
    //        type: "put",
    //        url: args.baseUrl + "resource/" + args["entityType"].toLowerCase(),
    //        data: JSON.stringify({
    //            id: args["entityId"],
    //            fieldName: args.fieldName,
    //            value: args.value
    //        }),
    //        dataType: "json",
    //        contentType: "application/json",
    //        mimeType: "application/json"
    //
    //    })
    //        .always(function (data, status) {
    //            console.log("Done: ", arguments);
    //            if (parseInt((status, 10) - 200) < 10) {
    //                notifySuccess("Updated page text");
    //            } else {
    //                notifyError("Could not update page text");
    //            }
    //
    //        });
    //};

    window.setupProjectConfigEditor = function(){
        var psEditPrototypeConfigRoot = $(".protostarProjectConfig");
        if(psEditPrototypeConfigRoot.length > 0){
            $("*[data-toggled]").addClass("hidden");
            $("*[data-toggle]").click(function(){
                var t = $(this);
                var nm = t.attr("data-toggle");
                $("*[data-toggled='"+nm+"']").toggleClass("hidden");
                var f = $("*[data-toggled='"+nm+"']").first();
                if(!f.hasClass("hidden")){
                    f.find("input").first().focus();
                }
            });
            function wireFields(cfg){
                for(var k in cfg){
                    console.log(k + "=", cfg[k]);
                }
            }
            $.get("/ps/config/prototype-test.json").then(function(cfg){
                console.log("Config: ", cfg);
                wireFields(cfg);
            });
        }
    };

//    window.setupEditableFragments = function(){
//        $("*[data-editable]").each(function(idx, itm){
//            var config = {
////            customConfig: '/libs/ckeditor/config.js',
//                language: "en",
//                toolbar: [
//                    {
//                        name: 'document',
//                        groups: [ 'mode', 'document', 'doctools' ],
//                        items: [ 'Sourcedialog', '-', 'Save', 'NewPage', 'Preview', 'Print', '-', 'Templates' ]
//                    },
//                    { name: 'clipboard', groups: [ 'clipboard', 'undo', 'styling'], items: [ 'Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo', '-', /* 'Styles',*/ 'Format', /*'Font',*/ 'FontSize' ] },
//                    { name: 'editing', groups: [ 'find', 'selection', 'spellchecker' ], items: [ 'Find', 'Replace', '-', 'SelectAll' /*'-', 'Scayt' */] },
//                    //{ name: 'forms', items: [ 'Form', 'Checkbox', 'Radio', 'TextField', 'Textarea', 'Select', 'Button', 'ImageButton', 'HiddenField' ] },
//                    '/',
//                    { name: 'basicstyles', groups: [ 'basicstyles', 'cleanup' ], items: [ 'Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'RemoveFormat' ] },
//                    { name: 'paragraph', groups: [ 'list', 'indent', 'blocks', 'align', 'bidi' ], items: [ 'NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote', 'CreateDiv', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock'/*, '-', 'BidiLtr', 'BidiRtl'*/ ] },
//                    { name: 'links', items: [ 'Link', 'Unlink', 'Anchor' ] },
//                    { name: 'insert', items: [ 'Image', 'Flash', 'Table', 'HorizontalRule', 'Smiley', 'SpecialChar'/*, /*'PageBreak', 'Iframe'*/ ] },
//                    '/',
////            { name: 'styles', items: [/* 'Styles',*/ 'Format', /*'Font',*/ 'FontSize' ] },
//                    //{ name: 'colors', items: [ 'TextColor', 'BGColor' ] },
//                    { name: 'tools', items: [ 'Maximize', 'ShowBlocks' ]}/*,
//                     { name: 'others', items: [ '-' ] },
//                     { name: 'about', items: [ 'About' ] }         */
//                ],
//                "extraPlugins": "sourcedialog,imagebrowser",
//                "removePlugins": "sourcearea",
//                allowedContent: true,
//                "imageBrowser_listUrl": "/ps/dynamic/images.json"
//            };
//            var editableId = $(this).attr('id');
//            var partName = $(this).attr('data-editable');
//            var initText = $(this)[0].innerHTML + '';
//            var changedText = initText;
//            $(".currentPageLinks .saveChangesButton").click(function () {
//                console.log("Changed text to '" + changedText + "'");
//                console.log("Updating entityField value: ", args);
//                $.ajax({
//                    type: "put",
//                    url: "/ps/update/file" + editableId,
//                    data: JSON.stringify({
//                        file: partName,
//                        id: editableId,
//                        source: window.location.pathname,
//                        value: changedText
//                    }),
//                    dataType: "json",
//                    contentType: "application/json",
//                    mimeType: "application/json"
//                }).always(function (data, status) {
//                    console.log("Done: ", arguments);
//                    if (parseInt((status, 10) - 200) < 10) {
//                        notifySuccess("Updated page text");
//                    } else {
//                        notifyError("Could not update page text");
//                    }
//
//                });
//            });
//            $(this).blur(function () {
//                console.log("Lost selection!");
//                console.log("INIT TEXT: " + initText);
//                changedText = CKEDITOR.instances[editableId].getData();
//                console.log("CHANGED TEXT: " + changedText);
//                if (initText !== changedText) {
//                    console.log("Text changed ! ");
//                    var b = $(".currentPageLinks .saveChangesButton");
//                    b.removeClass("disabled");
//                    b.css("display", "inline");
//                }
//            });
//            CKEDITOR.disableAutoInline = false;
//            console.log("Inlining " + editableId);
//            CKEDITOR.inline(editableId, config);
//        })
//    };


    //window. setupAnyRuntimeMenuToggles = function(){
    //    $(".psActionMenuToggle").click(function(){
    //        pra.invoke("toggleRuntimeMenu");
    //    });
    //};

    window. wireNewPortalThemeMavenProjectFactory = function(){
        var createThemeRoot = $(".protostarNewPortalTheme");
        if(createThemeRoot.length > 0){
            createThemeRoot.find('button[name="create-my-theme"]').click(function(){
                var obj = {};
                createThemeRoot.find("input").each(function(){
                    var t = $(this);
                    obj[t.attr("name")] = t.val();
                });
                console.log("Object = ", obj);
                $.ajax({
                    type: "post",
                    url: "/ps/buildTheme/"+obj.projectName + ".zip",
                    data: JSON.stringify(obj),
                    dataType: "json",
                    contentType: "application/json",
                    mimeType: "application/json"
                }).done(function(data){
                    var auth = data.auth;
                    window.location.pathname = "/ps/buildTheme/"+obj.projectName + ".zip?auth=" + auth;
                }).error(function(){
                    console.error("Error !", arguments);
                });
            });
        }
    };



    //var pra = new ProtostarRuntimeActions(window, $);

    //var rsc = new ProtostarRuntimeShortcuts(pra);
    //rsc.setup();
    //window.setupEditableFragments();
    window.setupProjectConfigEditor();
    window.wireNewPortalThemeMavenProjectFactory();
    //window.setupAnyRuntimeMenuToggles();

});