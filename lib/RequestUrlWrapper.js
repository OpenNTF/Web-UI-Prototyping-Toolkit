var url = require("url");

function RequestUrlWrapper(req){
    this.parsedUrl = url.parse(req.url, true);
    this.pathname = decodeURIComponent(this.parsedUrl.pathname);
    this.method = req.method.toUpperCase();
    this.requestUrl = req.url;

    this.getUrl = function(){
        return this.requestUrl;
    };
    /**
     * @return {string}
     */
    this.getPathname = function(){
        return this.pathname;
    };
    this.getQueryObject = function(){
        return this.parsedUrl.query;
    };
    /**
     * @param {string} prefix
     * @return {boolean}
     */
    this.pathnameStartsWith = function(prefix){
        return this.parsedUrl.pathname.indexOf(prefix) === 0;
    };
    /**
     * @param {string} pathname
     * @return {boolean}
     */
    this.pathnameEquals = function(pathname){
        return this.pathname === pathname;
    };
    /**
     * @return {string}
     */
    this.getMethod = function(){
        return this.method;
    };
    /**
     * @return {boolean}
     */
    this.hasQuery = function(){
        return typeof this.parsedUrl.query === 'object' && Object.keys(this.parsedUrl.query).length >0;
    };
    /**
     *
     * @param {string} paramName
     * @return {boolean}
     */
    this.containsQueryParam = function(paramName){
        return this.hasQuery() && Object.prototype.hasOwnProperty.call(this.parsedUrl.query, paramName);
    };
    /**
     *
     * @param {string} paramName
     * @param {string} val
     * @return {boolean}
     */
    this.containsQueryParamValue = function(paramName, val){
        return this.containsQueryParam(paramName) && this.getQueryParam(paramName) === val;
    };
    /**
     *
     * @param {string} paramName
     * @return {string|undefined}
     */
    this.getQueryParam = function(paramName){
        return this.parsedUrl.query[paramName];
    };

    /**
     * @return {string[]}
     */
    this.getQueryParamNames = function(){
        return Object.keys(this.parsedUrl.query);
    };
}

module.exports = RequestUrlWrapper;