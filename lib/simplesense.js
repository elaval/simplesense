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



  return this;
}; 


SimpleSense.prototype.Start = function() {
  return 'awesome';
};


module.exports = SimpleSense;



var mydevice = new hid.HID(path);

mydevice.on("data", function(data) {
  console.log(data)
});


