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

"${WSADMIN}" -user "$WAS_USER" -password "$WAS_PWD" -c "\$AdminApp install $TARGET_EAR {-appname {$EAR_APPNAME} -nodeployejb}"
echo "Installed."
echo "Starting EAR application ..."

"$WSADMIN" -user "$WAS_USER" -password "$WAS_PWD" -c "\$AdminControl invoke [\$AdminControl queryNames type=ApplicationManager,*] startApplication {$EAR_APPNAME}"

echo "Started."

echo "Importing themes and skins config through xmlaccess from $XML_THEMESSKINS ..."

if [ -z "$VP_CONTEXT" ]; then
    "$XMLACCESS" -user "$PORTAL_USER" -password "$PORTAL_PWD" -url "http://$PORTAL_HOST:$PORTAL_PORT/wps/config" -in "$XML_THEMESSKINS" -out "$TEMP_DIR/result_themesSkins_defaultPortal.xml"
    echo "Imported. Results in $TEMP_DIR/result_themesSkins_defaultPortal.xml"
else
    "$XMLACCESS" -user "$PORTAL_USER" -password "$PORTAL_PWD" -url "http://$PORTAL_HOST:$PORTAL_PORT/wps/config/${VP_CONTEXT}" -in "$XML_THEMESSKINS" -out "$TEMP_DIR/result_themesSkins_$VP_CONTEXT.xml"
    echo "Imported. Results in $TEMP_DIR/result_themesSkins_defaultPortal.xml"
fi

echo "Done :-)"