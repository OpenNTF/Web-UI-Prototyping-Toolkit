def getOptions(cellName, nodeName, appInfo, ctxRoot = None):
    options = [ '-nopreCompileJSPs',
                '-distributeApp',
                '-nouseMetaDataFromBinary',
                '-nodeployejb',
                '-createMBeansForResources',
                '-noreloadEnabled',
                '-nodeployws',
                '-validateinstall warn',
                '-noprocessEmbeddedConfig',
                '-filepermission .*\.dll=755#.*\.so=755#.*\.a=755#.*\.sl=755',
                '-noallowDispatchRemoteInclude',
                '-noallowServiceRemoteInclude',
                '-appname', appInfo["appName"],
                '-MapWebModToVH', [['.*', '.*', appInfo["virtualHost"]]],
                '-MapModulesToServers', [['.*', '.*', 'WebSphere:cell='+cellName+',node='+nodeName+',server='+appInfo["serverName"]]]
            ]
    if ctxRoot != None:
        options.append('-contextroot')
        options.append(ctxRoot)
    return options
 
def isAppExists(appName):
    return len(AdminConfig.getid("/Deployment:" + appName + "/" )) > 0
 
def stopApp(nodeName, serverName, appName):
    try:
        print 'Stopping Application "%s" on "%s/%s"...' %(appName, nodeName, serverName)
        appMgr = AdminControl.queryNames("type=ApplicationManager,node="+nodeName+",process="+serverName+",*" )
        AdminControl.invoke(appMgr, 'stopApplication', appName)
        print 'Application "%s" stopped on "%s/%s"!' %(appName, nodeName, serverName)
    except:
        print("Ignoring error - %s" % sys.exc_info())
 
def startApp(nodeName, serverName, appName):
    print 'Starting Application "%s" on "%s/%s"...' %(appName, nodeName, serverName)
    appMgr = AdminControl.queryNames("type=ApplicationManager,node="+nodeName+",process="+serverName+",*" )
    AdminControl.invoke(appMgr, 'startApplication', appName)
    print 'Application "%s" started "%s" on "%s/%s"!' %(appName, nodeName, serverName)
 
def removeApp(appName):
    print 'Removing Application "%s"...' %(appName)
    AdminApp.uninstall(appName)
    print 'Application "%s" removed successfully!' %(appName)
 
def synchronizeNode(nodeName):
    print 'Synchronizing node "%s"...' %(nodeName)
    AdminControl.invoke(AdminControl.completeObjectName('type=NodeSync,node='+nodeName+',*'), 'sync')
    print 'Node "%s" synchronized successfully!' %(nodeName)
 
def startServer(serverName, nodeName):
    print 'Starting server "%s" on node "%s"...' %(serverName, nodeName)
    AdminControl.startServer(serverName, nodeName)        
    print 'Server "%s" started successfully on node "%s"!' %(serverName, nodeName)
 
def stopServer(serverName, nodeName):
    print 'Stopping server "%s" on node "%s"...' %(serverName, nodeName)
    AdminControl.stopServer(serverName, nodeName)        
    print 'Server "%s" stopped successfully on node "%s"!' %(serverName, nodeName)
 
def restartServer(serverName, nodeName):
    stopServer(serverName, nodeName)
    startServer(serverName, nodeName)    
 
def installApp(location, options):
    print 'Installing application from "%s" ...' %(location)
    AdminApp.install(location, options)
    print 'Successfully installed application "%s"' %(location)
 
def save():
    print 'Saving the changes...'
    AdminConfig.save()
    print 'Changes saved successfully.'
 
if __name__ == '__main__':    
    if len(sys.argv) < 4:
        print 'ERROR: Not enough information to execute this script'
        print 'deploy.py app_name ear_file_path node_name server_name virtual_host'
        exit()
 
    print 'Initializing...'
    cellName = AdminConfig.showAttribute(AdminConfig.list('Cell'), 'name')
    appInfo = { "appName"    : sys.argv[0],
                "filePath"   : sys.argv[1], 
                "nodeName"   : sys.argv[2], 
                "serverName" : sys.argv[3], 
                "virtualHost": sys.argv[4]}
 
    options = getOptions(cellName, nodeName, appInfo)
    print 'Completed the initialization successfully.'
 
    if isAppExists(appInfo["appName"]):
        stopApp(nodeName, appInfo["serverName"], appInfo["appName"])
        removeApp(appInfo["appName"])
        save()
     
    installApp(appInfo["filePath"], options)
    save()
    # Synchronize the nodes.
    synchronizeNode(nodeName)
    # Restart Application server
    restartServer(appInfo["serverName"], nodeName)