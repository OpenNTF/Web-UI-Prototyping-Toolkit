var fs = require("fs");
var hbsUtils = exports;


/**
 *
 * @param {String} hbsSource the source contain hbs droppoints like {{> blah }}
 * @param {String} partialsDirProjectPath project relative dir path containing the hbs partials eg. views/partials
 * @return {String}
 */
hbsUtils.convertPartialsToFileIncludes = function(hbsSource, partialsDirProjectPath) {
    return hbsSource.replace(/{{>[ ]?/g, '<!-- file:' + partialsDirProjectPath + "/").replace(/[ ]?}}/g, ' -->');
};

/**
 *
 * @param {String} hbsSource the source contain hbs droppoints like {{> blah }}
 * @param {String} hbsLayoutFileProjectPath the main hbs layout file path relative to project root eg. view/layouts/default.hbs
 * @return {String}
 */
hbsUtils.convertHbsLayoutToWrap = function(hbsSource, hbsLayoutFileProjectPath) {
    var layoutPath = hbsLayoutFileProjectPath;
    layoutPath = layoutPath.substring(0, layoutPath.lastIndexOf('.'));
    var wrapStatement = '<!-- wrap:' + layoutPath + ' -->\n';
    return wrapStatement + hbsSource;
};

/**
 *
 * @param {String} hbsSource the source contain hbs droppoints like {{> blah }}
 * @param {String} hbsLayoutFileProjectPath the main hbs layout file path relative to project root eg. view/layouts/default.hbs
 * @return {String}
 */
hbsUtils.injectHbsLayoutBodyContent = function(hbsLayoutFilePath, bodyContent) {
    var layoutSource = fs.readFileSync(hbsLayoutFilePath, 'utf8');
    layoutSource = layoutSource.replace(/\{\{>[ ]*body[ ]*}}/, bodyContent+"");
    return layoutSource;
    //var layoutPath = hbsLayoutFilePath;
    //layoutPath = layoutPath.substring(0, layoutPath.lastIndexOf('.'));
    //var wrapStatement = '<!-- wrap:' + layoutPath + ' -->\n';
    //return wrapStatement + hbsSource;
};

/**
 * Replaces the main hbs layout body partial tag with the typical main content drop point
 * @param {String} src hbs markup containing a {{> body }} droppoint
 * @return {String}
 */
hbsUtils.replaceHbsBodyPartialWithMainDroppoint = function(src){
    return src.replace(/\{\{>[ ]*body[ ]*}}/, '<!-- content:main -->');
};


/**
 *
 * @param {String} hbsSource the source contain hbs droppoints like {{> blah }}
 * @param {String} partialsDirProjectPath project relative dir path containing the hbs partials eg. views/partials
 * @param {String} hbsLayoutFileProjectPath the main hbs layout file path relative to project root eg. view/layouts/default.hbs
 * @return {String}
 */
hbsUtils. prepareHbsSource = function(hbsSource, partialsDirProjectPath, hbsLayoutFileProjectPath) {
    var src = hbsUtils.convertPartialsToFileIncludes(hbsSource, partialsDirProjectPath);
    src = hbsUtils.convertHbsLayoutToWrap(src, hbsLayoutFileProjectPath);
    return src;
};