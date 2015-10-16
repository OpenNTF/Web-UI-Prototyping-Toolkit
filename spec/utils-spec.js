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

var utils = require("../lib/utils");
var wcmTagParser = require("../lib/wcmTagParser");
var path = require("path");

describe("util functions", function(){
    var urls = [
        'js/dev/jquery-1.11.1.js',
        'js/main.js',
        '/ps/ext/boostrap/dist/js/bootstrap.js',
        'https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js',
        'slick/slick.css',
        'less/adp.less?compile',
        'img/ADP-favicon-32x32.png'
    ];

    it("should encode urls", function(){
        var targetDir = "/tmp/tmp";
        var du = utils.createDependencyUrlForTarget("/child/file.html", "../js/main.js", "/tmp/tmp");
        expect(du).toBe("/tmp/tmp/js/main.js");
        urls.forEach(function(u){
            console.log(u + " => " + utils.createDependencyUrlForTarget("/index.html", u, targetDir));
        })

    });
    it("should format bytesizes", function(){
        function testRun(n){
            for(var s in utils.sizeFormatters){
                if(typeof utils.sizeFormatters[s] === 'function'){
                    console.log("FORMAT " + s + " " + n + " : ", utils.formatByteSize(n, s));
                }
            }
        }
        [4320, 23.12*1024*1024, 918*1024*1024*1024].forEach(function(n){
            console.log("SIZE TEST " + n);
            testRun(n);
        })
    });
    it("should correct comment endings", function(){
        var html='<blah><!-- test:test--> <!-- ok:ok --> <!-- test2:test2-->';
        var expected='<blah><!-- test:test --> <!-- ok:ok --> <!-- test2:test2 -->';
        console.log("correcting ...");
        var actual = utils.correctCommentClosings(html);
        console.log("Corrected comments=", actual);
        expect(actual).toBe(expected);


    });


    /*

     [Plugin:Comment compute="once"]
     Some common microformats for active site analytics of web content
     [/Plugin:Comment]




     [Plugin:Comment compute="once"]
     Write the path of the content using the AnalyticsData plugin
     [/Plugin:Comment]




     [Plugin:AnalyticsData property="path" compute="once"]




     [Plugin:Comment compute="once"]
     Write the ID of the content using the AnalyticsData plugin
     [/Plugin:Comment]




     [Plugin:AnalyticsData property="id" compute="once"]




     [Plugin:Comment compute="once"]
     Write the title of the content using the AnalyticsData plugin
     together with a nested [Property] tag to retrieve the title.
     [/Plugin:Comment]




     [Plugin:AnalyticsData css-class="asa.wcm.content_item.title" compute="once" value="[Property context='current' type='content' field='title']




     [Plugin:Comment compute="once"]
     Write the date of the last modification of the content using
     the AnalyticsData plugin together with a nested [Property] tag
     to retrieve the last modification date. The date is formatted
     to the W3 date specification using the format attribute of the
     [Property] tag.
     [/Plugin:Comment]




     [Plugin:AnalyticsData css-class="asa.wcm.content_item.lastmodified" compute="once" value="[Property context='current' type='content' format='yyyy-MM-dd' field='lastmodifieddate']




     [Plugin:Comment compute="once"]
     Write the common names of all authors of the content as an
     unordered list using a [Property] tag. For example:
     <ul style="display:none">
     <li class="asa.wcm.content_item.authors">Author 1</li>
     <li class="asa.wcm.content_item.authors">Author 2</li>
     </ul>
     [/Plugin:Comment]




     [Property context="current" type="content" separator="&lt;/li&gt;&lt;li class=&quot;asa.wcm.content_item.authors&quot;&gt;" field="authors" start="<ul style="display:none"><li class="asa.wcm.content_item.authors">" end="</li></ul>"]




     [Property context="current" type="content" field="id"]




     [Plugin:PageMode pageMode="edit" compute="once"]
     [Plugin:Matches pattern="^true;.*wcm_inplaceEdit.*" negative-match="true" compute="once" text="[Plugin:RequestAttribute key='ct.cam.enabled' compute='once'];[Plugin:ThemeCapability compute='once']"]
     <div class="ibmPortalPortletIcons" style="float: right; textalign: right;">
     [Component name="web content templates 3.0/edit delete"]
     </div>
     [/Plugin:Matches]
     [/Plugin:PageMode]




     [EditableProperty context="current" type="content" format="div" field="title"]
     [Property context="current" type="content" field="title"]
     [/EditableProperty]




     [Property context="current" type="content" awareness="true" field="creator"]




     [Property context="current" type="content" format="relative" field="lastmodifieddate"]




     [Plugin:tags compute="once"]




     [Plugin:ratings compute="once"]




     [EditableElement context="current" type="content" key="body"]
     [Element context="current" type="content" key="body"]
     [/EditableElement]




     [Plugin:AnalyticsData property="id" compute="once"]




     [Plugin:AnalyticsData property="title" compute="once"]




     [Plugin:AnalyticsData property="path" compute="once"]




     [Plugin:AnalyticsData property="lastmodified" compute="once"]




     [Plugin:AnalyticsData property="authors" compute="once"]




     [Property context="current" type="content" field="id"]




     [Plugin:PageMode pageMode="edit" compute="once"]
     [Plugin:Matches pattern="^true;.*wcm_inplaceEdit.*" negative-match="true" compute="once" text="[Plugin:RequestAttribute key='ct.cam.enabled' compute='once'];[Plugin:ThemeCapability compute='once']"]
     <span class="ibmPortalPortletIcons" style="float: right; textalign: right;">
     [Component name="web content templates 3.0/edit"]
     </span>
     [/Plugin:Matches]
     [/Plugin:PageMode]




     [EditableElement context="current" type="content" key="Image"]
     <img style='max-width: 100%' src='[Element context="current" type="content" key="Image" format="url"]'  alt='[Element context="current" type="content" key="Image" format="alt"]'/>
     [/EditableElement]




     [Property context="current" type="content" field="id"]




     [Plugin:PageMode pageMode="edit" compute="once"]
     [Plugin:Matches pattern="^true;.*wcm_inplaceEdit.*" negative-match="true" compute="once" text="[Plugin:RequestAttribute key='ct.cam.enabled' compute='once'];[Plugin:ThemeCapability compute='once']"]
     <span class="ibmPortalPortletIcons" style="float: right; textalign: right;">
     [Component name="web content templates 3.0/edit"]
     </span>
     [/Plugin:Matches]
     [/Plugin:PageMode]




     [EditableProperty context="current" type="content" format="div" field="title"]
     [Property context="current" type="content" field="title"]
     [/EditableProperty]




     [EditableProperty context="current" type="content" format="div" field="description"]
     [Property context="current" type="content" field="description"]
     [/EditableProperty]




     [Element context="current" type="content" key="menu"]




     [Plugin:PageMode pageMode="edit" compute="once"]
     <p>
     <span>
     [Component name="web content templates 3.0/create article"]
     </span>
     </p>
     [/Plugin:PageMode]




     [Component name="web content templates 3.0/icons/infoicon48"]




     [Property context="current" type="content" field="description"]




     [Property context="current" type="content" field="id"]




     [Plugin:PageMode pageMode="edit" compute="once"]
     [Plugin:Matches pattern="^true;.*wcm_inplaceEdit.*" negative-match="true" compute="once" text="[Plugin:RequestAttribute key='ct.cam.enabled' compute='once'];[Plugin:ThemeCapability compute='once']"]
     <span class="ibmPortalPortletIcons" style="float: right; textalign: right">
     [Component name="web content templates 3.0/edit"]
     </span>
     [/Plugin:Matches]
     [/Plugin:PageMode]




     [EditableElement context="current" type="content" key="body"]
     [Element context="current" type="content" key="body"]
     [/EditableElement]



     */

    //noinspection JSUnresolvedFunction

});