# Web UI Prototyping Toolkit - Protostar

Version 0.9.3

This is a tool to facilitate the creation of static HTML prototypes from UX designs
- Decompose pages into reusable fragments
- Instant server startup, live editing from then on. Kill and fire up again only when changing project root
- Nested inclusion of fragments
- Simplistic syntax model: mostly HTML comments that point to relative file paths
- Live less css compilation
- Make your prototypes feel like a website: automatic generation of navigation of prototypes
- Every request processes all markup and styles
- Quick helpers: toggle RTL, highlight specific markup, ...
- ..


<!-- TOC -->


## Installing

Open a commandline with node, npm and git commands available, and run following:

    git clone https://github.com/OpenNTF/Web-UI-Prototyping-Toolkit.git protostar
    cd protostar
    npm install
    protostar projects/test

Open a browser to http://localhost:8888/

On linux and OS X systems you can run following command to create a launch script as well as launcher icon.

    ./install.sh

### Requirements

- node.js : http://nodejs.org/download
- git : http://git-scm.com/downloads

Make sure node, npm and git are available on the command line.
On Windows you may need to use 'git bash' depending on choices made during git installation.

    node --version
    > v0.10.36
    npm --version
    > 1.4.28
    git --version
    > git version 2.0.4


### Linux & OS X
- open commandline
- `cd /path/to/protostar`
- `./install.sh`

to have a launcher icon created as well as a shell script in /bin in the protostar dir.

### Windows
- download & extract or check out the latest version to where you want to store the app directory
- open commandline
- `cd \path\protostar`
- `npm install`
- Installed!

### Validating the Protostar installation
To run Protostar with the test project (use backslashes on Windows)
- open a terminal
- `cd /my/path/to/protostar`
- `node ./bin/protostar.js ./projects/test`
- open a browser to http://localhost:8888

