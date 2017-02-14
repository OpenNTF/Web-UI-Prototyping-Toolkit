'use strict';

const RequestUrlWrapper = require("./RequestUrlWrapper");

class RequestContext {
    /**
     *
     * @param {IncomingMessage} request
     * @param {ServerResponse} response
     * @param {ProtostarRuntime} runtime
     * @param {TemplateComposer} composer
     * @param {Project} project
     */
    constructor(request, response, runtime, composer, project){
        /**
         * @type IncomingMessage
         */
        this.request = request;
        /**
         * @type ServerResponse
         */
        this.response = response;
        /**
         * @type ProtostarRuntime
         */
        this.runtime = runtime;
        /**
         * @type TemplateComposer
         */
        this.composer = composer;
        /**
         * @type Project
         */
        this.project = project;

        /**
         * @type {RequestUrlWrapper}
         */
        this.wr = new RequestUrlWrapper(request);
    }
    writeJson(content, status = 200, headers = {'Content-Type': 'application/json'}){
        let cnt = typeof content === 'string' ? content : JSON.stringify(content);
        this.response.writeHead(status, headers);
        this.response.write(cnt);
        this.response.end();
    }
}

module.exports = RequestContext;