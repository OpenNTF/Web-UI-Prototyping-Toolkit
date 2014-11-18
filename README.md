# Web UI Prototyping Toolkit - Protostar

Version 0.3.0-dev

This is a tool to facilitate the creation of static HTML prototypes from UX designs.
- Decompose pages into reusable fragments
- Instant server startup, live editing from then on. Kill and fire up again only when changing project root
- Nested inclusion of fragments
- Simplistic syntax model: mostly HTML comments that point to relative file paths
- Live less css compilation
- Make your prototypes feel like a website: automatic generation of navigation of prototypes
- Every request processes all markup and styles
- Develop your prototypes in WebKit again :-)
- Quick helpers: toggle RTL, highlight specific markup, ...
- Batch compilation and deletion of compiled files
- ..


## Prereqs
A recent node & npm build installed and available on the PATH (aka the shell can resolve the node and npm commands)

## Prereqs for the install
- You need to run Mac OS X or Linux
- Windows is not supported yet
- Download node.js from http://nodejs.org/download/

## Validating prerequisites
To make sure node & npm are available on the command line, we ask them to show their version:

    node --version
    > v0.10.29
    npm --version
    > 1.4.14
      
If you get similar version output you are done :-)

## Installing Protostar                                
- download & extract or check out the latest version to where you want to store the app directory
- open commandline
- `cd /my/path/to/protostar`
- `./install.sh`
- Installed!


## Installing Protostar manually
- Enter the protostar directory:
    `cd /my/path/to/protostar`
- Retrieving node modules:
    `npm install`
- Make sure bower is installed globally:
    `npm install -g bower`
  To verify:
    `bower --version`
    `> 1.3.8`
- Install bower modules
    `bower install`
- `./install_ckeditor_plugins.sh`    
- Optionally create a shortcut to `<protostar>/bin/protostar` in a directory on your shell PATH for easy shell access through the protostar command

## Validating the Protostar installation
To run Protostar with the test project
- open a terminal
- `cd /my/path/to/protostar`
- `./bin/protostar ./projects/test`
- open a browser to http://localhost:8888

