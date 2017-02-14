(function (window) {
    if(window.onload){
        var c = window.onload;
        window.onload = function(){
            try{
                c();
            }catch(e){
                console.error("Error in pre-existing onload before protostar ux:", e);
            }
            setupProtostarUX();
        }
    }else{
        window.onload = function(){
            setupProtostarUX();
        }
    }



    function setupProtostarUX(){

        /**
         *
         * @param {NodeList} nl
         * @param {Function} fn
         */
        function forNodeList(nl, fn){
            if(!nl instanceof NodeList) throw new Error("first arg should be a NodeList");
            for(var i = 0 ; i < nl.length ; i+=1){
                fn(nl[i], i);
            }
        }
        var document = window.document;
        function PopupFrame(url, x, y, height, width, parent, toggleClassname, shortcut){
            var heightCorrection = 60;
            var widthCorrection = 25;
            this.parent = parent || document.body;
            this.x = x || 5;
            this.y = y || 5;
            this.height = height || 480;
            this.width = width || 320;
            this.url = url || '/pshelp';
            this.shortcut = shortcut || 'alt shift m';
            this.toggleClassname = toggleClassname;

            this.menuContainerDivId = 'psActionMenu';
            this.menuFrameId = 'psActionMenuFrame';
            this.menuHideLinkId = 'psMenuHide';

            this.keyListener = null;
            this.menu = null;
            this.menuFrame = null;
            this.visible = false;
            this.resizeInterval = null;

            this.init = function(){
                var that = this;
                function clickListenerFn(evt){
                    that.toggleMenu();
                    evt.preventDefault();
                }



                if(typeof this.toggleClassname === 'string' ){
                    var tels = document.getElementsByClassName(this.toggleClassname);
                    for(var i = 0 ; i < tels.length ; i++){
                        tels[i].addEventListener('click', clickListenerFn, false);
                        console.log("Element is wired to display the protostar ux on click:", tels[i]);
                    }

                }else{
                    console.warn("No toggle classnames provided; there will be no clickable elements to display the protostar ux.");
                }
            };

            this.findMenu = function() {
                return document.getElementById(this.menuContainerDivId);
            };

            this.findMenuFrame = function(){
                return document.getElementById(this.menuFrameId);
            };

            this.showMenu = function() {
                if(!this.findMenu()){
                    this.createMenu();
                }
                this.menu.style.display = "block";
                this.visible = true;
            };
            this.changeUrl = function(url){
                this.menuFrame.src = url;
            };

            this.hideMenu = function() {
                var m = this.menu;
                m.style.display = "none";
                this.visible = false;
            };
            this.setHeight = function(height){
                this.height = height;
                if(this.findMenu()){
                    var correctedHeight = this.height + heightCorrection;
                    this.menu.style.height = correctedHeight + 'px';
                    this.menuFrame.height = this.height;
                }
            };
            this.setWidth = function(width){
                this.width = width;
                if(this.findMenu()){
                    var correctedWidth = this.width + widthCorrection;
                    this.menu.style.width = correctedWidth + 'px';
                    this.menuFrame.width = this.width;
                    this.menuFrame.style.width= this.width + 'px';
                }
            };
            this.toggleMenu = function() {
                if (this.visible) {
                    this.hideMenu();
                } else {
                    this.showMenu();
                }
            };
            this.startListeningResize = function(){
                var t = this;
                this.resizeInterval = setInterval(function(){
                    var menuWidth = t.menu.style.width;
                    if(menuWidth !== '' + (t.width + widthCorrection)+'px'){
                        var newWidth = parseInt(menuWidth.replace('px', ''));
                        t.menuFrame.width = (newWidth - widthCorrection);
                        t.width = (newWidth);
                    }
                    var menuHeight = t.menu.style.height;

                    if(menuHeight !== '' + (t.height+heightCorrection)+'px'){
                        var newHeight = parseInt(menuHeight.replace('px', ''))-heightCorrection;
                        t.menuFrame.height = newHeight;
                        t.height = newHeight;
                    }
                }, 200);
            };
            this.stopListeningResize = function(){
                clearInterval(this.resizeInterval);
            };
            this.createMenu = function() {
                var correctedHeight = this.height + heightCorrection;
                var correctedWidth = this.width + widthCorrection;
                var td = document.createElement('div');

                    td.innerHTML += '<div id="'+this.menuContainerDivId+'" class="ps-ux-container" style="resize:both;overflow:auto;cursor:move;border-radius:5px;display:none;position:fixed;top:'+this.x+'px;left:'+this.y+'px;height:'+correctedHeight+'px;width:'+correctedWidth+'px;padding:10px;padding-top:10px"><small><a href="javascript:void(0)" id="psMenuHide" style="float:right">Hide</a></small><br/><iframe id="'+this.menuFrameId+'" style="border:0" src="'+this.url+'" height="'+this.height+'" width="'+this.width+'" name="'+this.menuFrameId+'"></iframe></div>';
                var menu = td.childNodes.item(0);


                this.parent.appendChild(menu);


                this.menu = menu;
                var t = this;
                this.menuFrame = this.findMenuFrame();
                this.menuFrame.addEventListener('load', function(){
                    console.log("Frame loaded");
                    for(var i = 0 ; i < window.frames.length ; i+=1){
                        var f= window.frames[i];
                        if(f.name === t.menuFrameId){
                            f.window.projectWindow = window;
                            f.window.projectProtostar = window.protostar;
                            protostar.fireEvent('loaded-in-iframe', f.window.document.body);
                        }
                    }
                });
                this.startListeningResize();
                menu.style.background = '#DDD';
                menu.style.border = '1px solid #EEE';
                var hideLink = document.getElementById(this.menuHideLinkId);

                hideLink.onclick = function () {
                    t.hideMenu();
                };
                var menuDraggingState = function () {
                    return {
                        move: function (element, newLeft, newTop) {
                            element.style.left = newLeft + 'px';
                            element.style.top = newTop + 'px';
                        },
                        startMoving: function (element, containerElement, evt) {
                            evt = evt || window.event;
                            var elementWidth = parseInt(element.style.width);
                            var elementHeight = parseInt(element.style.height);
                            var containerWidth = parseInt(containerElement.style.width);
                            var containerHeight = parseInt(containerElement.style.height);
                            var diffX = evt.clientX - element.style.left.replace('px', '');
                            var diffY = evt.clientY - element.style.top.replace('px', '');
                            function handleMove(evt) {
                                evt = evt || window.event;
                                var posX = evt.clientX;
                                var posY = evt.clientY;
                                var newLeft = posX - diffX;
                                var newTop = posY - diffY;

                                if (newLeft < 0) newLeft = 0;
                                if (newTop < 0) newTop = 0;
                                if (newLeft + elementWidth > containerWidth) newLeft = containerWidth - elementWidth;
                                if (newTop + elementHeight > containerHeight) newTop = containerHeight - elementHeight;
                                menuDraggingState.move(element, newLeft, newTop);
                            }
                            document.onmousemove = handleMove;
                        },
                        stopMoving: function () {
                            document.onmousemove = function () {};
                        }
                    }
                }();
                this.menu.addEventListener("mousedown", function (event) {
                    menuDraggingState.startMoving(t.menu, document.body, event);
                });

                this.menu.addEventListener("mouseup", function () {
                    menuDraggingState.stopMoving(document.body)
                });
            }
        }



        function createInterfaceObject(){
            var p = new PopupFrame('/pscmds');
            p.toggleClassname = 'protostar-menu-toggle';
            p.init();
            if(protostar.keyListener){
                console.log("Found shortcut && keypress, assigning alt-shift-m");

                protostar.keyListener.simple_combo("alt shift m", function () {
                    p.toggleMenu();
                });
                console.log("Assigned shortcut alt-shift-m to display the protostar ux.")
            }else{
                console.warn("Keypress.js not found, not assigning shortcut to display protostar ux");
            }
            var control = {
                toggle: function () {
                    p.toggleMenu();
                },
                show: function () {
                    p.showMenu();
                },
                hide: function () {
                    p.hideMenu();
                },
                changeUrl: function (url) {
                    p.changeUrl(url);
                },
                setHeight: function (height) {
                    p.setHeight(height);
                },
                setWidth: function (width) {
                    p.setWidth(width);
                }
            };
            return control;
        }
        if(!window.hasOwnProperty("protostar")){
            window.protostar = {};
        }
        var protostar = window.protostar;
        /**
         *
         * @type {keypress.Listener}
         */
        protostar.keyListener = '';
        if(typeof window.keypress === 'object' && window.keypress.hasOwnProperty('Listener')){

            protostar.keyListener = new window.keypress.Listener();
        }else{
            protostar.keyListener = false;
        }

        window.protostar.popup = createInterfaceObject();





        console.info("The protostar popup menu object is available at window.protostar.popup");
        console.info("Protostar AJAX function at protostar.ajaxRequest()");

        function grabImages(window){

            if(document.getElementById('ps-action-grab-images-container')){
                var el = document.getElementById('ps-action-grab-images-container');
                el.parentElement.removeChild(el);
                return;
            }

            var grabable = [];
            var nodeList = window.document.querySelectorAll('img[src]');
            var uniGrab = {};
            forNodeList(nodeList, function(node){
                var src = node.getAttribute("src");
                if(src.indexOf('https') === 0 || src.indexOf('http') === 0 || src.indexOf('//') === 0){
                    var width = node.clientWidth;
                    var height = node.clientHeight;
                    if(!uniGrab.hasOwnProperty(src)){
                        console.log("Found : ", src);
                        grabable.push({
                            src: src,
                            height:height,
                            width:width
                        });
                        uniGrab[src] = 1;
                    }

                }
            });


            var all = document.body.getElementsByTagName("*");
            forNodeList(all, function(el){
                var bim = el.style.backgroundImage;
                if(bim.length > 0 && bim.trim().indexOf('url("http')>=0){
                    console.log("CSS BACKBROUND IMAGE = "+el.style.backgroundImage);
                    var theSrc = bim.substring(bim.indexOf('"http') + 1, bim.lastIndexOf('"'));
                    if(!uniGrab.hasOwnProperty(theSrc)){
                        grabable.push({src: theSrc,height:0,width:0});
                        uniGrab[theSrc] = 1;
                    }

                }
            });
            console.log("Grabable images : ", grabable);
            var div =window.document.createElement('div');
            div.setAttribute('id','ps-action-grab-images-container');
            div.setAttribute('style','position:absolute;top:100px;padding:5px;left:100px;z-index: 8888;height:700px;width:600px;background-color:#CCC;overflow:auto');
            div.innerHTML = '<ul></ul>' +
                '<p><button type="button" class="btn btn-primary ps-action-grab-images">Grab images</button> <button type="button" class="btn btn-default ps-action-grab-images-cancel">Cancel</button></p>';

            var imgList = div.querySelector("ul");

            forNodeList(grabable, function(i, idx){
                var li  = window.document.createElement('li');
                li.innerHTML = '<li style="border-bottom:1px solid #666"><img src="'+ i.src+'" style="height:5em">  <label for="ps_input_'+idx+'"><input id="ps_input_'+idx+'"type="checkbox" name="grab_'+idx+'"/> <small>'+ i.width + 'x'+ i.height+'</small> <a href="'+ i.src+'" target="_blank"><span>'+i.src+'</span></a></label></li>';
                imgList.appendChild(li);
            });
            window.document.body.appendChild(div);
            var imgContainer = window.document.getElementById('ps-action-grab-images-container');

            var clickedGrab = function () {
                var toGrab = [];
                forNodeList(imgContainer.querySelectorAll('input[type="checkbox"]:checked'), function (chb) {
                    var nm = chb.name;
                    var idx = parseInt(nm.substring(nm.indexOf('_') + 1));
                    console.log('GRAB ', grabable[idx].src);
                    toGrab.push(grabable[idx].src);
                });
                if (toGrab.length > 0) {
                    protostar.ajaxRequest('/ps/grabImages', {
                        'Content-Type': 'application/json',
                        'Accept': 'text/plain'
                    }, JSON.stringify(toGrab), function () {
                        console.log("Submitted " + toGrab.length + " images to grab : ", toGrab);
                    });
                }
                imgContainer.parentElement.removeChild(imgContainer);
            };

            forNodeList(imgContainer.querySelectorAll('button.ps-action-grab-images'), function(n){
                n.addEventListener('click', clickedGrab);
            });

            forNodeList(imgContainer.querySelectorAll('button.ps-action-grab-images-cancel'), function(n){
                n.addEventListener('click', function(){
                    imgContainer.parentElement.removeChild(imgContainer);
                });
            });
        }

        function saveRtfTextChanges(window) {
            var editables = window.document.querySelectorAll('*[data-editable]');
            forNodeList(editables, function (n) {
                var id = n.getAttribute("id");
                var partname = n.getAttribute("data-editable");
                var content = window.CKEDITOR.instances[id].getData();
                console.log("Saving id=" + id + " partname=" + partname + " =  " + content);
                protostar.ajaxRequest("/ps/update/part", {
                    'Content-Type':'application/json',
                    'Accept':'application/json'
                }, JSON.stringify({
                    id: id, partname: partname, content: content
                }), function(){
                    console.info("Saved updated text for " + partname + "#" + id);
                }, 'PUT');
            });
        }


        var loadJS = function(src, callback) {
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onreadystatechange = s.onload = function() {
                var state = s.readyState;
                if (!callback.done && (!state || /loaded|complete/.test(state))) {
                    callback.done = true;
                    callback();
                }
            };
            document.getElementsByTagName('body')[0].appendChild(s);
        };

        var setupEditableFragments = function(window){
            forNodeList(window.document.querySelectorAll('*[data-editable]'), function(n, idx){
                var config = {
//            customConfig: '/libs/ckeditor/config.js',
                    language: "en",
                    readOnly: false,
                    toolbar: [
                        {
                            name: 'document',
                            groups: [ 'mode', 'document', 'doctools' ],
                            items: [ 'Sourcedialog', 'Save', 'NewPage', 'Preview', 'Print', '-', 'Templates' ]
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
                    "imageBrowser_listUrl": "/ps/dynamic/images.json"
                };
                var editableId = n.getAttribute('id');
                var partName = n.getAttribute('data-editable');
                var initText = '';
                var changedText = '';
                var fl = n.addEventListener('focus', function(){
                    setTimeout(function(){
                        initText = CKEDITOR.instances[editableId].getData().trim();
                    }, 500);
                    n.removeEventListener('focus', fl);
                });
                n.addEventListener('blur', function () {
                    var currentInstance = CKEDITOR.instances[editableId];
                    changedText = currentInstance.getData().trim();
                    var saveButtonId = editableId + '_saveButton';
                    var sb = window.document.getElementById(saveButtonId);
                    if (initText !== changedText) {
                        console.log("TEXT CHANGED from \n" + initText + "\n   ==> \n" + changedText);
                        if(!sb){
                            sb = window.document.createElement('button');
                            sb.setAttribute('id', saveButtonId);
                            sb.setAttribute('class', "btn btn-primary");
                            sb.setAttribute('type', "button");
                            sb.setAttribute('style', "position:relative");
                            sb.innerHTML = 'Save changes to this editor';
                            currentInstance.element.$.parentElement.insertBefore(sb, currentInstance.element.$);

                            sb = window.document.getElementById(saveButtonId);

                            sb.addEventListener('click', function(){
                                console.log("Saving id=" + editableId + " partname=" + partName + " =  " + currentInstance.getData().trim());
                                protostar.ajaxRequest("/ps/update/part", {
                                    'Content-Type':'application/json',
                                    'Accept':'application/json'
                                }, JSON.stringify({
                                    id: editableId,
                                    partname: partName,
                                    content: currentInstance.getData().trim()
                                }), function(){
                                    console.info("Saved updated text for " + partName + "#" + editableId);
                                    sb.parentElement.removeChild(sb);
                                }, 'PUT');
                            })
                        }
                    }else{
                        console.log("Text for editor " + editableId + " not changed");
                        if(sb){
                            sb.parentElement.removeChild(sb);
                        }
                    }
                });
                CKEDITOR.disableAutoInline = false;
                console.log("Inlining " + editableId);
                CKEDITOR.inline(editableId, config);
            });
        };


        /**
         * IE 5.5+, Firefox, Opera, Chrome, Safari XHR object
         *
         * @param {String} url
         * @param {Object.<String,String>} headers
         * @param {String} data
         * @param {Function} callback
         */
        protostar.ajaxRequest = function(url, headers, data, callback, method){
            var theUrl, theHeaders, theData, cb;
            if(arguments.length < 2){
                throw new Error("expecting min 2 args: url and callback");
            }
            if(typeof url !== 'string'){
                throw new Error("Expecting string url as first arg");
            }
            if(typeof headers === 'function'){
                //only url && callback
                theUrl = url;
                cb = headers;
            }else if(typeof data === 'function'){
                //only url && headers && callback
                theUrl = url;
                theHeaders = headers;
                cb = data;
            }else {
                theUrl = url;
                theHeaders = headers;
                theData = data;
                cb = callback;
            }

            try {
                var x = new(window.XMLHttpRequest || ActiveXObject)('MSXML2.XMLHTTP.3.0');
                if(typeof method === 'string'){
                    x.open(method, theUrl, true);
                }else{
                    x.open(theData ? 'POST' : 'GET', theUrl, true);
                }

                var h;

                if(typeof theHeaders === 'object'){
                    h = theHeaders;
                }else{
                    h= {};
                }
                for(var hn in h){
                    x.setRequestHeader(hn, theHeaders[hn]);
                }
                if(!h.hasOwnProperty('X-Requested-With')){
                    x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                }
                if(theData && !h.hasOwnProperty('Content-type')){
                    x.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                }
                x.onreadystatechange = function () {
                    x.readyState > 3 && cb && cb(x.responseText, x);
                };
                x.send(theData)
            } catch (e) {
                window.console && console.log(e);
            }
        };

        protostar.grabImages = function(){
            grabImages(window);
        };

        protostar.saveRtfChanges = function(){
            saveRtfTextChanges(window);
        };

        /**
         *
         * @param name
         * @param {HTMLElement} element
         */
        protostar.fireEvent = function(name, element){
            if(typeof name !== 'string') throw new Error("Missing event name as first arg");
            if(!(element instanceof HTMLElement)) throw new Error("Second arg must be an html element");
            var event; // The custom event that will be created

            if (document.createEvent) {
                event = document.createEvent("HTMLEvents");
                event.initEvent(name, true, true);
            } else {
                event = document.createEventObject();
                event.eventType = name;
            }
            event.eventName = name;
            if (document.createEvent) {
                element.dispatchEvent(event);
            } else {
                element.fireEvent("on" + event.eventType, event);
            }
        };

        protostar.setupEditableFragments = function(){
            if(typeof window.CKEDITOR !== 'object'){
                console.log("First loading ckeditor ...");
                loadJS('/ps/ext/ckeditor/ckeditor.js', function(){
                    console.log("Loaded ckeditor. Wiring editables ..");
                    setupEditableFragments(window);
                })
            }else{
                setupEditableFragments(window);
            }
        };

        protostar.showKeyboardShortcutsReference = function(){
            var mu = createShortcutReferenceMarkup();
        };


        if(window.document.querySelectorAll('*[data-editable]').length > 0){
            protostar.setupEditableFragments();
        }
        if(protostar.keyListener){
            console.log("Found keypress, assigning shortcut alt-shift-g to grabImages and alt-shift-s to saveRtfChanges");
            //this.keyListener = new window.keypress.Listener();
            protostar.keyListener.simple_combo("alt shift g", function () {
                protostar.grabImages();
            });
            protostar.keyListener.simple_combo("alt shift s", function () {
                protostar.saveRtfChanges();
            });
            console.log("Assigned shortcut " + this.shortcut + " to display the protostar ux.")
        }

        function changeLocation(url){
            window.location = url;
        }

        function ProtostarRuntimeShortcuts(listener){
            this.getMapping = function(){
                return this.shortCutMapping;
            };

            var that = this;
            this.shortCutMapping = {
                // you can map a shortcut directly to a runtime action name (see runtimeActions.js)
                //"alt shift r": "toggleRtl",

                // you can also call a runtime action with additional args and provide appropriate label and description
                "alt shift l" : {
                    label: "List templates",
                    description: "Lists all prototype fragments that end up as full HTML page",
                    invoke: function () {
                        changeLocation("?command=list-all");
                    }
                },
                "alt shift c" : {
                    label: "Compile all",
                    description: "Constructs full HTML pages alongside the fragments with '-compiled' suffix",
                    invoke: function () {
                        changeLocation("?command=compile_all");
                    }
                },
                "alt shift d" : {
                    label: "Delete all compiled",
                    description: "Deletes all compiled full HTML files with '-compiled' filename suffix" ,
                    invoke: function () {
                        changeLocation("?command=delete_compiled");
                    }
                },
                "alt shift o" : {
                    label: "List all referencing fragments",
                    description: "Lists all fragments that contains one or more references to other fragments",
                    invoke: function () {
                        changeLocation("?command=list-referencing");
                    }
                },
                "alt shift e" : {
                    label: "Edit current fragment source",
                    description: "Opens current fragment in the web-based code editor",
                    invoke: function () {
                        changeLocation("?edit");
                    }
                },
                "alt shift h" : {
                    label: "Help",
                    description: "Show Protostar help",
                    invoke: function () {
                        changeLocation("/pshelp");
                    }
                },
                "alt shift k" : {
                    label: "Project config",
                    description: "Display the config editor for settings related to this project (altering prototype.json)",
                    invoke: function () {
                        changeLocation("/projectConfig");
                    }
                },
                "alt shift i" : {
                    label: "Go home",
                    description: "Navigates to the root, eg http://localhost:8888/",
                    invoke: function () {
                        changeLocation("/");
                    }
                },
                "alt shift t" : {
                    label: "List all referenced fragments",
                    description: "Lists all fragments that are being referenced from somewhere in the project",
                    invoke: function () {
                        changeLocation("?command=list-referenced");
                    }
                },
                "alt shift a" : {
                    label: "List all HTML files",
                    description: "Lists all HTML fragments in the project (regardless of role)",
                    invoke: function () {
                        changeLocation("?command=list");
                    }
                },
                "alt shift x" : {
                    label: "Grab Images",
                    description: "Save images in the current page directly to /images with a click",
                    invoke: function(){
                        protostar.grabImages();
                    }
                },
                "alt shift s": {
                    label: "Save Text Editor Changes",
                    description: "Persists modified editable fragments (eg &gt;div data-editable>hey&gt;/div> back to correct fragment",
                    invoke: function(){
                        protostar.saveRtfChanges();
                    }
                },
                "alt shift j" : {
                    label: "Keyboard shortcuts",
                    description: "Show an overview of available keyboard shorcuts",
                    invoke: function () {
                        toggleShortcutRef();
                        //throw new Error("todo")
                    }
                },
                "alt shift n": {
                    label: "Next",
                    description: "Goes to the (alphabetically) next prototype page, (see alt-shift-L)",
                    invoke: function(){
                        console.log("Go to next for " , window.location.pathname);
                        protostar.ajaxRequest("/ps/dynamic/pageUrls?current="+window.location.pathname+"&go=next", {}, null, function(data){
                            console.log("RESULT = ", arguments);
                            window.location.pathname=data;
                        }, 'get');
                    }
                },
                "alt shift p": {
                    label: "Previous",
                    description: "Goes to the (alphabetically) previous prototype page, (see alt-shift-L)",
                    invoke: function(){
                        console.log("Go to previous for " , window.location.pathname);
                        protostar.ajaxRequest("/ps/dynamic/pageUrls?current="+window.location.pathname+"&go=prev", {}, null, function(data){
                            console.log("RESULT = ", arguments);
                            window.location.pathname=data;
                        }, 'get');
                    }
                }
            };

            this.listener = listener;

            this.setupShortcutListener = function(shortCut, act){
                var listener = this.listener;
                var sc = shortCut;
                if(typeof act === 'function'){
                    listener.simple_combo(sc, function(){
                        act(window, $);
                    });

                }else if(typeof act === 'object'){
                    listener.simple_combo(sc, function(){
                        console.log("Running '" + act.label + "'");
                        act.invoke();
                    });

                }else{
                    console.error("Illegal action entry for shortcut " + sc + ":", act);
                    throw new Error("Unexpected action entry (non function/object)");
                }
            };

            this.createShortcutReferenceMarkup = function(){
                //var actions = _getActions();
                var sc = [];
                var t = this;
                for(var s in this.shortCutMapping){
                    sc.push(s);
                }
                //sc.sort();
                var markup = '<strong style="text-transform: uppercase">Protostar shortcuts</strong><dl>';
                sc.forEach(function(shortcut){
                    var desc = '';
                    var lbl = '';
                    var mapped = t.shortCutMapping[shortcut];
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
                var shortcutReferenceMarkup = '<div id="psShortcutReference" draggable="true" style="position:fixed;border-radius:10px;border:solid 2px rgba(0,0,0,0.5);background-color:rgba(255,255,255,0.95);z-index:1000;left:10px;top:10px;width:350px;padding-right:10px">'+markup+'</div>';
                return shortcutReferenceMarkup;
            };

            this.setup = function(){
                for(var sc in this.shortCutMapping){
                    var act = this.shortCutMapping[sc];
                    this.setupShortcutListener(sc, act);
                }
            };
        }

        var psrs = new ProtostarRuntimeShortcuts(protostar.keyListener);
        psrs.setup();

        function toggleShortcutRef(){
            if(window.document.getElementById('psShortcutReference')){
                var el = window.document.getElementById('psShortcutReference');
                el.parentElement.removeChild(el);
                return;
            }
            var mu = psrs.createShortcutReferenceMarkup();
            var tmp = window.document.createElement("div");
            tmp.innerHTML = mu;
            var shortCutMenu = tmp.childNodes[0];
            window.document.body.appendChild(shortCutMenu);
        }

    }
})(window);
