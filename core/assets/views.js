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
    $(".psActionMenuToggle").click(toggleActionMenu);
    function toggleRTL(){
        $("body").toggleClass("rtl");
    }
    function changeLocation(location){
        window.location = location;
    }

    function showHelp(){
        changeLocation("/pshelp");
    }

    function gotoIndex(){
        changeLocation("/");
    }

    function saveRtfChanges(){
        $('*[data-editable]').each(function(){
            var id = $(this).attr("id");
            var partname = $(this).attr("data-editable");
            var content = window.CKEDITOR.instances[id].getData();
            console.log("Saving id="+id + " partname="+partname + " =  " + content);
            $.ajax({
                type:"put",
                url:"/ps/update/part",
                data: JSON.stringify({
                    id: id,
                    partname: partname,
                    content: content
                }),
                dataType:"json",
                contentType: "application/json",
                mimeType: "application/json",
                success: function(){
                    console.log("SUCCESS");
                    notifySuccess("Saved updated text for " + partname + "#" + id);
                }
            });
        });

    }

    function toggleOutlineBlocks(){
        if($("body").hasClass("ps-show-outlines")){
            $("body").removeClass("ps-show-outlines");
            $(".row").css("border", "inherit");
            $(".portlet").css("border", "inherit");
            $("div").css("border", "inherit");
            var colTypes = ['xs', 'sm', 'md', 'lg'];
            for(var c = 0 ; c < colTypes.length ; c+=1){
                for(var s = 1 ; s < 13 ; s+=1){
                    var sel = '.col-' + colTypes[c] + '-' + s;
                    $(sel).css("border", "inherit");
                }
            }
        }else{
            $("body").addClass("ps-show-outlines");
            $("div").css("border", "1px solid pink");
            $(".row").css("border", "4px solid yellow");


//        $(sel).css("border", "1px solid red");
            var colTypes = ['xs', 'sm', 'md', 'lg'];
            for(var c = 0 ; c < colTypes.length ; c+=1){
                for(var s = 1 ; s < 13 ; s+=1){
                    var sel = '.col-' + colTypes[c] + '-' + s;
                    $(sel).css("border", "2px solid green");
                }
            }
            $(".portlet").css("border", "3px solid red");
        }

    }

    var listener = new window.keypress.Listener();
    var comboModifiers = "alt shift ";
    listener.simple_combo(comboModifiers+"r", function() {
        toggleRTL();
    });
    listener.simple_combo(comboModifiers+"l", function() {
        changeLocation("?command=list");
    });
    listener.simple_combo(comboModifiers+"c", function() {
        changeLocation("?command=compile_all");
    });
    listener.simple_combo(comboModifiers+"d", function() {
        changeLocation("?command=delete_compiled");
    });
    listener.simple_combo(comboModifiers+"o", function() {
        changeLocation("?command=list-referencing");
    });
    listener.simple_combo(comboModifiers+"b", function() {
        changeLocation("?command=list-referencing-bare");
    });
    listener.simple_combo(comboModifiers+"e", function() {
        changeLocation(window.location.pathname + "?edit");
    });
    listener.simple_combo(comboModifiers+"h", function() {
        showHelp();
    });
    listener.simple_combo(comboModifiers+"i", function() {
        gotoIndex();
    });
    listener.simple_combo(comboModifiers+"t", function() {
        changeLocation("?command=list-referenced");
    });
    listener.simple_combo(comboModifiers+"a", function() {
        changeLocation("?command=list-all");
    });
    listener.simple_combo(comboModifiers+"s", function() {
//        changeLocation("?command=list-all");
        saveRtfChanges();
    });

    listener.simple_combo(comboModifiers+"g", function() {
        toggleOutlineBlocks()

    });
    listener.simple_combo(comboModifiers + "m", function(){
        toggleActionMenu();
    })

    function appendToTop(markup) {
        if($("body > .container").length > 0){
            $("body > .container").first().prepend($(markup));
        }else{
            $("body").prepend($(markup));
        }


    }

    function toggleActionMenu(){
        if($("#psActionMenu").length < 1){
            $.ajax({
                url: "/ps/dynamic/commandNames",
                dataType: "json",
                contentType: "application/json",
                mimeType: "application/json",
                type: "get",
                success: function(commandNames){
                    var markup = '<ul>';
                    commandNames.forEach(function(cn){
                        markup += '<li><a href="?command='+cn+'">'+cn+'</a></li>'
                    });
                    markup += '</ul>';
                    markup += '<ul>';
                    ['source', 'sourceClean', 'edit', 'cheese', 'validate'].forEach(function(cn){
                        markup += '<li><a href="?'+cn+'">'+cn+'</a></li>'
                    });
                    markup += '</ul><ul id="psFunctionActions"></ul>'
                    $("body").append('<div id="psActionMenu" draggable="true" style="display:none;position:absolute;border-radius:10px;border:solid 2px rgba(0,0,0,0.5);background-color:rgba(255,255,255,0.95);z-index:1000;left:10px;top:10px;width:200px;padding-right:10px">'+markup+'</div>');
                    var functionCmds = {
                        "Help" : showHelp,
                        "Go to index" : gotoIndex,
                        "Toggle Outlining" : toggleOutlineBlocks,
                        "Toggle RTL" : toggleRTL,
                        "Save RTF Changes" : saveRtfChanges
                    };
                    var functParent = $("#psFunctionActions");
                    var functIdx = 0;
                    for(var fname in functionCmds){
                        functIdx+=1;
                        var fm = '<li><a id="psFunctCmd_'+functIdx+'" href="javascript:;">'+fname+'</a></li>';
                        functParent.append(fm);
                        $("#psFunctCmd_" + functIdx).click(functionCmds[fname]);


                    }
                    function addListeners(){
                        function mouseUp()
                        {
                            window.removeEventListener('mousemove', divMove, true);
                        }
                        function mouseDown(e){
                            console.log("MOUSEDOWN:", e);
                            window.addEventListener('mousemove', divMove, true);
                        }
                        function divMove(e) {
                            var div = document.getElementById('psActionMenu');
                            div.style.position = 'absolute';
                            div.style.top = e.clientY + 'px';
                            div.style.left = e.clientX + 'px';
                        }
                        document.getElementById('psActionMenu').addEventListener('mousedown', mouseDown, false);
                        window.addEventListener('mouseup', mouseUp, false);
                    }
                    addListeners();
                    //$(".psActionMenuToggle").each(function(){$(this)[0].onclick = toggleActionMenu});
//                    $(".psActionMenuToggle").click(toggleActionMenu);
                    $("#psActionMenu").fadeIn();
                }
            });
        }else{
            $("#psActionMenu").css('display', $("#psActionMenu").css("display") === 'block' ? 'none' : 'block');
        }
    }

    function notifyError(msgMarkup) {
        appendToTop($('<div class="alert alert-danger">' + msgMarkup + '</div>'));
    }

    function notifyWarning(msgMarkup) {
        appendToTop($('<div class="alert alert-warning">' + msgMarkup + '</div>'));
    }

    function notifySuccess(msgMarkup) {
        appendToTop($('<div class="alert alert-success">' + msgMarkup + '</div>'));
    }

    function notifyInfo(msgMarkup) {
        appendToTop($('<div class="alert alert-info">' + msgMarkup + '</div>'));
    }

    function updateEntityFieldValue(args) {
        console.log("Updating entityField value: ", args);
        $.ajax({
            type: "put",
            url: args.baseUrl + "resource/" + args.entityType.toLowerCase(),
            data: JSON.stringify({
                id: args.entityId,
                fieldName: args.fieldName,
                value: args.value
            }),
            dataType: "json",
            contentType: "application/json",
            mimeType: "application/json"

        })
            .always(function (data, status) {
                console.log("Done: ", arguments);
                if (parseInt((status, 10) - 200) < 10) {
                    notifySuccess("Updated page text");
                } else {
                    notifyError("Could not update page text");
                }

            });
    }


    $("*[data-editable]").each(function(idx, itm){
        var config = {
//            customConfig: '/libs/ckeditor/config.js',
            language: "en",
            toolbar: [
                {
                    name: 'document',
                    groups: [ 'mode', 'document', 'doctools' ],
                    items: [ 'Sourcedialog', '-', 'Save', 'NewPage', 'Preview', 'Print', '-', 'Templates' ]
                },
                { name: 'clipboard', groups: [ 'clipboard', 'undo', 'styling'], items: [ 'Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo', '-', /* 'Styles',*/ 'Format', /*'Font',*/ 'FontSize' ] },
                { name: 'editing', groups: [ 'find', 'selection', 'spellchecker' ], items: [ 'Find', 'Replace', '-', 'SelectAll' /*'-', 'Scayt' */] },
                //{ name: 'forms', items: [ 'Form', 'Checkbox', 'Radio', 'TextField', 'Textarea', 'Select', 'Button', 'ImageButton', 'HiddenField' ] },
                '/',
                { name: 'basicstyles', groups: [ 'basicstyles', 'cleanup' ], items: [ 'Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'RemoveFormat' ] },
                { name: 'paragraph', groups: [ 'list', 'indent', 'blocks', 'align', 'bidi' ], items: [ 'NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote', 'CreateDiv', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock'/*, '-', 'BidiLtr', 'BidiRtl'*/ ] },
                { name: 'links', items: [ 'Link', 'Unlink', 'Anchor' ] },
                { name: 'insert', items: [ 'Image', 'Flash', 'Table', 'HorizontalRule', 'Smiley', 'SpecialChar'/*, /*'PageBreak', 'Iframe'*/ ] },
                '/',
//            { name: 'styles', items: [/* 'Styles',*/ 'Format', /*'Font',*/ 'FontSize' ] },
                //{ name: 'colors', items: [ 'TextColor', 'BGColor' ] },
                { name: 'tools', items: [ 'Maximize', 'ShowBlocks' ]}/*,
                 { name: 'others', items: [ '-' ] },
                 { name: 'about', items: [ 'About' ] }         */
            ],
            "extraPlugins": "sourcedialog,imagebrowser",
            "removePlugins": "sourcearea",
            allowedContent: true,
            "imageBrowser_listUrl": "/ps/dynamic/images.json" //"${appRoot}upload/thumbnails/small/images/large/default"
        };

//        var imageBrowserImagesUrl = "/images.json";//viewCfg.imageBrowserImagesUrl; //"${appRoot}upload/thumbnails/small/images/large/default"
        var editableId = $(this).attr('id');
        var partName = $(this).attr('data-editable');
        var initText = $(this)[0].innerHTML + '';
        var changedText = initText;
        $(".currentPageLinks .saveChangesButton").click(function () {
            console.log("Changed text to '" + changedText + "'");
            console.log("Updating entityField value: ", args);
            $.ajax({
                type: "put",
                url: "/ps/update/file" + editableId,
                data: JSON.stringify({
                    file: partName,
                    id: editableId,
                    source: window.location.pathname,
                    value: changedText
                }),
                dataType: "json",
                contentType: "application/json",
                mimeType: "application/json"
            }).always(function (data, status) {
                    console.log("Done: ", arguments);
                    if (parseInt((status, 10) - 200) < 10) {
                        notifySuccess("Updated page text");
                    } else {
                        notifyError("Could not update page text");
                    }

            });
        });
        $(this).blur(function () {
            console.log("Lost selection!");
            console.log("INIT TEXT: " + initText);
            changedText = CKEDITOR.instances[editableId].getData();
            console.log("CHANGED TEXT: " + changedText);
            if (initText !== changedText) {
                console.log("Text changed ! ");
                var b = $(".currentPageLinks .saveChangesButton");
                b.removeClass("disabled");
                b.css("display", "inline");
            }
        });
        CKEDITOR.disableAutoInline = false;
        console.log("Inlining " + editableId);
        CKEDITOR.inline(editableId, config);
//        $('#contentpageContentContainer').attr('contenteditable', 'true');

    });
});