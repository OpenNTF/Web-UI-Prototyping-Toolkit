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
        var document = window.document;
        function ProtostarPopup(url, x, y, height, width, parent, toggleClassname, shortcut){
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
                if(!this.findMenu()){
                    //this.createMenu();
                }
                var that = this;
                function clickListenerFn(evt){
                    console.log("CLICK!", evt.target);
                    that.toggleMenu();
                    evt.preventDefault();
                }

                if(typeof this.shortcut === 'string' && typeof window.keypress === 'object' && window.keypress.hasOwnProperty('Listener')){
                    console.log("Found shortcut && keypress, assigning " + this.shortcut);
                    this.keyListener = new window.keypress.Listener();
                    this.keyListener.simple_combo(this.shortcut, function () {
                        console.log("toggle menu");
                        that.toggleMenu();
                    });
                    console.log("Assigned shortcut " + this.shortcut + " to display the protostar ux.")
                }else{
                    console.warn("Keypress.js not found, not assigning shortcut " + this.shortcut + " to display protostar ux");
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
                    var correctedHeight = this.height + 20;
                    this.menu.style.height = correctedHeight + 'px';
                    this.menuFrame.height = this.height;
                }
            };
            this.setWidth = function(width){
                this.width = width;
                if(this.findMenu()){
                    var correctedWidth = this.width + 16;
                    this.menu.style.width = correctedWidth + 'px';
                    this.menuFrame.width = correctedWidth;
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
                    if(menuWidth !== '' + (t.width + 16)+'px'){
                        var newWidth = parseInt(menuWidth.replace('px', ''));
                        console.log("new width=", newWidth);
                        t.menuFrame.width = newWidth;
                        t.width = (newWidth-16);
                    }
                    var menuHeight = t.menu.style.height;

                    if(menuHeight !== '' + (t.height+20)+'px'){
                        var newHeight = parseInt(menuHeight.replace('px', ''))-20;
                        console.log("new height = " + newHeight);
                        t.menuFrame.height = newHeight;
                        t.height = newHeight;
                    }
                }, 200);
            };
            this.stopListeningResize = function(){
                clearInterval(this.resizeInterval);
            };
            this.createMenu = function() {
                var correctedHeight = this.height + 20;
                var correctedWidth = this.width + 16;
                var td = document.createElement('div');

                td.innerHTML += '<div id="'+this.menuContainerDivId+'" class="ps-ux-container" style="resize:both;overflow:auto;cursor:move;border-radius:5px;display:none;position:absolute;top:'+this.x+'px;left:'+this.y+'px;height:'+correctedHeight+'px;width:'+correctedWidth+'px;padding:10px;padding-top:10px"><small><a href="javascript:void(0)" id="psMenuHide" style="float:right">Hide</a></small><br/><iframe id="'+this.menuFrameId+'" style="border:0" src="'+this.url+'" height="'+this.height+'" width="'+correctedWidth+'"></iframe></div>';
                var menu = td.childNodes.item(0);
                this.parent.appendChild(menu);
                this.menu = menu;
                var t = this;
                this.menuFrame = this.findMenuFrame();
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
            var p = new ProtostarPopup();
            p.toggleClassname = 'protostar-menu-toggle';
            p.init();
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
        window.protostar.popup = createInterfaceObject();
        console.info("The protostar popup menu object is available at window.protostar.popup");
    }


})(window);