## Running
Running protostar boils down to invoking it and passing it a directory path as the only argument: the website root dir
If you have the protostar command on your PATH:
    protostar <website_root_dir>`
Otherwise:
    `<protostar_dir>/bin/protostar <website_root_dir>`
If the script does not work for you, you can just invoke the protostar.js file using node and pass the project root directory as first parameter, like for example assuming inside the protostar dir:
    `node bin/protostar.js projects/test`

### Accessing documentation at runtime

To access this content at runtime:
- navigate to http://localhost:8888/pshelp
- press Alt-Shift-H within a rendered page (you may need to put focus in the page by clicking the background)

## Documentation

### Introduction

Protostar is a tool to facilitate the creation of static HTML prototypes from UX designs.
- Decompose pages into reusable fragments
- Instant server startup, live editing from then on. Kill and fire up again only when changing project root
- Nested inclusion of fragments
- Simplistic syntax model: mostly HTML comments that point to relative file paths
- Live less compilation
- Make your prototypes feel like a website: automatic generation of navigation of prototypes
- Every request processes all markup and styles
- Develop your prototypes in WebKit again :-)
- Quick helpers: toggle RTL, highlight specific markup, ...
- Batch compilation and deletion of compiled files
- ..

### Goals
- Obvious gains by avoiding duplication
- Bring prototype output closer to developer input
- Bring prototypes closer to live site feeling
- KISS, transparant, do the expected thing
- Offload and facilitate the developer(s) wherever possible
- Facilitate consistency, standardization, flexibility
- Get more value and ROI from the prototypes in broader context
- Quick, easy, hassle-free. Focus on what matters, do it once and do it right

### Tutorials
- "[Getting Started Tutorial](https://github.com/OpenNTF/Web-UI-Prototyping-Toolkit/blob/master/tutorials/1-GettingStarted.md)".


### Starting a project
When you start protostar you should pass it a directory as argument; this directory will represent your project root (and should thus come to contain and index.html file).
All references will be resolved relative to this directory as long as the server process runs.


### Leveraging reusable html fragments
As a simple example create three files: index.html, other.html and nav.html.
Put some basic HTML page markup in both index.html & other.html and any markup in nav.html
Verify you can access the 2 pages by navigating to running server with a browser. You should get to see your index.html, same goes if you change the path to other.html
Add the following to both html pages: `<!-- file:nav -->` and reload both index and other.
 The contents of nav should have replaced that comment.
Congrats, you're leveraging a reusable html fragment in your prototypes!

The referenced files, like nav in this example, can contain other references in turn - this feature can be used to create 'aliases', a reusable fragment with stable name (eg. 'header') that only contains another reference (eg. 'header-big' or 'header-small')

### The layout and content namespaces

Besides the file namespace, protostar has the two aforementioned namespaces.

The goal is quite simple: enable reusable layouts that can show the same content in different locations on the page etc.

A layout contains content placeholders that will display the content that is configured in the layout marker comment in the source page.
A content placeholder:

    <!-- content:myContentSpotName -->

A layout call:

    <!-- layout:myLayout(file:nav,file:menu) -->

A layout protostar is typically included in a top level page while passing in a number of components to be shown in that layout.

The layouts are named to enable assignment by name (and convention) but this is still among others todo :-)

### Commands
Protostar includes a number of in-page shortcut commands to help out:

    Alt+Shift+H : Displays this help page
    Alt+Shift+I : Goto the prototype homepage
    Alt+Shift+C : Compiles all templates (in the project dir)
    Alt+Shift+D : Deletes all compiled templates (in the project dir)
    Alt+Shift+L : Brings up a list page of the prototypes
    Alt+Shift+G : Highlights bootstrap grid classes, .portlet. Press again to disable.
    Alt+Shift+T : Lists the fragment files that are referenced from the prototypes
    Alt+Shift+O : Lists any file that references/includes another file/layout
    Alt+Shift+A : Recursively lists all html files in the project directory
    Alt+Shift+E : Open current page source in code editor
    Alt+Shift+A : Recursively lists all html files in the project directory

### Using Protostar in-page functionality
Protostar adds the scripts below automatically if they are not present yet:

    <script src="/ps/ext/jquery/dist/jquery.js"></script>
    <script src="/ps/ext/Keypress/keypress.js"></script>
    <script src="/ps/assets/views.js"></script>

If you include any script reference pointing to eg. jquery, it will assume jquery is already in the page.
To enable the protostar in-page functionality ensure following scripts are at the bottom of your composed html pages, do not add duplicates of jquery or keypress if they are already included!

### Dynamic parts

Protostar maintains an html file that contains `<li>` items for the detected prototypes and writes them to a subdirectory `_dynamic`
- list-referencing-bare: will return list items with links to files that contain references. To include just call file:_dynamic/list-referencing-bare in your nav
- list-compiled-bare: the same but for compiled templates. By including this in your markup and batch compiling all templates you'll have created a composed crosslinked minisite of your prototypes.

### Live lesscss compilation

As of recently you can just reference a non-existant css file at the same level as a less file, and protostar will serve the compiled css & css map as needed.
So all you need is an ordinary `<link rel="stylesheet" type="text/css" href="less/styles.css"/>` to actually load the compiled styles from `less/styles.less`

### Viewing raw template for a page
- Raw: To view the unprocess template in your browser for a composed page just add the raw request parameter, eg http://localhost:8888/index.html?raw
- Compiled source : http://localhost:8888/index.html?source
- Compiled and cleaned source : http://localhost:8888/index.html?sourceClean

### Screenshot
- Taking a screenshot: http://localhost:8888/index.html?cheese and check `<projectDir>/screenshots`
- Taking screenshots from all prototype pages for all responsive sizes : http://localhost:8888/index.html?command=screenshot-all and check `<projectDir>/screenshots`

### Layouts
#### Assign by order
Display in first droppoint in layout:

    <!-- layout:layouts/fullPage(file:component/myEditableComponent) -->

Spread over droppoints in layout, first and second in this case:

    <!-- layout:layouts/fullPage(file:component/myComponent;file:component/myComponent) -->

Show both in first droppoint:

    <!-- layout:layouts/fullPage(file:component/myComponent,file:component/myComponent) -->

#### Assign by name

Assign to content drop point `page`, eg `<!-- content:page -->`

    <!-- layout:layouts/fullPage(page=file:component/myComponent) -->

Assign both to `page`

    <!-- layout:layouts/fullPage(page=file:component/myComponent,file:component/myComponent) -->

Assign a component to both `column1` and `column2`

    <!-- layout:layouts/twoColumns(column1=file:component/myComponent;column2=file:component/myComponent) -->

Assign two components to `column1` and `column2`

    <!-- layout:layouts/twoColumns(column1=file:component/myComponent,file:component/myComponent;column2=file:component/myComponent,file:component/myComponent) -->

#### Passing text strings as content

##### By order

    <!-- layout:layouts/fullPage('this will be assigned') -->
    <!-- layout:layouts/fullPage("this will be assigned") -->
    <!-- layout:layouts/fullPage('first text content',"second text content") -->

##### By name

    <!-- layout:layouts/fullPage(page="the page text content") -->
    <!-- layout:layouts/fullPage(page="first page text",'second page text') -->
    <!-- layout:layouts/twoColumns(column1='col a text';column2="col b text") -->

#### Nesting layout calls

    <!-- layout:layouts/twoColumns(column1=layout:layouts/fullPage(page=file:component/myComponent);column2=layout:layouts/fullPage(page=file:component/myComponent)) -->

### Wrapping
#### Calling layout in 'wrap' mode
Sometimes you just want to wrap a set of contents with the same markup (eg. page theme).
Layouts can also be used as wrappers, this means the content for the page they are called from will be wrapped with the specified layout by inserting it into the content droppoint `main`

    <!-- wrap:layouts/myLayout -->

For this to work, `layouts/myLayout.html` should contain the following droppoint:

    <!-- content:main -->

#### Passing arguments for other drop points
Similar to layouts, arguments for other drop points in the called wrap layout can be passed.

    <!-- wrap:simpleLayout(title="My Page Title";other=file:newsList,file:featuresList) -->
    <p> my actual page content that will be surrounded with the contents of simpleLayout.html</p>

#### Passing arguments for other drop points from a JSON file
Wouldn't it be nice if we could read page titles etc from a JSON file and pass it to the layout using to surround active content?
That's exactly what this is for; it resolves the drop point names from the data in JSON in a few ways.

The examples in the options below are taken from the tests, these are part of protostar and located at `<wuipt_dir>/spec/files/testsProj`
You'll find html files calling the same layout to wrap with different args as well as the corresponding JSON files.

##### Use full JSON object
The JSON file should contain an object and be located at `/singleObject.json` for below example.
This maps droppoint names to first level properties in the object


    <!-- wrap:simpleLayout(hb:singleObject) -->

##### Use data at sub path of JSON object 
The JSON file should contain an object and be located at `/multiObject.json` for below example.
The object at given index in the array is used as data for the drop points.

    <!-- wrap:simpleLayout(hb:multiObject('home')) -->
    <!-- wrap:simpleLayout(hb:multiObject('second')) -->

##### Use data in object at certain index in array
The JSON file should contain an array of objects and be located at `/multiArray.json` for below example.
The object at given index in the array is used as data for the drop points.

    <!-- wrap:simpleLayout(hb:multiArray(0)) -->
    <!-- wrap:simpleLayout(hb:multiArray(1)) -->

##### Use data in object at with certain value for certain sub property in an array
The JSON file for below example should be located at `/multiArray.json` and should contain an array of objects where, for below example, each object should have a proprety "page" with a string value assigned to it.
This is used to identify the object that contains the data for the drop points.
You could eg get the data for the object where property "page" is set to "home".

    <!-- wrap:simpleLayout(hb:multiArray(page="home")) -->
    <!-- wrap:simpleLayout(hb:multiArray(page="second")) -->

#### Wrapping contents that are inserted to layouts
It is common for html components to need wrapping markup for grid layouts etc; you want to say: surround everything that's inserted here with eg.
To achieve this behavior, you can pass the content drop point in the layout the `wrap` argument:

    <!-- content:main(wrap=layouts/rowWrapper)-->

Very powerful when combined with the ability to insert multiple contents into a single droppoint.

### Compile templates with data in JSON files
Protostar integrates Handlebars to support inclusion of templates that are rendered using data from an object or array of objects in a JSON file.
Typical example uses are lists of eg person data, articles, ..

Handlebars processing is triggered with the 'hb' namespace.
You'll notice the following path reference refers to an html fragment that contains Handlebars placeholders.
The argument (between parentheses) is simply a reference to a JSON file which should contain an object or array of data.

The following examples are taken from the bundled 'newfeats' project's index.html.
To view it in action launch the project by passing it as the only argument to protostar.

#### With a data object : once
Compiles a template resolving data from the object.
It will load the template from `<project>/cmp/person.html` and combine using data from `<project>/data/person.json`

    <!-- hb:cmp/person(data/person) -->

#### Data object with data at path
Similar to above but it will start resolving the placeholder names at the path as second argument, in this case `tags`

    <!-- hb:cmp/tag(data/person;tags) -->

#### Data object with data at path and replacement if nothing present at that path
As an extension, you can provide a third argument which protostar will render if nothing is present at the nested path.
(We refer to the non existing path `tags__` to force showing replacement)

    <!-- hb:cmp/tag(data/person;tags__;cmp/nothing) -->

#### With a data array : for every entry
If the JSON file contains an array, the template will be repeated for every object in the array.

    <!-- hb:cmp/person(data/people) -->

#### With a data array with data at path: for every entry
Similar to above but will look for data at passed nested path in each object in the array in the JSON file

    <!-- hb:cmp/tag(data/people;tags) -->

#### With a data array with data at path: for every entry and with replacement if not present
As an extension, you can provide a third argument which protostar will render if nothing is present at the nested path.
(We refer to the non existing path `tags__` to force showing replacement)

    <!-- hb:cmp/tag(data/people;tags__;cmp/nothing) -->

### Loading Javascript/CSS/lesscss when a fragment is included in the page
Often there is a relationship between a fragment of HTML, some CSS (or better even lesscss) and some Javascript.

To support this, given an html fragment located at cmp/myCmp.html :

#### Include project css or js path in page

The path style is similar to how

    <!-- linkCss:css/myCss -->

Appends `<link rel="stylesheet" href="/css/myCss.css">` to `<head>` (also picks up `*.less` files) if the contain HTML fragment is included in a page.

    <!-- linkScript:js/myScript -->

Appends `<script src="/js/myScript.js">` to `<body>` if the contain HTML fragment is included in a page.

#### Relative path support:
It can also append resources to the page located at a relative path to the active fragment.
Eg when following is included in a fragment at cmp/view/main.html :

    <!-- linkCss:./myCmp -->

Appends `<link rel="stylesheet" href="/cmp/view/myCmp.css">` to `<head>` (also picks up `*.less` files) if the contain HTML fragment is included in a page.

    <!-- linkScript:../myCmp -->

Appends `<script src="/cmp/myCmp.js">` to `<body>` if the contain HTML fragment is included in a page.


#### Look for resource with same name in same dir  :
Eg for `cmp/myCmp.html` :

    <!-- linkCss:default -->

Appends `<link rel="stylesheet" href="/cmp/myCmp.css">` to `<head>` (also picks up `*.less` files) if the contain HTML fragment is included in a page.

    <!-- linkScript:default -->

Appends `<script src="/cmp/myCmp.js">` to `<body>` if the contain HTML fragment is included in a page.

### Lorem Lipsum : variable length text placeholders
On important aspect of well implemented UX's is that they flexibly handle content of different length.

We want to detect unexpected overflows to new lines and such as soon as possible so we keep our UX implementation as ready as possible to handle real life data.

#### Tags
#### Word
Renders a different word every time it is rendered.

    <!-- lorem:word -->

#### Paragraph
Renders a different paragraph every time it is rendered.

    <!-- lorem:paragraph -->

#### Phrase
Renders a different phrase every time it is rendered.

    <!-- lorem:phrase -->

#### Shared options
The 3 lorem tags support shared arguments
##### count
Always shows a certain number of instances.

    <!-- lorem:phrase(count=2,separator='<br/>') -->

##### min/max
Alternates the number of instances shown between min and max inclusive.

    <!-- lorem:phrase(tag='p class="phrase" style="border: solid 1px black"',min=1,max=6) -->

##### tag
Surrounds each instance with the specified tag with attributes.

    <!-- lorem:phrase(tag='p class="phrase" style="border: solid 1px black"',min=1,max=6) -->

##### separator
Separates instances with the specified markup

    <!-- lorem:phrase(count=2,separator='<br/>') -->


### Building your prototypes
When you build a prototype, Protostar will create a new directory containing only those web artifacts needed for integration: HTML, CSS and other resources.
A built prototype can be shared with people who don't have Protostar as the HTML pages can just be opened with a web browser.

Protostar will:
- compile the different prototype pages to full HTML pages
- clean & prettify the generated sources
- compile and include any declared entrypoint less files
- include any declared resource dependencies
.. in the target directory you specify.



#### Ensuring the entrypoint LESS files are compiled
Protostar will automatically pick up any LESS files that are linked to from HTML files as CSS.
For more see 'Live less compilation' above.

#### Ensuring required resources are included
Typically Javascript files, fonts, images etc are required as well. These need to be declared as project relative file/directory paths in a prototype.json file at the root of your prototype project, eg:

    {
            "build":{
            "resourceDirs": {
                        "node" : [],
                        "bower" : [],
                        "project" : [
                        "img","js", "css/legacy.css", "libs/bootstrap/dist/js/bootstrap.min.js"
                        ]
                    }
            }
    }

The above example will include the 'img' and 'js' directories, the legacy.css and the bootstrap.min.js files.

#### Invoking build
To invoke the build you run Protostar with following arguments:

    protostar build /path/to/prototypeProject /build/directory/created/here

or

    node <protostar_dir>/bin/protostar.js build /path/to/prototypeProject /build/directory/created/here


## Creating a Maven project tree for a new IBM Portal theme

Protostar includes support to quickly created a custom made Maven project tree including a copy of the default Portal 8.5 theme's dynamic and static resources.
This is meant for IBM Portal theme developers and requires (at the moment) a running local install of IBM WebSphere Portal 8.5

You can read up on this in the [Portal 8.5 documentation](http://www-01.ibm.com/support/knowledgecenter/SSHRKX_8.5.0/mp/dev-theme/themeopt_move_repackstatic.dita?lang=en)

### Generating the theme project

Make sure your Portal is running, launch protostar with any project and navigate to http://localhost:8888/newPortalTheme.

Fill in some fields and click a button to download a zip containing your customized fresh copy of the bundled Portal 8.5 theme.

### Building the downloaded theme project

To build you'll need Apache Maven 2.2 or higher installed and available on the commandline
After downloading the zip extract it, open a commandline and:

    cd <yourThemeName>
    mvn package

This will generate an ear file in the `<ear project>/target` directory.

- WAS : Deploy the EAR and start the application
- Portal : as an admin Import XML and select the deploy themes xmlaccess XML

Your theme is installed.

A few characteristics of the generated Maven project tree & theme:
- WAR/EAR based theme & deployment.
- customized content spots defined in plugin.xml (prefixed based on project name)
- includes static and dynamic resources
- includes xmlaccess script to deploy and undeploy the theme

## Using WUIPT with IBM Bluemix
We have started to make WUIPT availabe @ IBM Bluemix. This is currently an alpha version that does not support all features. But feel free to give it a try.

Note: Currently it is not available as a Bluemix service so you need to deploy WUIPT from GitHub to your own Bluemix space.

### Get WUIPT up and running @ IBM Bluemix
- Log in to your Bluemix account and create a new space.
- Select "Create a app" and add the "SDK FOR NODE.JS" as a runtime.
- Connect using the "cf" comamnd line tools (as explained in the quick start guide)
- Clone the WUIPT GIT to a local directy
- Modify the following values in  `manifest.yml`
  - `host: yourCustomHostName`

```
applications:
- disk_quota: 1024M
  host: yourCustomHostName
  name: wuipt
  command: node bin/protostar.js /home/vcap/app/tutorials/1-GettingStarted/
  path: .
  domain: eu-gb.mybluemix.net
  instances: 1
  memory: 256M
```
- Push the app to your space: `cf push wuipt`
- Take a peek @ http:// `yourCustomHostName` .eu-gb.mybluemix.net/
- To leverage WUIPT @ Bluemix for your custom code, adpot the path that is passed to the `protostar.js` file in the `manifest.yml`
  - `node bin/protostar.js /home/vcap/app/pathToYourProject`



## OPENNTF

This project is an OpenNTF project, and is available under the Apache Licence V2.0. All other aspects of the project, including contributions, defect reports, discussions, feature requests and reviews are subject to the OpenNTF Terms of Use - available at [http://openntf.org/Internal/home.nsf/dx/Terms_of_Use](http://openntf.org/Internal/home.nsf/dx/Terms_of_Use).

More information available at the [project homepage](http://openntf.org/main.nsf/project.xsp?r=project/Web UI Prototyping Toolkit).

