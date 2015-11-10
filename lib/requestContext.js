"ust"

var requestContext = exports;

requestContext.RequestContext = function(request, response, runtime, composer, project){
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
};