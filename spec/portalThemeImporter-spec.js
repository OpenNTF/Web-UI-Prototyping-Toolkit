var importer = require("../lib/portalThemeImporter");
var fs = require("fs");
var path = require("path");
var wrench= require("wrench");
var utils = require("../lib/utils");

if(false)
describe("theme importer", function(){
    var originalTimeout;
    var importerArgs;
    beforeEach(function() {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
        importerArgs = {
            portalRootPath : "/mnt/speedy/opt/Portal85/WebSphere/PortalServer",
            profileRootPath : "/mnt/speedy/opt/Portal85/WebSphere/wp_profile",
            portalPort : "10039",
            portalHost : "omnius",
            portalContext : "/wps",
            portalUser: "wpsadmin",
            portalPwd: "password",
            wasUser: "wpsadmin",
            wasPwd: "password",
            vpContext: ""
        };
    });

    afterEach(function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
        // rm -rf /tmp/myTheme /tmp/themeResources /tmp/themeSources.zip
        wrench.rmdirSyncRecursive("/tmp/myTheme", true);
        wrench.rmdirSyncRecursive("/tmp/themeResources", true);
        if(fs.existsSync("/tmp/themeSources.zip")){
            fs.unlinkSync("/tmp/themeSources.zip");
        }

    });

    if(false)
    it("requires valid input object", function(){
        function noArgs(){
            new importer.ThemeImporter();
        }
        function emptyArgs(){
            new importer.ThemeImporter({});
        }
        function allThere(){
            new importer.ThemeImporter({
                portalRootPath : "/mnt/speedy/opt/Portal85/WebSphere/PortalServer",
                profileRootPath : "/mnt/speedy/opt/Portal85/WebSphere/wp_profile",
                portalPort : "10039",
                portalHost : "omnius",
                portalContext : "/wps"
            });
        }
        function badPortalRootPath(){
            new importer.ThemeImporter({
                portalRootPath : "/mnt/speedy/opt/Portal85/WebSphere/PortalServerz",
                profileRootPath : "/mnt/speedy/opt/Portal85/WebSphere/wp_profile",
                portalPort : "10039",
                portalHost : "omnius",
                portalContext : "/wps"
            });
        }

        function badPort(){
            new importer.ThemeImporter({
                portalRootPath : "/mnt/speedy/opt/Portal85/WebSphere/PortalServer",
                profileRootPath : "/mnt/speedy/opt/Portal85/WebSphere/wp_profile",
                portalPort : "20039",
                portalHost : "omnius",
                portalContext : "/wps"
            });
        }

        function badHost(){
            new importer.ThemeImporter({
                portalRootPath : "/mnt/speedy/opt/Portal85/WebSphere/PortalServer",
                profileRootPath : "/mnt/speedy/opt/Portal85/WebSphere/wp_profile",
                portalPort : "10039",
                portalHost : "omniusz",
                portalContext : "/wps"
            });
        }

        function badContext(){
            new importer.ThemeImporter({
                portalRootPath : "/mnt/speedy/opt/Portal85/WebSphere/PortalServer",
                profileRootPath : "/mnt/speedy/opt/Portal85/WebSphere/wp_profile",
                portalPort : "10039",
                portalHost : "omnius",
                portalContext : "/wpsz"
            });
        }

        expect(noArgs).toThrow();
        expect(emptyArgs).toThrow();
        expect(allThere).not.toThrow();
        [badContext, badPort, badHost, badPortalRootPath].forEach(function(fn){
            console.log("Running: " + fn.name);
            expect(fn).toThrow();
        })

    });

    if(false)
    it("should download the files", function(done){
        var ti = new importer.ThemeImporter(importerArgs);
        ti.downloadZip("/tmp/wpstest.zip", function(){
            console.log("done");
            done();
        });
    });
    it("should not download the files if the cachedZipPath is set (for testing without running portal)", function(done){
        var ti = new importer.ThemeImporter(importerArgs);
        ti.cachedZipPath = "/home/spectre/Downloads/fs-type1.zip";
        ti.downloadZip("/tmp/wpstest.zip", function(){
            console.log("done");
            var d = fs.statSync("/tmp/wpstest.zip");
            var o = fs.statSync(ti.cachedZipPath);
            expect(d.size).toBe(o.size);

            done();
        });
    });

    //if(false)
    it("should create a new theme", function(done){
        importerArgs.projectName = 'ProtostarTheme';
        importerArgs.groupId = 'themes.protostar';
        importerArgs.version = '1.0';
        var ti = new importer.ThemeImporter(importerArgs);
        ti.cachedZipPath = "/home/spectre/Downloads/fs-type1.zip";
        ti.createNewThemeProject("myTheme", "/tmp", importerArgs, function(){
            done();
            expect(fs.existsSync('/tmp/themeResources.zip')).toBe(false);
            expect(fs.existsSync('/tmp/themeResources')).toBe(false);
        });
    });
    //if(false)
    it("should create a new theme zip", function(done){
        importerArgs.projectName = 'ProtostarTheme';
        importerArgs.groupId = 'themes.protostar';
        importerArgs.version = '1.0';
        var ti = new importer.ThemeImporter(importerArgs);
        ti.cachedZipPath = "/home/spectre/Downloads/fs-type1.zip";
        ti.createNewThemeProjectZip("myTheme", "/tmp", importerArgs, function(zipPath){
            done();
            expect(fs.existsSync('/tmp/themeResources.zip')).toBe(false);
            expect(fs.existsSync('/tmp/themeResources')).toBe(false);
            expect(fs.existsSync(zipPath)).toBe(true);
            expect(zipPath).toBe("/tmp/myTheme.zip");
        });
    });
    //if(false)
    it("should create a new theme zip buffer", function(done){
        importerArgs.projectName = 'ProtostarTheme';
        importerArgs.groupId = 'themes.protostar';
        importerArgs.version = '1.0';

        var ti = new importer.ThemeImporter(importerArgs);
        ti.cachedZipPath = "/home/spectre/Downloads/fs-type1.zip";

        ti.createNewThemeProjectZipBuffer("myTheme", "/tmp", importerArgs, function(buffer, zipFileName){
            done();
            expect(zipFileName).toBe("myTheme.zip");
        });
    });

    it("should convert content spots to drop points", function(){
        importerArgs.projectName = 'ProtostarTheme';
        importerArgs.groupId = 'themes.protostar';
        importerArgs.version = '1.0';

        var ti = new importer.ThemeImporter(importerArgs);
        var source = fs.readFileSync(themeTemplatePath, {encoding: 'utf8'});
        var layout = ti.convertThemeTemplateToLayout(source);
        console.log("CONVERTED THEME TEMPLATE: "+ layout);
        var count = (layout.match(/dynamic-content/g) || []).length;
        expect(count).toBe(3);
    });

    var themeTemplatePath = path.join(__dirname, "files/portal_theme_template.html");
    var layoutTemplatePath = path.join(__dirname, "files/portal_layout.html");

    it("should convert content spots in layouts to drop points", function(){
        importerArgs.projectName = 'ProtostarTheme';
        importerArgs.groupId = 'themes.protostar';
        importerArgs.version = '1.0';

        var ti = new importer.ThemeImporter(importerArgs);
        var source = fs.readFileSync(layoutTemplatePath, {encoding: 'utf8'});
        var layout = ti.convertPortalLayout(source);
        console.log("CONVERTED LAYOUT: "+ layout);
        expect(layout.indexOf('content:main') >0).toBe(true);
    });

    it("should detect a portal theme and layout template", function(){
        var portalTpl = fs.readFileSync(themeTemplatePath, {encoding: 'utf8'});
        var layoutTpl = fs.readFileSync(layoutTemplatePath, {encoding: 'utf8'});
        expect(importer.isPortalThemeTemplateSource(portalTpl)).toBe(true);
        expect(importer.isPortalThemeTemplateSource(layoutTpl)).toBe(false);
        expect(importer.isPortalLayoutTemplateSource(portalTpl)).toBe(false);
        expect(importer.isPortalLayoutTemplateSource(layoutTpl)).toBe(true);
    });

    it("should detect a portal theme template", function(){
        var portalTpl = fs.readFileSync(themeTemplatePath, {encoding: 'utf8'});
        console.log("NO COMMENT: " + utils.removeAllHtmlComments(portalTpl));
    });


});