## Running
Running protostar boils down to invoking it and passing it a directory path as the only argument: the website root dir
If you have the protostar command on your PATH:
    protostar <website_root_dir>`
Otherwise:
    `<protostar_dir>/bin/protostar <website_root_dir>`
If the script does not work for you, you can just invoke the protostar.js file using node and pass the project root directory as first parameter, like for example assuming inside the protostar dir:
    `node bin/protostar.js projects/test`

You can access help/intro after starting on http://localhost:8888/pshelp



# Intro & help

You can access the following (in slightly nicer formatting) after starting protostar on http://localhost:8888/pshelp
or by using the following shortcut from within a rendered template or backend screen: Alt-Shift-H

## INTRO
ProtoStar is a tool to facilitate the creation of static HTML prototypes from UX designs.
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

## Goals
- Obvious gains by avoiding duplication
- Bring prototype output closer to developer input
- Bring prototypes closer to live site feeling
- KISS, transparant, do the expected thing
- Offload and facilitate the developer(s) wherever possible
- Facilitate consistency, standardization, flexibility
- Get more value and ROI from the prototypes in broader context
- Quick, easy, hassle-free. Focus on what matters, do it once and do it right

## Getting started
When you start protostar you should pass it a directory as argument; this directory will represent your project root (and should thus come to contain and index.html file).
All references will be resolved relative to this directory as long as the server process runs.

## Leveraging reusable html fragments
As a simple example create three files: index.html, other.html and nav.html. 
Put some basic HTML page markup in both index.html & other.html and any markup in nav.html
Verify you can access the 2 pages by navigating to running server with a browser. You should get to see your index.html, same goes if you change the path to other.html
Add the following to both html pages: `<!-- file:nav -->` and reload both index and other. 
 The contents of nav should have replaced that comment.
Congrats, you're leveraging a reusable html fragment in your prototypes!

The referenced files, like nav in this example, can contain other references in turn - this feature can be used to create 'aliases', a reusable fragment with stable name (eg. 'header') that only contains another reference (eg. 'header-big' or 'header-small')

## The layout and content namespaces

Besides the file namespace, protostar has the two aforementioned namespaces.

The goal is quite simple: enable reusable layouts that can show the same content in different locations on the page etc.

A layout contains content placeholders that will display the content that is configured in the layout marker comment in the source page.
A content placeholder: 

    <!-- content:myContentSpotName -->
    
A layout call: 

    <!-- layout:myLayout(file:nav,file:menu) -->
    
A layout protostar is typically included in a top level page while passing in a number of components to be shown in that layout.

The layouts are named to enable assignment by name (and convention) but this is still among others todo :-)

## Commands
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

## Using Protostar in-page functionality
Protostar adds the scripts below automatically if they are not present yet: 
    
    <script src="/ps/ext/jquery-1.11.1.js"></script>
    <script src="/ps/ext/keypress.js"></script>
    <script src="/ps/assets/views.js"></script>

If you include any script reference pointing to eg. jquery, it will assume jquery is already in the page.
To enable the protostar in-page functionality ensure following scripts are at the bottom of your composed html pages, do not add duplicates of jquery or keypress if they are already included!

## Dynamic parts

Protostar maintains an html file that contains `<li>` items for the detected prototypes and writes them to a subdirectory `_dynamic`
- list-referencing-bare: will return list items with links to files that contain references. To include just call file:_dynamic/list-referencing-bare in your nav
- list-compiled-bare: the same but for compiled templates. By including this in your markup and batch compiling all templates you'll have created a composed crosslinked minisite of your prototypes.

## Live lesscss compilation

As of recently you can just reference a non-existant css file at the same level as a less file, and protostar will serve the compiled css & css map as needed.
So all you need is an ordinary `<link rel="stylesheet" type="text/css" href="less/styles.css"/>` to actually load the compiled styles from `less/styles.less`

### The old way 
To enable on the fly compilation to css include your less file as follows:

    <link rel="stylesheet" type="text/css" href="less/styles.less?compile"/>

This will cause protostar to return the compiled css for those files.

## Viewing raw template for a page
- Raw: To view the unprocess template in your browser for a composed page just add the raw request parameter, eg http://localhost:8888/index.html?raw
- Compiled source : http://localhost:8888/index.html?source
- Compiled and cleaned source : http://localhost:8888/index.html?sourceClean

## Screenshot
- Taking a screenshot: http://localhost:8888/index.html?cheese and check `<projectDir>/screenshots`
- Taking screenshots from all prototype pages for all responsive sizes : http://localhost:8888/index.html?command=screenshot-all and check `<projectDir>/screenshots`

## Layouts
### Assign by order
Display in first droppoint in layout:
    
    <!-- layout:layouts/fullPage(file:component/myEditableComponent) -->

Spread over droppoints in layout, first and second in this case:

    <!-- layout:layouts/fullPage(file:component/myComponent;file:component/myComponent) -->

Show both in first droppoint:

    <!-- layout:layouts/fullPage(file:component/myComponent,file:component/myComponent) -->

### Assign by name

Assign to content drop point `page`, eg `<!-- content:page -->`
    
    <!-- layout:layouts/fullPage(page=file:component/myComponent) -->

Assign both to `page`
    
    <!-- layout:layouts/fullPage(page=file:component/myComponent,file:component/myComponent) -->

Assign a component to both `column1` and `column2`
    
    <!-- layout:layouts/twoColumns(column1=file:component/myComponent;column2=file:component/myComponent) -->

Assign two components to `column1` and `column2`    

    <!-- layout:layouts/twoColumns(column1=file:component/myComponent,file:component/myComponent;column2=file:component/myComponent,file:component/myComponent) -->

### Passing text strings as content    

#### By order    
    
    <!-- layout:layouts/fullPage('this will be assigned') -->
    <!-- layout:layouts/fullPage("this will be assigned") -->
    <!-- layout:layouts/fullPage('first text content',"second text content") -->
    
#### By name    
    
    <!-- layout:layouts/fullPage(page="the page text content") -->
    <!-- layout:layouts/fullPage(page="first page text",'second page text') -->
    <!-- layout:layouts/twoColumns(column1='col a text';column2="col b text") -->
    
### Nesting layout calls
    
    <!-- layout:layouts/twoColumns(column1=layout:layouts/fullPage(page=file:component/myComponent);column2=layout:layouts/fullPage(page=file:component/myComponent)) -->

## Wrapping
### Calling layout in 'wrap' mode
Sometimes you just want to wrap a set of contents with the same markup (eg. page theme).
Layouts can also be used as wrappers, this means the content for the page they are called from will be wrapped with the specified layout by inserting it into the content droppoint `main`
 
    <!-- wrap:layouts/myLayout -->

For this to work, `layouts/myLayout.html` should contain the following droppoint: 

    <!-- content:main -->

### Wrapping contents that are inserted to layouts
It is common for html components to need wrapping markup for grid layouts etc; you want to say: surround everything that's inserted here with eg.
To achieve this behavior, you can pass the content drop point in the layout the `wrap` argument:

    <!-- content:main(wrap=layouts/rowWrapper)-->

Very powerful when combined with the ability to insert multiple contents into a single droppoint.      



# OPENNTF

This project is an OpenNTF project, and is available under the Apache Licence V2.0. All other aspects of the project, including contributions, defect reports, discussions, feature requests and reviews are subject to the OpenNTF Terms of Use - available at [http://openntf.org/Internal/home.nsf/dx/Terms_of_Use](http://openntf.org/Internal/home.nsf/dx/Terms_of_Use).

More information available at the [http://openntf.org/main.nsf/project.xsp?r=project/Web UI Prototyping Toolkit](project homepage).
