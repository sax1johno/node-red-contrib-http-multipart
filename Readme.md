# Node-Red Node HTTP with Multi-Part Support

This node is a version of the Node-Red HTTP-in node that includes support for multi-part forms and files using Multer.

Use this module anywhere you would use the `node-red-http-in` node and would like to have file support.  The module will usually be used with the `POST` method that contains a form with a file upload button.

## Installation

```sh
$ npm install node-red-contrib-http-multipart
```
node-red should automatically detect the new node upon restarting of the server.

## Usage
Once installed, a new `http-multipart` node will be available in your node-red nodes panel. Drag the node onto the flow sheet and use as you would the other http-in node.  Output of the node will be a message which contains the files in a `msg.req.files` object.

To retrieve the file object, you can add a function node to the out port of the node that reads the msg.req.files object.

## Configuration
Configuration of this node is the same as the `node-red-http-in` node with the exception of the `fields` config option.  `fields` refers to the fields in the form that will contain files.

Eg. For a form with the following field
```html
<input type="file" name="myUploadedFile" />
```
the `fields` section of your node configuration would contain the following:
```
[ { "name": "myUploadedFile"} ]
```
The fields configuration is passed directly to the [Fields](https://github.com/expressjs/multer#fieldsfields) option in the multer plugin, so you can use any options that would work for multer in the configuration area.
ex:
```
[
  { name: 'avatar', maxCount: 1 },
  { name: 'gallery', maxCount: 8 }
]
```
#### Example
With HTML like the following:
```html
...
<form action="/upload" method="POST">
    <input type="file" name="myFile" />
    <input type="submit />
</form>
...
```
You can upload to a node with the following configuration:
```javascript
[{ "name": "myFile" }]
```

and access the files using the following function on the out port of the node
```javascript
var fields = msg.req.fields;
msg.fields = Object.keys(fields);
var myFile = fields["myFile"][0];
msg.localFilename = myFile.path
...
```
All of the available properties of the file object can be found in the [Multer documentation](https://www.npmjs.com/package/multer#file-information).

License
----

MIT

Copyright
----

&copy; 2016 John O'Connor
