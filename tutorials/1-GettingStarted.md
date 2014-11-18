# Working with the Web UI Prototyping Toolkit

This series is intended to provide step by step guides on how to use WUIPT. Each of them will cover different topics. For general reference and on overview of the available features please take a look @ the README file.

## Part 1 - Getting Started
In the first part of the series we will explain how to create a first simple project that already leverages quite a few features from WUIPT.

### Install
Please follow the instructions in the README file to get WUIPT up and running. For your convenience you can use the "Protostar.desktop (Linux)" and "Protostar.app (Mac OS X)" files to start WUIPT without using the command line.


### Basic Setup
1. Create a folder with the projectname anywhere on your harddrive, e.g. `1-GettingStarted`
2. Within that folder create the following subfolders
    - `layouts`
    - `components`
    - `images`
    - `less`
3. Create `index.html` file with `<h1>Hello WUIPT!</h1>` as the content.
3. Drag and Drop the `1-GettingStarted` folder onto the `Protostar.desktop/app` file. This will start WUIP including a lightweight webserver
    - If you want to start WUIPT using the command line to see the log output execute the following command via the terminal: `node /pathToWUIPT/bin/protostar.js /pathTo1-GettingStarted/1-GettingStarted`
4. Go to: [http://localhost:8888](http://localhost:8888) in your favorite browser.

### Working with LESS CSS
In this section we will add some more artifacts to the page and make actually really use of WUIPT for the first time.

1. To make this sample a bit more fun please install bootstrap using bower into the `1-GettingStarted` directory `bower install bootstrap`
2. Create the LESS file within the `less` folder, e.g. myStyles.less
  - You can use the following sample content:
    ```
    @brand-primary: #00648D;
    @background-light-blue: #82D1F5;
    @background-light-green: #008ABF;
    @color-very-light: #fff;
    @font-size-small: 10px;
    @font-size-base: 12px;
    @font-size-large: 17px;
    @font-standard: "Helvetica Neue", Helvetica, Arial, sans-serif;

    body {
        font-family: @font-standard;
        background-color: @background-light-blue;
    }

    h1 {
        font-size: @font-size-large;
        color: @brand-primary;
    }

    .sampleBoxContent {
        background-color: @background-light-green;
        padding: 10px;
        margin: 10px 0px;
        .header {
            font-size: @font-size-large;
            color: @color-very-light;
        }
        .body {
            font-size: @font-size-base;
        }
    }

    ul.nav {
            li {
                float: left;
                list-style: none;
                font-size: @font-size-small;  
                padding: 0px 10px;
                a {
                    color: @brand-primary;
                }
            }
    }
      ```

3. Replace the content of the index.html with the following markup:

    ```
    <!doctype html>
    <html>
    <head>
        <title>Sample Project</title>
        <link rel="stylesheet" type="text/css" href="/ps/ext/bootstrap/dist/css/bootstrap.css"/>
        <link rel="stylesheet" type="text/css" href="/less/myStyles.less?compile"/>
    </head>
    <body>

    <div class="container">
        <div class="row">
            <div class="col-md-12 col-sm-12 col-xs-12">
                <ul class="nav">
                    <!-- file:_dynamic/list-referencing-bare -->
                </ul>  
            </div>
        </div>
        <div class="row">
            <div class="col-md-12 col-sm-12 col-xs-12">
                <h1>Hello WUIPT!</h1>
                <div class="sampleBoxContent">
                    <div class="header">Sample Header</div>
                    <div class="body">This is sample body content.</div>
                </div>
            </div>
             <div class="col-md-12 col-sm-12 col-xs-12">
                <div class="sampleBoxContent">
                    <div class="header">News</div>
                    <div class="body">There is breaking news!</div>
                </div>
            </div>
        </div>
    </div>

    <!-- file:/ps/assets/viewScripts -->
    </body>
    </html>
    ```
    - A couple of comments
        - `<link rel="stylesheet" type="text/css" href="/less/myStyles.less?compile"/>` links to the LESS file and will automatically compile it when calling the page in a browser.
        - `<!-- file:_dynamic/list-referencing-bare -->` automatically generates a unordered list with all the pages found in the project directory.
        - `<!-- file:/ps/assets/viewScripts -->` includes a couple of handy scripts that are leveraged for inline editing...

### Start using layouts and components
So far the whole page is one monolitic block. In this section we will leverage another WUIPT feature to split files up in reusable components. The idea is to extract the different components so that they can be reused across the prototype and we avoid code duplication and speed up code development.

Hint: To access the help you can always press `Alt+Shift+H` and return to the homepage with `Alt+Shift+H`


1. Please create the following HTML files  
  - components/header.html

        ```
        <!doctype html>
        <html>
        <head>
            <title>Sample Project</title>
            <link rel="stylesheet" type="text/css" href="/ps/ext/bootstrap/dist/css/bootstrap.css"/>
            <link rel="stylesheet" type="text/css" href="/less/myStyles.less?compile"/>
        </head>
        <body>
        ```

  - components/footer.html

        ```
        <!-- file:/ps/assets/viewScripts -->
        </body>
        </html>
        ```
  - components/nav.html

        ```
        <ul class="nav">
            <!-- file:_dynamic/list-referencing-bare -->
        </ul>
        ```

  - components/headerBox.html

        ```
        <h1>Hello WUIPT!</h1>
        <div class="sampleBoxContent">
            <div class="header">Sample Header</div>
            <div class="body">This is sample body content.</div>
        </div>
        ```

  - components/newsBox.html

        ```
        <div class="sampleBoxContent">
            <div class="header">News</div>
            <div class="body">There is breaking news!</div>
        </div>
        ```

  - layouts/2RowLayout.html

        ```
        <div class="container">
            <div class="row">
                <div class="col-md-12 col-sm-12 col-xs-12">
                    <!-- file:components/nav -->
                </div>
            </div>
            <div class="row">
                <div class="col-md-12 col-sm-12 col-xs-12">
                    <!-- content:mainHeader -->
                </div>
                 <div class="col-md-12 col-sm-12 col-xs-12">
                   <!-- content:mainBody -->
                </div>
            </div>
        </div>
        ```

  - `<!-- file:components/nav -->` will link directly to the navigation component so that we have it available whenever the layout is being used.
  - `<!-- content:mainHeader --> & <!-- content:mainBody -->` defines a conenten spot that can hold a component (see the new index.html that we create in the next step)

3. Now we need to glue all the components together again. To do that replace the index.html with the following content:
    ```
    <!-- file:components/header -->

    <div class="container">
        <!-- layout:layouts/2RowLayout(mainHeader=file:components/headerBox;mainBody=file:components/newsBox) -->
    </div>

    <!-- file:components/footer -->
    ```
    - `<!-- layout:layouts/2RowLayout(mainHeader=file:components/headerBox;mainBody=file:components/newsBox) -->` tells the WUIPT which components should be placed in which content spot.
4. Open [http://localhost:8888](http://localhost:8888) in your browser and the result should exactly be the same as in the previous step.


### Reuse components in a different page
This section shows a sample of how to reuse the components throughout the pages.

1. Create a second layout file `layouts/2ColumnLayout.html`

    ```
    <div class="container">
        <div class="row">
            <div class="col-md-12 col-sm-12 col-xs-12">
                <!-- file:components/nav -->
            </div>
        </div>
        <div class="row">
            <div class="col-md-12 col-sm-12 col-xs-12">
                <!-- content:mainHeader -->
            </div>
            <div class="col-md-6 col-sm-6 col-xs-6">
                <!-- content:mainBodyLeft -->
            </div>
            <div class="col-md-6 col-sm-6 col-xs-6">
                <!-- content:mainBodyRight -->
            </div>
        </div>
    </div>
    ```

2. Create a second file next to the index.html called `news.html` with the following content:

    ```
    <!-- file:components/header -->

    <div class="container">
        <!-- layout:layouts/2ColumnLayout(mainHeader=file:components/headerBox;mainBodyLeft=file:components/newsBox;mainBodyRight=file:components/newsBox) -->
    </div>

    <!-- file:components/footer -->
    ```

3. Go to your browser and refresh the `index.html`. You should see the `news.html` appear in the navigation. Click on it and have a look at the result.


### Exporting "standard" HTML/CSS and screenshots
From time to time you need to show the results to your boss or pass them on to someone who is not using WUIPT. There are two easy options to do this:
1. Create screenshots of all the pages for different screen resolutions
    - Just go to:  [http://localhost:8888/index.html?command=screenshot-all](http://localhost:8888/index.html?command=screenshot-all) and have a look at the screenshots directory in your project.
    - This may take a while depending on the size of the project
2. Export plain HTML/CSS
    - Execute the following command in the terminal: `node /pathToWUIPT/bin/protostar.js build /pathTo1-GettingStarted/1-GettingStarted /pathOutsideOfProject/export`
