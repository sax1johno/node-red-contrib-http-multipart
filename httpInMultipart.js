/**
 * Copyright 2013, 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

/** 
 * Multer modifications Licensed under the MIT License
 * Copyright (C) 2016, John O'Connor
 **/
module.exports = function(RED) {
    "use strict";
    var bodyParser = require("body-parser");
    var getBody = require('raw-body');
    var cors = require('cors');
    var jsonParser = bodyParser.json({defer: true});
    var urlencParser = bodyParser.urlencoded({extended:true, defer: true});
    var onHeaders = require('on-headers');
    var typer = require('media-typer');
    // Use multer for parsing multi-part forms with fil
    var multer = require('multer');
    var upload = multer({
        "dest": "/tmp"
    });
    var isUtf8 = require('is-utf8');
    var formidable = require('formidable');
    
    var corsSetup = false;

    function createRequestWrapper(node,req) {
        // This misses a bunch of properties (eg headers). Before we use this function
        // need to ensure it captures everything documented by Express and HTTP modules.
        var wrapper = {
            _req: req
        };
        var toWrap = [
            "param",
            "get",
            "is",
            "acceptsCharset",
            "acceptsLanguage",
            "app",
            "baseUrl",
            "body",
            "cookies",
            "fresh",
            "hostname",
            "ip",
            "ips",
            "originalUrl",
            "params",
            "path",
            "protocol",
            "query",
            "route",
            "secure",
            "signedCookies",
            "stale",
            "subdomains",
            "xhr",
            "socket" // TODO: tidy this up
        ];
        toWrap.forEach(function(f) {
            if (typeof req[f] === "function") {
                wrapper[f] = function() {
                    node.warn(RED._("httpInMultipart.errors.deprecated-call",{method:"msg.req."+f}));
                    var result = req[f].apply(req,arguments);
                    if (result === req) {
                        return wrapper;
                    } else {
                        return result;
                    }
                }
            } else {
                wrapper[f] = req[f];
            }
        });


        return wrapper;
    }
    
    function createResponseWrapper(node,res) {
        var wrapper = {
            _res: res
        };
        var toWrap = [
            "append",
            "attachment",
            "cookie",
            "clearCookie",
            "download",
            "end",
            "format",
            "get",
            "json",
            "jsonp",
            "links",
            "location",
            "redirect",
            "render",
            "send",
            "sendfile",
            "sendFile",
            "sendStatus",
            "set",
            "status",
            "type",
            "vary"
        ];
        toWrap.forEach(function(f) {
            wrapper[f] = function() {
                node.warn(RED._("httpInMultipart.errors.deprecated-call",{method:"msg.res."+f}));
                var result = res[f].apply(res,arguments);
                if (result === res) {
                    return wrapper;
                } else {
                    return result;
                }
            }
        });
        return wrapper;
    }

    var corsHandler = function(req,res,next) { next(); }

    if (RED.settings.httpNodeCors) {
        corsHandler = cors(RED.settings.httpNodeCors);
        RED.httpNode.options("*",corsHandler);
    }
    
    function HTTPIn(n) {
        RED.nodes.createNode(this,n);
        if (RED.settings.httpNodeRoot !== false) {
            if (!n.url) {
                this.warn(RED._("httpInMultipart.errors.missing-path"));
                return;
            }
            this.url = n.url;
            this.method = n.method;
            this.swaggerDoc = n.swaggerDoc;
            this.fields = n.fields;
            var node = this;
            
            this.rawBodyParser = function(req, res, next) {
                if (req._body) { return next(); }
                req.body = "";
                req._body = true;
                
                var isText = true;
                    var checkUTF = false;
                    var isMultiPart = false;
            
                    if (req.headers['content-type']) {
                        var parsedType = typer.parse(req.headers['content-type'])
                        if (parsedType.type == "multipart") {
                            console.log("type is multipart");
                            isText = false;
                            isMultiPart = true;
                        }
                        else if (parsedType.type === "text") {
                            isText = true;
                        } else if (parsedType.subtype === "xml" || parsedType.suffix === "xml") {
                            isText = true;
                        } else if (parsedType.type !== "application") {
                            isText = false;
                        } else if (parsedType.subtype !== "octet-stream") {
                            checkUTF = true;
                        }
                    }
                    
                    if (isMultiPart) {
                        var fields = JSON.parse(node.fields);
                        upload.fields(fields)(req, res, function (err) {
                            if (err) {
                                console.log(err);
                                next(err);
                            } else {
                                console.log("file = ", req.file);
                                console.log("body = ", req.body);
                                // next("Should've made the upload happen!");
                                next();
                            }
                        });
                    } else {
                        getBody(req, {
                            length: req.headers['content-length'],
                            encoding: isText ? "utf8" : null
                        }, function (err, buf) {
                            console.log("inside of getBody");
                            if (err) { return next(err); }
                            if (!isText && checkUTF && isUtf8(buf)) {
                                buf = buf.toString();
                                req.body = buf;
                                next();
                            } else {
                                req.body = buf;
                                next();
                            }
                            // req.body = buf;
                        });
                    }
                };

            this.errorHandler = function(err,req,res,next) {
                node.warn(err);
                res.sendStatus(500);
            };

            this.callback = function(req,res) {
                var msgid = RED.util.generateId();
                res._msgid = msgid;
                if (node.method.match(/(^post$|^delete$|^put$|^options$)/)) {
                    node.send({_msgid:msgid,req:req,res:createResponseWrapper(node,res),payload:req.body});
                } else if (node.method == "get") {
                    node.send({_msgid:msgid,req:req,res:createResponseWrapper(node,res),payload:req.query});
                } else {
                    node.send({_msgid:msgid,req:req,res:createResponseWrapper(node,res)});
                }
            };

            var httpMiddleware = function(req,res,next) { next(); }

            if (RED.settings.httpNodeMiddleware) {
                if (typeof RED.settings.httpNodeMiddleware === "function") {
                    httpMiddleware = RED.settings.httpNodeMiddleware;
                }
            }

            var metricsHandler = function(req,res,next) { next(); }

            if (this.metric()) {
                metricsHandler = function(req, res, next) {
                    var startAt = process.hrtime();
                    onHeaders(res, function() {
                        if (res._msgid) {
                            var diff = process.hrtime(startAt);
                            var ms = diff[0] * 1e3 + diff[1] * 1e-6;
                            var metricResponseTime = ms.toFixed(3);
                            var metricContentLength = res._headers["content-length"];
                            //assuming that _id has been set for res._metrics in HttpOut node!
                            node.metric("response.time.millis", {_msgid:res._msgid} , metricResponseTime);
                            node.metric("response.content-length.bytes", {_msgid:res._msgid} , metricContentLength);
                        }
                    });
                    next();
                };
            }

            if (this.method == "get") {
                RED.httpNode.get(this.url,httpMiddleware,corsHandler,metricsHandler,this.callback,this.errorHandler);
            } else if (this.method == "post") {
                RED.httpNode.post(this.url,httpMiddleware,corsHandler,metricsHandler,this.rawBodyParser, this.callback,this.errorHandler);
            } else if (this.method == "put") {
                RED.httpNode.put(this.url,httpMiddleware,corsHandler,metricsHandler,jsonParser,urlencParser,this.rawBodyParser,this.callback,this.errorHandler);
            } else if (this.method == "delete") {
                RED.httpNode.delete(this.url,httpMiddleware,corsHandler,metricsHandler,jsonParser,urlencParser,this.rawBodyParser,this.callback,this.errorHandler);
            }

            this.on("close",function() {
                var node = this;
                RED.httpNode._router.stack.forEach(function(route,i,routes) {
                    if (route.route && route.route.path === node.url && route.route.methods[node.method]) {
                        routes.splice(i,1);
                    }
                });
            });
        } else {
            this.warn(RED._("httpInMultipart.errors.not-created"));
        }
    }
    RED.nodes.registerType("httpInMultipart",HTTPIn);
}
