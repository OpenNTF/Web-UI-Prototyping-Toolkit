"use strict";

var utils = require("../lib/utils");
var wcmTagParser = require("../lib/wcmTagParser");
var path = require("path");

//noinspection JSUnresolvedVariable
var focusTest = fit;

describe("wcm tag parser", function(){
    it('can parse wcm tags', function(){
        var wcmTagsFileContent = utils.readTextFileSync(path.resolve(path.dirname(__filename) + path.sep + 'files', "bunchOfWcmTags.html"), 'utf8');
        var at = wcmTagParser.collectWcmTags(wcmTagsFileContent);
        expect(at.length).toBe(38);

        at.forEach(function(t, idx){
            //console.log("TAG " + (idx+1) + " : " + t.fullTag + "\n\n");
            if(idx === 6){
                console.log("FOUND 7 === ", t);
            }
            if(t.name === 'Plugin:Comment'){
                expect(t.hasBody()).toBe(true);
                console.log("TAG " + (idx+1) + "has body : " + t.fullTag);
            }
        });

        expect(at[6].fullTag.indexOf('\']"]') >0).toBe(true);

        var markup = '[Plugin:Comment compute="once"]Some common microformats for active site analytics of web content[/Plugin:Comment]';
        //expect(utils.extractWcmTagTopLevelQuoteChar(markup)).toBe('"');
        //expect(utils.extractWcmTagTopLevelQuoteChar("[Plugin:Comment compute='once']Some common microformats for active site analytics of web content[/Plugin:Comment]")).toBe("'");
        var tag = wcmTagParser.findWcmTag(markup);
        expect(typeof tag).toBe('object');
        expect(tag.name).toBe('Plugin:Comment');
        expect(tag.hasAttributes()).toBe(true);
        expect(tag.getAttributeQuoteChar()).toBe('"');
        expect(tag.getNestedAttributeQuoteChar()).toBe('\'');
        expect(tag.getAttributeNames().length).toBe(1);
        expect(tag.getAttributeNames()[0]).toBe("compute");
        expect(tag.getAttributes()["compute"]).toBe("once");
        expect(tag.hasNestedTagsInAttributes()).toBe(false);
        expect(tag.hasNestedTagsInBody()).toBe(false);

        //expect(tag.attributes[0].key).toBe('compute');
        //expect(tag.attributes[0].value).toBe('once');

        expect(tag.fullTag).toBe(markup);
        expect(tag.startIdx).toBe(0);
        expect(tag.endIdx).toBe(markup.length);
        expect(tag.getBody()).toBe('Some common microformats for active site analytics of web content');

        markup = '[Plugin:AnalyticsData css-class="asa.wcm.content_item.title" compute="once" value="[Property context=\'current\' type=\'content\' field=\'title\']"]';
        tag = wcmTagParser.findWcmTag(markup);
        expect(tag.name).toBe('Plugin:AnalyticsData');
        expect(tag.hasAttribute("compute")).toBe(true);
        expect(tag.hasAttribute("blah")).toBe(false);
        expect(tag.fullTag).toBe(markup);
        expect(tag.hasAttributes()).toBe(true);
        expect(tag.getAttributeQuoteChar()).toBe('"');
        expect(tag.getAttributeNames().length).toBe(3);
        expect(tag.getAttributeNames()[0]).toBe("css-class");
        expect(tag.getAttributeNames()[1]).toBe("compute");
        expect(tag.getAttributeNames()[2]).toBe("value");
        console.log("ATTRIBUTES IN AL : ", tag.getAttributes());
        expect(tag.hasNestedTagsInAttributes()).toBe(true);
        var theNestedTag = tag.getNestedTagsInAttributes()["value"][0];
        expect(theNestedTag.name).toBe("Property");
        console.log("NESTED IN ATTR === ", theNestedTag);
        expect(tag.hasNestedTagsInBody()).toBe(false);
        //expect(tag.attributes[0].key).toBe('css-class');
        //expect(tag.attributes[0].value).toBe('asa.wcm.content_item.title');
        //expect(tag.attributes[1].key).toBe('compute');
        //expect(tag.attributes[1].value).toBe('once');
        //expect(tag.attributes[2].key).toBe('value');
        //console.log("The Attr = ", tag.attributes[2]);
        //expect(tag.attributes[2].value.name).toBe('Property');
        //expect(tag.attributes[2].value.attributes.length).toBe(3);
        expect(tag.hasBody()).toBe(false);
        var allTags = wcmTagParser.collectAllWcmTagsIncludingNested(wcmTagsFileContent);
        allTags.sort(function(a,b){
            return utils.sortString(a.name, b.name);
        });
        //console.log("ALL TAGS = ", allTags);
        allTags.forEach(function(t,i){
            var processedOpenTag = t.openTag.replace(/ compute=['"]once['"]/g, '');
            if(t.hasAttribute('name')){
                console.log("WcmTag " + (i+1)+". " + t.name + " name=" + t.getAttributes()["name"] + " (" + processedOpenTag + ")");
            }else if(t.hasAttribute('field')){
                console.log("WcmTag " + (i+1)+". " + t.name + " field=" + t.getAttributes()["field"] + " (" + processedOpenTag + ")");
            }else if(t.hasAttribute('key')){
                console.log("WcmTag " + (i+1)+". " + t.name + " key=" + t.getAttributes()["key"] + " (" + processedOpenTag + ")");
            }else{
                console.log("WcmTag " + (i+1)+". " + processedOpenTag);
            }

        });

    });
    it("can calculateAnInitialReplacementMap", function(){
        var wcmTagsFileContent = utils.readTextFileSync(path.resolve(path.dirname(__filename) + path.sep + 'files', "nestedTags.html"), 'utf8');
        var at = wcmTagParser.collectAllWcmTagsIncludingNested(wcmTagsFileContent);

        var nested = at.filter(function(t){
            return t.isNested();
        });
        expect(at.length).toBe(9);
        expect(nested.length).toBe(6);
        nested.forEach(function(n){
            console.log("nested " + n.name);
            switch(n.name){
                case 'Property':
                    expect(n.sourceStart).toBe(wcmTagsFileContent.indexOf(n.openTag));
                    break;
                case 'Plugin:Matches':
                    expect(n.sourceStart).toBe(wcmTagsFileContent.indexOf(n.openTag));
                    break;
                case 'Element':
                    break;

            }
        });
    });
});