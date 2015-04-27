#!/bin/sh

VP_CONTEXT="{{vpContext}}"

WSADMIN="{{wsadmin}}"
XMLACCESS="{{xmlaccess}}"

PORTAL_USER="{{portalUser}}"
PORTAL_PWD="{{portalPwd}}"
PORTAL_HOST="{{portalHost}}"
PORTAL_PORT="{{portalPort}}"

WAS_USER="{{wasUser}}"
WAS_PWD="{{wasPwd}}"
TARGET_EAR="{{targetEar}}"
EAR_APPNAME="{{earAppName}}"
 
XML_THEMESSKINS="{{xmlThemesSkins}}"
XML_OUT_PATH="{{xmlOutPath}}"
TEMP_DIR="{{tempDir}}"

echo "Installing EAR application ..."

"${WSADMIN}" -user "$WAS_USER" -password "$WAS_PWD" -c "\$AdminApp update {$EAR_APPNAME} app {-operation update -contents $TARGET_EAR -usedefaultbindings -nodeployejb}"

"$WSADMIN" -user "$WAS_USER" -password "$WAS_PWD" -c "\$AdminControl invoke [\$AdminControl queryNames type=ApplicationManager,*] startApplication {$EAR_APPNAME}"
echo "Updated :-)"
