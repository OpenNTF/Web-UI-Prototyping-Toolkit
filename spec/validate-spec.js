var fs = require("fs");
var path = require("path");

describe("", function(){
    beforeEach(function() {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
    });
    xit("", function(done){
        //var dt = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        //jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
        var w3c = require("w3c-validate");
        var val = w3c.createValidator();
        var html = fs.readFileSync(__dirname + path.sep + 'files' + path.sep + 'testFullPage.html', 'utf8');
        val.validate(html, function(){
            console.log("Finished validating: ", arguments);
            //jasmine.DEFAULT_TIMEOUT_INTERVAL = dt;
            done();
        });
    });
    xit("can get to our wcm items", function(done){
        var http = require("http");
        var apps = '/wps/wcm/connect/protostar%20library/apps';
        var vpinfo = '/wps/wcm/connect/protostar%20library/vpinfo';
        var servicesHome = '/wps/contenthandler/model/service';
        http.request({
            host: "omnius",
            port: '10039',
            path: apps
        }, function(resp){
            var all = '';
            resp.on('data', function(str){
                all += str;
            });
            resp.on('end', function(str){
                console.log("DONE : ", all);
                done();
            });

        }).end();
    });
    xit("sp pull", function(done){
        var portalTooling = require("../lib/portalTooling");
        portalTooling.pullScriptPortletToDir("60b2d0b8-2cb6-4e0b-b37f-57b97fe66c08", "/tmp/pulledSP", new portalTooling.PortalConfig({
            "username": "wpsadmin",
            "password": "password",
            "contextRoot": "/wps",
            "virtualPortalContext": "",
            "host": "omnius",
            "secure": false,
            "port": "10039",
            "listScriptPortletsUrlPathname": "/wps/wcm/connect/protostar%20library/apps",
            "virtualPortalInfoUrlPathname": "/wps/wcm/connect/protostar%20library/vpinfo"
        }), "/home/spectre/opt/sp_cmdln/sp.sh", function(err, dp){
            if(err){
                console.error("Failed do dnl " + dp, err);
            }else{
                console.info("Downloaded to " + dp);
            }
            done();
        });
    });
    xit("sp push", function(done){
        var portalTooling = require("../lib/portalTooling");
        portalTooling.pushScriptPortletFromDir("/tmp/pulledSP", "/home/spectre/opt/sp_cmdln/sp.sh", function(err, dp){
            if(err){
                console.error("Failed do upload from " + dp, err);
            }else{
                console.info("Uploaded from " + dp);
            }
            done();
        });
    });
    xit("theme pull", function(done){
        var portalTooling = require("../lib/portalTooling");
        var targetDir = "/tmp/pulledTheme";

        var pc = new portalTooling.PortalConfig({
            "username": "wpsadmin",
            "password": "password",
            "contextRoot": "/wps",
            "virtualPortalContext": "",
            "host": "omnius",
            "secure": false,
            "port": "10039",
            "listScriptPortletsUrlPathname": "/wps/wcm/connect/protostar%20library/apps",
            "virtualPortalInfoUrlPathname": "/wps/wcm/connect/protostar%20library/vpinfo"
        });
        var syncCfg = pc.createThemeSyncConfig("bootstrapDemoTheme");
        fs.mkdirSync(targetDir);
        fs.writeFileSync(targetDir + path.sep + ".settings", JSON.stringify(syncCfg), 'utf8');
        portalTooling.pullThemeFromWebDavToDir(targetDir, "/home/spectre/Projects/dxsync/bin/dxsync", function(err, dp){
            if(err){
                console.error("Failed do dnl " + dp, err);
            }else{
                console.info("Downloaded to " + dp);
            }
            done();
        });
    });
    xit("theme push", function(done){
        var portalTooling = require("../lib/portalTooling");
        portalTooling.pullThemeFromWebDavToDir("/tmp/pulledTheme", "/home/spectre/Projects/dxsync/bin/dxsync", function(err, dp){
            if(err){
                console.error("Failed do upload from " + dp, err);
            }else{
                console.info("Uploaded from " + dp);
            }
            done();
        });
    });
});