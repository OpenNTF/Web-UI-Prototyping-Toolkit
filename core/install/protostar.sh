#!/bin/bash
#set -evx
NODEPATH="___NODE_EXEC_PATH___"
PROTOSTARDIR="___PROTOSTARDIR___"
PROTORES=2


function findProject(){
    DIAGTITLE="Protostar: select project dir"
    PROTDIR=""
    DIAGL="$(which kdialog)"
    if [ $? -gt 0 ]; then
        ## KDIALOG (Linux KDE) NOT FOUND
        DIAGL="$(which zenity)"
        if [ $? -gt 0 ]; then
            ## ZENITY (Linux Gnome) NOT FOUND
            DIAGL="$(which osascript)"
            if [ $? -gt 0 ]; then
                ## APPLESCRIPT (Mac OS X) NOT FOUND
                echo "No arguments passed and could not find directory selection dialog tool, exiting unsuccessfully :-(" 1>&2
                SELRET=1
            else
                ## APPLESCRIPT FOUND
                echo "Running Mac OS X directory selector"
                "$DIAGL" <<EOT
tell application "Finder"
    activate
    set myReply to button returned of (display dialog "Protostar launcher for Mac OS X goes here :-)" )
end tell
EOT
                ## NEED TO SET PROTDIR (projectDir path) AND SELRET to exit code of selector (should be 0)
                SELRET=1
                ## mac os x desktop integration (icon etc) seems to require automator:
                ## https://developer.apple.com/library/mac/documentation/AppleApplications/Conceptual/AutomatorConcepts/Articles/ShellScriptActions.html
            fi
        else
            ##ZENITY FOUND
            PROTDIR="$(zenity --title "$DIAGTITLE" --directory --filename="$HOME")"
            SELRET=$?
        fi
    else
        ##KDIALOG FOUND
        PROTDIR="$(kdialog  --title "$DIAGTITLE" --getexistingdirectory "$HOME")"
        SELRET=$?
    fi
    echo $PROTDIR
    return $SELRET
}

function launchProtostar(){
    echo "Launching Protostar with args: $@"
    "$NODEPATH" "${PROTOSTARDIR}/bin/protostar.js" "${@}"
    return $?
}

if [ $# -lt 1 ]; then
    ## NO ARGS PASSED
    echo "Passed no arguments ... looking for dir selection dialog tool ..."
    PROTDIR="$(findProject)"
    SELRET=$?
    if [ ${SELRET} -gt 0 ]; then
        ## NO DIR CHOSEN; cancelled, closed selector, ..
        echo "Chose not to choose directory, not launching Protostar. Exiting.."
        PROTORES=1
    else
        if [ -z "$PROTDIR" ]; then
            ## NO DIR CHOSEN; for whatever reason, can't launch
            echo "Found empty project directory, not launching Protostar. Exiting.."
            PROTORES=1
        else
            launchProtostar "${PROTDIR}"
            PROTORES=$?
            echo "NODE EXIT CODE : $PROTORES"
        fi
    fi
else
    launchProtostar $@
    PROTORES=$?
  echo "NODE EXIT CODE : $PROTORES"
fi

echo "EXIT CODE : $PROTORES"
if [ $PROTORES -eq 0 ]; then
    echo "Protostar exiting normally."
else
    echo "Protostar exited unsuccessfully, there were probably errors"
fi

exit $PROTORES