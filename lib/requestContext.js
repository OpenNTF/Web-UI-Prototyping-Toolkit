var requestContext = exports;

requestContext.RequestContext = function(request, response, runtime, composer, project){
    /**
     * @type http.IncomingMessage
     */
    this.request = request;
    /**
     * @type http.ServerResponse
     */
    this.response = response;
    /**
     * @type ProtostarRuntime
     */
    this.runtime = runtime;
    /**
     * @type templateComposer.TemplateComposer
     */
    this.composer = composer;
    /**
     * @type protostarProject.Project
     */
    this.project = project;
};