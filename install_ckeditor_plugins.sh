#!/bin/sh
echo -e "Copying ckeditor plugins into bower_components/ckeditor/plugins...\n"

mkdir tmp;

// Get imagebrowser plugin
curl -L "https://github.com/spantaleev/ckeditor-imagebrowser/archive/master.zip"  -o "tmp/imagebrowserPlugin.zip"  
unzip tmp/imagebrowserPlugin.zip -d tmp
mv tmp/ckeditor-imagebrowser-master tmp/imagebrowser


// Get sourcedialog plugin
curl "http://download.ckeditor.com/sourcedialog/releases/sourcedialog_4.4.5.zip"   -o "tmp/sourcedialog.zip"  
unzip tmp/sourcedialog.zip -d tmp

// copy everything to the correct place
cp -Rv tmp/sourcedialog tmp/imagebrowser bower_components/ckeditor/plugins/

rm -r tmp
echo -e "\nDone copying.\n"
