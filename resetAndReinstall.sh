#!/bin/bash

rm -rf ./bower_components
rm -rf ./node_modules
rm ./bin/protostar
bower cache clean
npm cache clean


DEFAULT_BRANCH="master"
echo "Resetting local changes to protostar .."
git reset
git checkout .
git clean -fdx
echo "Switching to master..."
git checkout master
echo "Retrieving last from repository ..."
git pull
echo "Switching to default branch"
git checkout ${DEFAULT_BRANCH}
echo "Installing ..."
npm install
echo "Done!"
