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
function ProtostarRuntimeActions(window, $){

    this.window = window;
    this.$ = $;
    var that = this;
    var actions = {
        toggleRtl : {
            label: "Toggle RTL",
            description: "Toggles the class 'rtl' on body",
            perform: function(window, $){
                $("body").toggleClass("rtl");
            }
        },
        changeLocation : {
            label: "Change location",
            description: "Changes the window location (requires arg)",
            perform: function(window, $, newLocation){
                if(typeof newLocation !== 'string'){
                    throw new Error("Missing location");
                }
                window.location = newLocation;
            }
        },
        toggleRuntimeShortcutRef : {
            label: "Toggle shortcut reference",
            description: "Displays or hides the protostar in-page shortcuts reference",
            perform : function (window, $, shortcuts){
                if($("#psShortcutReference").length < 1){
                    var actions = _getActions();
                    var sc = [];
                    for(var s in shortcuts){
                        sc.push(s);
                    }
                    sc.sort();
                    var markup = '<h2>Protostar shortcuts</h2><dl>';
                    sc.forEach(function(shortcut){
                        var desc = '';
                        var lbl = '';
                        var mapped = shortcuts[shortcut];
                        if(typeof mapped === 'object'){
                            lbl = mapped.label;
                            desc = mapped.description;
                        }else if(typeof mapped === 'string'){
                            var m  = actions[mapped];
                            lbl = m.label;
                            desc = m.description;
                        }
                        markup += '<dt>'+shortcut+': ' + lbl  + '</dt><dd style="padding-left:15px">'+desc+'</dd>';
                    });
                    markup += '</dl>';
                    $("body").append('<div id="psShortcutReference" draggable="true" style="display:none;position:absolute;border-radius:10px;border:solid 2px rgba(0,0,0,0.5);background-color:rgba(255,255,255,0.95);z-index:1000;left:10px;top:10px;width:350px;padding-right:10px">'+markup+'</div>');

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
                            var div = document.getElementById('psShortcutReference');
                            div.style.position = 'absolute';
                            div.style.top = e.clientY + 'px';
                            div.style.left = e.clientX + 'px';
                        }
                        document.getElementById('psShortcutReference').addEventListener('mousedown', mouseDown, false);
                        window.addEventListener('mouseup', mouseUp, false);
                    }
                    addListeners();
                    $("#psShortcutReference").fadeIn();

                }else{
                    $("#psShortcutReference").css('display', $("#psShortcutReference").css("display") === 'block' ? 'none' : 'block');
                }
            }
        },
        toggleRuntimeMenu : {
            label: "Toggle menu",
            description: "Displays or hides the protostar in-page menu",
            perform : function (window, $){
                if($("#psActionMenu").length < 1){
                    $.ajax({
                        url: "/ps/dynamic/commandNames",
                        dataType: "json",
                        contentType: "application/json",
                        mimeType: "application/json",
                        type: "get",
                        success: function(commandNames){
                            var markup = '<h2>Protostar actions</h2><ul>';
                            commandNames.forEach(function(cn){
                                markup += '<li><a href="?command='+cn+'">'+cn+'</a></li>'
                            });
                            markup += '</ul>';
                            markup += '<ul>';
                            ['source', 'sourceClean', 'edit', 'cheese', 'validate'].forEach(function(cn){
                                markup += '<li><a href="?'+cn+'">'+cn+'</a></li>'
                            });
                            markup += '</ul><ul id="psFunctionActions"></ul>'
                            $("body").append('<div id="psActionMenu" draggable="true" style="display:none;position:absolute;border-radius:10px;border:solid 2px rgba(0,0,0,0.5);background-color:rgba(255,255,255,0.95);z-index:1000;left:10px;top:10px;width:350px;padding-right:10px">'+markup+'</div>');
                            var functionCmds = {
                                "Help" : function(){
                                    that.invoke("changeLocation", "/pshelp");
                                },
                                "Go to index" : function(){
                                    that.invoke("changeLocation", "/");
                                },
                                "Toggle Outlining" : function(){
                                    that.invoke("toggleOutlineBlocks");
                                },
                                "Toggle RTL" : function(){
                                    that.invoke("toggleRtl");
                                },
                                "Save RTF Changes" : function(){
                                    that.invoke("saveRtfChanges");
                                }
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
                            $("#psActionMenu").fadeIn();
                        }
                    });
                }else{
                    $("#psActionMenu").css('display', $("#psActionMenu").css("display") === 'block' ? 'none' : 'block');
                }
            }
        },
        saveRtfChanges: {
            label: "Save rich text changes",
            description: "Saves any rich text changes in this page back to the appropriate fragment",
            perform: function (window, $) {
                $('*[data-editable]').each(function () {
                    var id = $(this).attr("id");
                    var partname = $(this).attr("data-editable");
                    var content = window.CKEDITOR.instances[id].getData();
                    console.log("Saving id=" + id + " partname=" + partname + " =  " + content);
                    $.ajax({
                        type: "put",
                        url: "/ps/update/part",
                        data: JSON.stringify({
                            id: id, partname: partname, content: content
                        }),
                        dataType: "json",
                        contentType: "application/json",
                        mimeType: "application/json",
                        success: function () {
                            console.log("SUCCESS");
                            notifySuccess("Saved updated text for " + partname + "#" + id);
                        }
                    });
                });
            }
        },
        toggleOutlineBlocks : {
            label: "Outline blocks",
            description: "Toggles highlighted styling in the current page for block elements",
            perform:     function (window, $){
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
        }
    };

    var _getActions = function(){return actions;};

    for(var an in actions){
        this[an] = actions[an];
    }
    /**
     * Invokes action with passed name. Additional arguments will be passed to the action function after window and $
     * @param actionName
     */
    this.invoke = function(actionName){
        console.log("Invoking " + actionName);
        var ac = arguments.length;
        var args;
        if(ac < 1){
            throw new Error("Missing actionName arg");
        }else if(ac === 0){
            if(typeof actionName !== 'string'){
                throw new Error("actionName should be string");
            }
            args = [this.window, this.$];
        }else{
            if(typeof actionName !== 'string'){
                throw new Error("actionName should be string");
            }
            args = Array.prototype.slice.call(arguments);
            args.shift();
            args.splice(0, 0, this.window, this.$)
        }

        (this[actionName].perform).apply(this, args);
    }
}
