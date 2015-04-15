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
function ProtostarRuntimeShortcuts(runtimeActions){

    this.shortCutMapping = {
        // you can map a shortcut directly to a runtime action name (see runtimeActions.js)
        "alt shift r": "toggleRtl",

        // you can also call a runtime action with additional args and provide appropriate label and description
        "alt shift l" : {
            label: "List templates",
            description: "Lists all prototype fragments that end up as full HTML page",
            invoke: function () {
                runtimeActions.invoke("changeLocation", "?command=list-all");
            }
        },
        "alt shift c" : {
            label: "Compile all",
            description: "Constructs full HTML pages alongside the fragments with '-compiled' suffix",
            invoke: function () {
                runtimeActions.invoke("changeLocation", "?command=compile_all");
            }
        },
        "alt shift d" : {
            label: "Delete all compiled",
            description: "Deletes all compiled full HTML files with '-compiled' filename suffix" ,
            invoke: function () {
                runtimeActions.invoke("changeLocation", "?command=delete_compiled");
            }
        },
        "alt shift o" : {
            label: "List all referencing fragments",
            description: "Lists all fragments that contains one or more references to other fragments",
            invoke: function () {
                runtimeActions.invoke("changeLocation", "?command=list-referencing");
            }
        },
        "alt shift e" : {
            label: "Edit current fragment source",
            description: "Opens current fragment in the web-based code editor",
            invoke: function () {
                runtimeActions.invoke("changeLocation", "?edit");
            }
        },
        "alt shift h" : {
            label: "Help",
            description: "Show Protostar help",
            invoke: function () {
                runtimeActions.invoke("changeLocation", "/psHelp");
            }
        },
        "alt shift k" : {
            label: "Project config",
            description: "Display the config editor for settings related to this project (altering prototype.json)",
            invoke: function () {
                runtimeActions.invoke("changeLocation", "/projectConfig");
            }
        },
        "alt shift i" : {
            label: "Go home",
            description: "Navigates to the root, eg http://localhost:8888/",
            invoke: function () {
                runtimeActions.invoke("changeLocation", "/");
            }
        },
        "alt shift t" : {
            label: "List all referenced fragments",
            description: "Lists all fragments that are being referenced from somewhere in the project",
            invoke: function () {
                runtimeActions.invoke("changeLocation", "?command=list-referenced");
            }
        },
        "alt shift a" : {
            label: "List all HTML files",
            description: "Lists all HTML fragments in the project (regardless of role)",
            invoke: function () {
                runtimeActions.invoke("changeLocation", "?command=list");
            }
        },
        "alt shift s": "saveRtfChanges",
        "alt shift g": "toggleOutlineBlocks",
        "alt shift m": "toggleRuntimeMenu"
    };

    this.listener = new runtimeActions.window.keypress.Listener();

    this.setupShortcutListener = function(shortCut, act){
        var listener = this.listener;
        var sc = shortCut;
        if(typeof act === 'string'){

            listener.simple_combo(sc, function(){
                runtimeActions.invoke(act);
            });

        }else if(typeof act === 'function'){
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

    this.setup = function(){
        for(var sc in this.shortCutMapping){
            var act = this.shortCutMapping[sc];
            this.setupShortcutListener(sc, act);
        }
    };



}
