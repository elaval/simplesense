/*
 * webduino
 * https://github.com/elaval/webduino
 *
 * Copyright (c) 2014 Ernesto Laval
 * Licensed under the MIT license.
 */

'use strict';

var hid = require("node-hid"),
  request = require("request"),
  fs    = require('fs'),
  nconf = require('nconf'),
  five = require('johnny-five');

nconf.argv()
           .env()
           .file({ file: __dirname+'/config.json' });

/**
 * SimpleSense
 * @constructor
 *
 * @description 
 *
 */
var SimpleSense = function(opts) {
  var self = this;

  // Ensure opts is an object
  opts = opts || {};

  if ( !(this instanceof SimpleSense) ) {
    return new SimpleSense(opts);
  }

  this.Start = function() {
    //
    // Setup nconf to use (in-order):
    //   1. Command-line arguments
    //   2. Environment variables
    //   3. A file located at 'path/to/config.json'
    //
 
    var xivelyFeed = nconf.get("feedId");
    var xivelyApi = nconf.get("apiKey");

    //var xivelyFeed = '1598276619';
    //var xivelyApi = 'uOx2FlFnEfqmCrV5cHkXeRetOVwzlZsXusZLhpZ7x2f3TSRj';

    console.log(xivelyFeed);
    console.log(xivelyApi);

    var hidDevices = hid.devices();

    return "started";
  }

  return this;
}; 


SimpleSense.prototype.Start = function() {
  return 'awesome';
};


module.exports = SimpleSense;


