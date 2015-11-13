
var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    http = require('http'),
    request = require('request'),
    AdmZip = require('adm-zip'),
    //wrench = require("wrench"),
    copier = require("./copier"),
    Handlebars = require("handlebars"),
    cheerio = require("cheerio"),
    utils = require("./utils"),
    osTmpdir = require("os-tmpdir");



var requiredArgs = ['portalRootPath', 'portalHost', 'portalPort', 'portalContext'];

function ThemeImporter(args){
    if(arguments.length !== 1) throw new Error("Expected single argument : the config object");
    requiredArgs.forEach(function(a){
        if(!args.hasOwnProperty(a) || (typeof args[a] !== 'string' && typeof args[a] !== 'number')){
            throw new Error("Requires config object with fields: " + requiredArgs.join(', '));
        }
    });

    this.portalRootPath = args.portalRootPath;
    this.profileRootPath = args.profileRootPath;
    if(!fs.existsSync(this.profileRootPath) || !fs.statSync(this.profileRootPath).isDirectory()){
        throw new Error("Illegal portal profile root path : " + this.profileRootPath);
    }

    if(!fs.existsSync(this.portalRootPath) || !fs.statSync(this.portalRootPath).isDirectory()){
        throw new Error("Illegal portal root path : " + this.portalRootPath);
    }
    if(!fs.existsSync(path.join(this.portalRootPath, '/theme/wp.theme.themes/default85/installedApps/DefaultTheme85.ear/DefaultTheme85.war'))){
        throw new Error("Cannot find default theme war dir");
    }

    this.portalHost = args.portalHost;
    this.portalPort = args.portalPort;
    this.portalContext = args.portalContext;
    this.webdavUrl =  'http://'+this.portalHost+':'+this.portalPort+this.portalContext+'/mycontenthandler/dav/fs-type1?mime-type=application/zip';

    this.argsTemplate = {
        projectName : '{{projectName}}',
        groupId: '{{groupId}}',
        version: '{{version}}',
        'artifactId-top' : '{{projectName}}-theme',
        'artifactId-static' : '{{projectName}}-static',
        'artifactId-dynamic' :  '{{projectName}}-dynamic',
        'artifactId-ear' :  '{{projectName}}-ear',
        'context-static' : '{{projectName}}-static',
        'context-dynamic' : '{{projectName}}-dynamic',
        'static-themedir-name' : '{{projectName}}',
        'static' : {
            'webapp-id' : '{{projectName}}-static-webapp',
            'webapp-displayName': '{{projectName}} Portal 8.5 - Static Resources'
        },
        'dynamic' : {
            'webapp-id' : '{{projectName}}-dynamic-webapp',
            'webapp-displayName': '{{projectName}} Portal 8.5 - Dynamic Resources'
        }

    };
    this.installInputArgs = {
        vpContext: '',
        portalUser: '',
        portalPwd: '',
        portalHost: '',
        portalPort: '',
        wasUser: '',
        wasPwd: ''

    };
    this.scriptSuffix =  /^win/.test(process.platform) ? "bat" : "sh";

    this.installArgsTemplate = {
        vpContext: '{{vpContext}}',
        wsadmin: '{{profileRootPath}}/bin/wsadmin.'+ this.scriptSuffix,
        xmlaccess: '{{portalRootPath}}/bin/xmlaccess.' + this.scriptSuffix,
        portalUser: '{{portalUser}}',
        portalPwd: '{{portalPwd}}',
        portalHost: '{{portalHost}}',
        portalPort: '{{portalPorta}}',
        wasUser: '{{wasUser}}',
        wasPwd: '{{wasPwd}}',
        targetEar: '',
        earAppName: '',
        xmlThemesSkins: '',
        tempDir: os.tmpdir()
    };
    this.compiledInstallArgs = {};

    this.compiledArgs = {};
    this.compileInstallArgsObject = function(inputArgs, builtEarPath, earAppname, themesXmlPath){
        var o = {};
        inputArgs.portalHost = this.portalHost;
        inputArgs.portalPort = this.portalPort;
        inputArgs.portalRootPath = this.portalRootPath;
        inputArgs.profileRootPath= this.profileRootPath;

        for(var l in inputArgs){
            var w = inputArgs[l];
            o[l] = w
        }
        for(var k in this.installArgsTemplate){
            var v = this.installArgsTemplate[k];
            o[k] = this.compileHB(v, inputArgs);
        }
        o.targetEar = builtEarPath;
        o.xmlThemesSkins = themesXmlPath;
        o.earAppName = earAppname;
        console.log("Compiled install args : ", o);
        return o;
    };
    this.compileArgsObject = function(inputArgs){
        var o = {};
        for(var l in inputArgs){
            var w = inputArgs[l];
            if(typeof w === 'string'){
                o[l] = w;
            }
        }
        for(var k in this.argsTemplate){
            var v = this.argsTemplate[k];
            if(typeof v === 'object'){
                var w = {};
                for(var wk in v){
                    w[wk] = this.compileHB(v[wk], inputArgs);
                }
                o[k] = w;
            }else{
                o[k] = this.compileHB(v, inputArgs);
            }
        }
        o.portalHost = this.portalHost;
        o.portalPort = this.portalPort;
        o.portalRootPath = this.portalRootPath;
        o.profileRootPath= this.profileRootPath;
        console.log("Compiled args : ", o);
        return o;
    };
    this.configSourcesPath = '/home/spectre/Projects/WUIPT/core/assets/newTheme';
    this.compileHB = function(source, args){
        var compiledTemplate = Handlebars.compile(source);
        var compiledInstance = compiledTemplate(args);
        return compiledInstance;
    };
    this.composeConfigFile = function(sourcePath, fullTargetPath, args){
        var fullSourcePath = path.join(this.configSourcesPath, sourcePath);
        var templatePathContents = fs.readFileSync(fullSourcePath, {
            encoding: 'utf8'
        });
        var out = this.compileHB(templatePathContents, args);

        fs.writeFileSync(fullTargetPath, out, {
            encoding: 'utf8'
        });
    };

    var tmpParent = osTmpdir();

    this.convertThemeTemplateToLayout = function(src){
        var s = utils.removeBlankLines(utils.removeAllHtmlComments(src));
        var $ = cheerio.load(s, {
            normalizeWhitespace: false,
            xmlMode: false
        });
        // <a rel="dynamic-content" href="dyn-cs:id:ProtostarTheme_toolbar"></a>

        $('a[rel="dynamic-content"],link[rel="dynamic-content"]').each(function(){
            var t = $(this);
            var href = t.attr("href");
            var short = href.substring(href.lastIndexOf("_")+1);
            console.log("SPOT : " + short);
            if(short.indexOf('co:')<0  && short.indexOf("state.portlet:portlet")<0){
                if(short !== 'layout'){
                    t.replaceWith('<!-- content:' + short + ' -->');
                }else{
                    t.replaceWith('<!-- content:main -->');
                }
            }
        });
        var out = $.html();
        return out;
    };

    this.convertPortalLayout = function(src){
        var s = utils.removeBlankLines(utils.removeAllHtmlComments(src));
        var $ = cheerio.load(s, {
            normalizeWhitespace: false,
            xmlMode: false
        });
        // <div class="component-container wpthemeCol wpthemePrimary ibmDndColumn wpthemeLeft wpthemeCol12of12 wpthemeFull" name="ibmMainContainer"></div>

        $('.component-container[name]').each(function(){
            var t = $(this);
            var csName = t.attr('name');
            var droppoint;
            if(csName === 'ibmMainContainer'){
                droppoint = "main";
            }else{
                droppoint = csName;
            }
            t.append('<!-- content:' + droppoint + " -->");
            //var href = t.attr("href");
            //var short = href.substring(href.lastIndexOf("_")+1);
            //console.log("SPOT : " + short);
            //if(short.indexOf('co:')<0  && short.indexOf("state.portlet:portlet")<0){
            //    if(short !== 'layout'){
            //        t.replaceWith('<!-- content:' + short + ' -->');
            //    }else{
            //        t.replaceWith('<!-- content:main -->');
            //    }
            //}
        });
        var out = $.html();
        return out;
    };

    this.createNewThemeProjectZipBuffer = function(projectName, dir, inputArgs, callback){
        this.createNewThemeProject(projectName,dir, inputArgs, function(projectRootPath){
            //var zipPath = path.join(dir, projectName + ".zip");
            var zip = new AdmZip();
            zip.addLocalFolder(path.join(dir, projectName), projectName);
            var buffer = zip.toBuffer();
            //wrench.rmdirSyncRecursive(projectRootPath, true);
            callback(buffer, projectName+".zip");
        });
    };

    this.createNewThemeProjectZip = function(projectName, dir, inputArgs, callback){
        this.createNewThemeProject(projectName,dir, inputArgs, function(projectRootPath){
            var zipPath = path.join(dir, projectName + ".zip");
            var zip = new AdmZip();
            zip.addLocalFolder(path.join(dir, projectName), projectName);
            zip.writeZip(zipPath, function(){
                //wrench.rmdirSyncRecursive(projectRootPath, true);
                callback(zipPath);
            });
        });
    };

    this.createNewThemeProject = function(projectName, dir, inputArgs, callback){
        this.compiledArgs = this.compileArgsObject(inputArgs);
        var t = this;
        var projRootPath = path.join(dir, projectName);
        if(fs.existsSync(projRootPath)) throw new Error("Project path already exists : " + projRootPath);
        var dirnameStaticProj = t.compiledArgs['artifactId-static'];
        var staticFilesProjPath = path.join(projRootPath, dirnameStaticProj);
        var dirnameDynamicProj = t.compiledArgs['artifactId-dynamic'];
        var dynamicFilesProjPath = path.join(projRootPath, dirnameDynamicProj);
        var earProjPath = path.join(projRootPath, t.compiledArgs['artifactId-ear']);

        copier.mkdirsSync(path.join(staticFilesProjPath, "src/main"));
        copier.mkdirsSync(path.join(dynamicFilesProjPath, "src/main"));
        copier.mkdirsSync(path.join(earProjPath, "src/main/application"));
        var sourceZipBaseName ="portalThemeSources";
        var themeFilesPath = path.join(tmpParent, sourceZipBaseName+".zip");
        var defaultThemePath = 'themes/Portal8.5';
        this.downloadZip(themeFilesPath, function(){
            try{
                var extractedZipPath = path.join(tmpParent, sourceZipBaseName);
                t.extractZip(themeFilesPath, extractedZipPath);
                var staticFilesSource = path.join(extractedZipPath, defaultThemePath);
                copier.mkdirsSync(path.join(staticFilesProjPath, "src/main/webapp/themes"));
                var staticFilesTarget = path.join(staticFilesProjPath, "src/main/webapp/themes/" + t.compiledArgs['projectName']);
                console.log("Copying static files " + staticFilesSource + "->" + staticFilesTarget);
                copier.copy(staticFilesSource, staticFilesTarget);
                var dynaFilesSource = path.join(t.portalRootPath, 'theme/wp.theme.themes/default85/installedApps/DefaultTheme85.ear/DefaultTheme85.war');
                var dynaFilesTarget = path.join(dynamicFilesProjPath, "src/main/webapp");
                console.log("Copying dynamic files " + dynaFilesSource+ "->" + dynaFilesTarget);
                copier.copy(dynaFilesSource, dynaFilesTarget);
                var pomFilename = 'pom.xml';
                t.composeConfigFile('toplevel-pom.xml', path.join(projRootPath, pomFilename), t.compiledArgs);
                t.composeConfigFile('static-pom.xml', path.join(staticFilesProjPath, pomFilename), t.compiledArgs);
                t.composeConfigFile('dynamic-pom.xml', path.join(dynamicFilesProjPath, pomFilename), t.compiledArgs);
                t.composeConfigFile('ear-pom.xml', path.join(earProjPath, pomFilename), t.compiledArgs);
                var srcWebInfPath = "src/main/webapp/WEB-INF";
                copier.mkdirsSync(path.join(staticFilesProjPath, srcWebInfPath));
                t.composeConfigFile('dynamic-WEB-INF/web.xml', path.join(staticFilesProjPath, srcWebInfPath + '/web.xml'), t.compiledArgs['static']);
                t.composeConfigFile('dynamic-WEB-INF/web.xml', path.join(dynamicFilesProjPath, srcWebInfPath + '/web.xml'), t.compiledArgs['dynamic']);
                t.composeConfigFile('dynamic-WEB-INF/plugin.xml', path.join(dynamicFilesProjPath, srcWebInfPath + '/plugin.xml'), t.compiledArgs);
                t.composeConfigFile('dynamic-WEB-INF/ibm-web-bnd.xmi', path.join(dynamicFilesProjPath, srcWebInfPath + '/ibm-web-bnd.xmi'), t.compiledArgs);
                t.composeConfigFile('dynamic-WEB-INF/ibm-web-ext.xmi', path.join(dynamicFilesProjPath, srcWebInfPath + '/ibm-web-ext.xmi'), t.compiledArgs);
                t.composeConfigFile('ear-application/application.xml', path.join(earProjPath, 'src/main/application/application.xml'), t.compiledArgs);
                t.composeConfigFile('ear-application/was.policy', path.join(earProjPath, 'src/main/application/was.policy'), t.compiledArgs);
                t.composeConfigFile('xmlaccess-deploy-themes.xml', path.join(projRootPath, 'deploy-theme-xmlaccess.xml'), t.compiledArgs);
                t.composeConfigFile('xmlaccess-undeploy-themes.xml', path.join(projRootPath, 'undeploy-theme-xmlaccess.xml'), t.compiledArgs);
                var compiledEarPath = path.join(earProjPath, "target", t.compiledArgs["artifactId-ear"] + "-" + t.compiledArgs["version"] + ".ear");
                t.compiledInstallArgs = t.compileInstallArgsObject(t.compiledArgs, compiledEarPath, t.compiledArgs["artifactId-ear"]+'_Theme_EAR_Application', path.join(projRootPath, 'deploy-theme-xmlaccess.xml'));

                // TEMP DISABLED : all in one install scripts disabled and excluded until finished .. nearly there!
                if(false){
                    t.composeConfigFile('install.sh', path.join(projRootPath, 'install.sh'), t.compiledInstallArgs);
                    t.composeConfigFile('install_win_defaultPortal.bat', path.join(projRootPath, 'install_win_defaultPortal.bat'), t.compiledInstallArgs);
                    t.composeConfigFile('install_win_virtualPortal.bat', path.join(projRootPath, 'install_win_virtualPortal.bat'), t.compiledInstallArgs);
                }
                // TEMP DISABLED
                //var projectFiles = wrench.readdirSyncRecursive(projRootPath);
                var projectFiles = copier.listDirChildrenFullPathsRecursively(projRootPath);
                projectFiles.sort();
                projectFiles.forEach(function(fp){
                    //var fullProjectPath = path.join(projRootPath, fp);
                    var fullProjectPath = "" + fp;
                    if(fp.substring(fp.length-5) === '.html' || fp.substring(fp.length-4) === '.jsp'){
                        var orig = fs.readFileSync(fullProjectPath, {encoding: 'utf8'});
                        var modif = orig.replace(/85theme_/g, t.compiledArgs.projectName + "_");
                        fs.writeFileSync(fullProjectPath, modif, {encoding: 'utf8'});
                    }else if(fp.substring(fp.length-5) === '.json' && path.basename(path.dirname(fp)) === 'profiles'){
                        var orig = fs.readFileSync(fullProjectPath, {encoding: 'utf8'});
                        var modif = orig.replace(/wp_dynamicContentSpots_85/g, t.compiledArgs.projectName + "_dynamicContentSpots_85");
                        fs.writeFileSync(fullProjectPath, modif, {encoding: 'utf8'});
                    }else if(fp.indexOf("layouts.json") > 0){
                        var orig = fs.readFileSync(fullProjectPath, {encoding: 'utf8'});
                        var modif = orig.replace(/ibmCfg\.themeConfig\.themeWebDAVBaseURI\+'/g, '\'/'+t.compiledArgs['context-static']+'/themes/' + t.compiledArgs.projectName + '/');
                        modif = modif.replace(/ibmCfg\.themeConfig\.themeRootURI\+'/g, '\'/'+t.compiledArgs['context-static']+'/themes/' + t.compiledArgs.projectName);
                        fs.writeFileSync(fullProjectPath, modif, {encoding: 'utf8'});
                    }
                });
                callback(projRootPath);

            }catch(e){
                console.error('error while creating theme', e.stack);
                //console.trace(e);
            }
        });
    };
    this.extractZip = function(zipPath, targetPath){
        var zip = new AdmZip(zipPath);
        zip.extractAllTo(targetPath, /*overwrite*/false);

    };
    this.extractZipOverwriting = function(zipPath, targetPath){
        var zip = new AdmZip(zipPath);
        zip.extractAllTo(targetPath, /*overwrite*/true);
    };

    this.downloadZip = function(targetPath, callback){
        var t= this;
        if(t.hasOwnProperty("cachedZipPath")){
            fs.createReadStream(t.cachedZipPath).pipe(fs.createWriteStream(targetPath)).on('close', function(){
                callback();
            });
        }else{
            //var out = fs.createWriteStream(targetPath); // For saving NSE Equity bhavcopy
            request(this.webdavUrl, {
                'auth': {
                    'user': 'wpsadmin',
                    'pass': 'password',
                    'sendImmediately': false
                }
            }).on('error', function(err){
                console.error("Error downloading theme from "+t.webdavUrl, err);
                console.trace(err);

            }).pipe(fs.createWriteStream(targetPath)).on('close', function(){
                var zip = new AdmZip(targetPath);
                zip.extractAllTo(tmpParent, /*overwrite*/false);
                callback();
            });
        }
    }
}

module.exports = {
    ThemeImporter: ThemeImporter,
    isPortalThemeTemplateSource: function(source){
        var s = source;
        return s.indexOf("<html") >=0 && s.indexOf("</html>") > 0 && s.indexOf("dynamic-content") > 0 && s.indexOf("co:config") > 0 && s.indexOf("co:head") > 0;
    },
    isPortalLayoutTemplateSource: function(source){
        var s = source;
        return s.indexOf("<html") <0 && s.indexOf("</html>") < 0 && s.indexOf("component-container") > 0 && s.indexOf("ibmHiddenWidgets") > 0 && s.indexOf("ibmMainContainer") >0;
    }
};