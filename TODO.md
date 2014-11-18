# TODOs
This is unstructered at the moment and kept as an ongoing workinglist.


## Feature requests

## Open
#### Misc

- Static: only fonts next to or below current dir are supported : https://bugzilla.mozilla.org/show_bug.cgi?id=760436
- download builds as zip
- launch display mode for zip -> extract to temp dir and launch that
- create specific screenshot(s) : size, viewport, ..
- check running instance and restart if different project is launched on same port
- shortlink to upon click replace content of specified element
- create proper backend : use template composition for backend UX
- add `<!-- md:<path> --> support : include markdown translated to html`
- two way editing : merge changes via decompilation into correct fragments
- extract droppoint location, matching, replacement to separte pluggable component; switch from comment syntax to something other (eg divs with classes or ..) to use as placeholders
- portfolio/workspace mode: enable launching multi project workspace rather than single project (multi-launch), launch in workspace mode pointing to dir that contains multiple projects, add overview screen (name/desc/thumb )
- remove reliance on scripting to get to app path, working dir and project path
- painless leveraging config: defaults, app, user, project, launch
- offer edit access to placeholders in page + all placeholders in resulting compiled page
- build: ensure resulting urls are relative !
- copy img url -> protostar pulls locally
- leverage retina.js for responsive imagery
- add markdown support for normal pages
- make helper shell scripts absolute calling compatible
- easy holder.js imageholders
- include apache proxy example: server under custom hostname


## Done
#### Layouts
- OK enable assigning content to droppoints by name instead of by order:
- OK ensure new approach also includes multiple contents for single droppoing
- OK allow strings to be inserted into placeholders
- OK <!-- layout:layouts/fullPage(file:_dynamic/list-referencing-bare;layout:layouts/fullPage(component/myEditableComponent);file:component/myComponent) -->
- OK <!-- layout:layouts/fullPage(nav=file:_dynamic/list-referencing-bare;top=layout:layouts/fullPage(component/myEditableComponent);bottom=file:component/myComponent) -->
- OK enable content droppoint in layout to specify wrapper to use for each content inserted into that droppoint


#### Misc
- OK logging: switch to winston
- OK revise command: adopt <cmd> <arg1> .. calling syntax, add help on cmdline, add
- OK relative paths support:
- OK add support for relative includes eg file:../page-scripts, ./part-include
- OK add support for relative paths in attributes eg `<script src="ps:./myScript.js"></script> <link rel="stylesheet" href="ps:shared/bootstrap/dist/css/bootstrap.css"/>`: needs bottom up compilation
- OK fully dynamically process data-editable annotations, just add data-editable to parent tag :-)
- OK dynamically add viewScripts as far as needed (no dupes!)
- OK adopt markdown for readme, help, .. -> /pshelp
- OK move to transparent css/map loading/generation -> reference non existant css in html for which less source exists
- OK fire of request for index.html upon startup so if that page causes errors we have it immediately upon startup
- OK bootstrapping projects: protostar create `<templateName> <targetDir>`, use protostar create `<projectDir> <templateName>` where templateName is a dir inside `<protostarDir>/core/templates/project/<tempalteName>`
- OK add RTF content editing + save to file by including strictly configured ckeditor (leverage custom attribute)
- OK enable passing port argument : pass as 3rd argument when launching protostar
- OK build a project: generate self contained dir containing the composed/preprocessed full html markup for the prototype site: eg launchable from filesystem in firefox
- OK support _templates structure at project-specific & app-wide levels which contains templates for new files
- OK create command: navigate to a non-existing page url, get a 404 page with button to create and potentially choose template to use
- OK enable image browsing for ckeditor -> insert image from project / shared (app-wide)
- OK enabgle source view for ckeditor -> we want strict markup control
- OK define named shared deps roots on workspace level : named paths
- OK add support for wrapping layouts: reference layout and use content:main or specified in layout args
- OK include ps shared templates in create dialog
