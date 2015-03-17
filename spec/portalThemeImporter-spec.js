var importer = require("../lib/portalThemeImporter");
var fs = require("fs");


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

    it("should download the files", function(done){
        var ti = new importer.ThemeImporter(importerArgs);
        ti.downloadZip("/tmp/wpstest.zip", function(){
            console.log("done");
            done();
        });
    });
    if(false)
    it("should create a new theme", function(done){
        importerArgs.projectName = 'ProtostarTheme';
        importerArgs.groupId = 'themes.protostar';
        importerArgs.version = '1.0';

        var ti = new importer.ThemeImporter(importerArgs);

        ti.createNewThemeProject("myTheme", "/tmp", importerArgs, function(){
            done();
            expect(fs.existsSync('/tmp/themeResources.zip')).toBe(false);
            expect(fs.existsSync('/tmp/themeResources')).toBe(false);
        });
    });
    if(false)
    it("should create a new theme zip", function(done){
        importerArgs.projectName = 'ProtostarTheme';
        importerArgs.groupId = 'themes.protostar';
        importerArgs.version = '1.0';

        var ti = new importer.ThemeImporter(importerArgs);

        ti.createNewThemeProjectZip("myTheme", "/tmp", importerArgs, function(zipPath){
            done();
            expect(fs.existsSync('/tmp/themeResources.zip')).toBe(false);
            expect(fs.existsSync('/tmp/themeResources')).toBe(false);
            expect(fs.existsSync(zipPath)).toBe(true);
            expect(zipPath).toBe("/tmp/myTheme.zip");
        });
    });
    it("should create a new theme zip buffer", function(done){
        importerArgs.projectName = 'ProtostarTheme';
        importerArgs.groupId = 'themes.protostar';
        importerArgs.version = '1.0';

        var ti = new importer.ThemeImporter(importerArgs);

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
        var layout = ti.convertToLayout(fs.readFileSync('/home/spectre/Projects/protostar-projects/portalpage/template/theme_en.html', {encoding: 'utf8'}));
        expect(layout.indexOf('dynamic-content') >=0).toBe(false);
    });

});
