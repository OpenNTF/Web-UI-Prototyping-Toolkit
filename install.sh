#!/bin/bash 
PROTOSTARDIR="$(pwd)"
nodePath=$(which node)
if [ $? -ne 0 ]; then
	echo "Cannot find node, please install from www.nodejs.org"
	exit 1
fi
echo "Using node at $nodePath"
npmPath=$(which npm)
if [ $? -ne 0 ]; then
	echo "Cannot find npm, please install from www.nodejs.org"
	exit 1
fi
echo "Using npm at $npmPath"

globalModules=$(npm config get prefix)
echo "Global modules dir = $globalModules"

globalModulesDirOwner=$(ls -ld $globalModules | awk '{print $3}')

currentUser=$(whoami)
echo "Emptying npm modules .."
rm -rf ./node_modules
echo "Emptying bower components .."
rm -rf ./bower_components
echo "Installing npm dependencies for protostar ..."
npm install
echo "Looking for bower ..."
bowerPath=$(which bower)
if [ $? -ne 0 ]; then 
	echo "Cannot find bower, installing ..."
	if [ $currentUser = $globalModulesDirOwner ]; then
		echo "Installing bower as current user ..."
		npm -g install bower
	else
		echo "Installing bower using sudo ..."
		sudo npm -g install bower
	fi
	echo "Bower installed!"
else
	echo "Bower already installed."
fi
echo "Installing bower dependencies for protostar ..."
bower install
./install_ckeditor_plugins.sh
sednode="$(echo "$nodePath" | sed -e 's/\//\\\//g')"
sedprotostar="$(echo "$PROTOSTARDIR" | sed -e 's/\//\\\//g')"
cat ./core/install/protostar.sh | sed -e "s/___PROTOSTARDIR___/${sedprotostar}/g" | sed -e "s/___NODE_EXEC_PATH___/${sednode}/g" > ./bin/protostar
cat ./core/install/Protostar.desktop | sed -e "s/___PROTOSTARDIR___/${sedprotostar}/g" | sed -e "s/___NODE_EXEC_PATH___/${sednode}/g" > ./bin/Protostar.desktop
chmod +x ./bin/protostar
chmod +x ./bin/Protostar.desktop
# Mac OS X executbale file adjustments
cp -R ./core/install/Protostar.app ./bin/Protostar.app
cat ./core/install/Protostar.app/Contents/document.wflow | sed -e "s/___PROTOSTARDIR___/${sedprotostar}/g" | sed -e "s/___NODE_EXEC_PATH___/${sednode}/g" > ./bin/Protostar.app/Contents/document.wflow


echo -e "\nDone setting up protostar!\n"


