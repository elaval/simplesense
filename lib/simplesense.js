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
  five = require('johnny-five'),
  _ = require('underscore');

var homeDir = require('path').dirname(require.main.filename);
//
// Setup nconf to use (in-order):
//   1. Command-line arguments
//   2. Environment variables
//   3. A file located at 'path/to/config.json'
//
nconf.argv()
       .env()
       .file({ file: homeDir+'/config.json' });

var xivelyFeed = nconf.get("feedId");
var xivelyApi = nconf.get("apiKey");

//var xivelyFeed = '1598276619';
//var xivelyApi = 'uOx2FlFnEfqmCrV5cHkXeRetOVwzlZsXusZLhpZ7x2f3TSRj';

console.log("Feedid: "+xivelyFeed);
console.log("Api Key: "+xivelyApi);



/**
 * SimpleSense
 * @constructor
 *
 * @description 
 *
 */
var SimpleSense = function(opts) {
  var self = this;
  var tempbuffer=[];
  var lightbuffer=[];
  var humiditybuffer=[];

  // Ensure opts is an object
  opts = opts || {};

  if ( !(this instanceof SimpleSense) ) {
    return new SimpleSense(opts);
  }

  this.Start = function() {



    // Get list of HID Devices
    var hidDevices = hid.devices();

    // Fidn device corresponig to SLT1 Sensor (vendorId 1240, productId 63)
    var mydevice = null;

    // Records the path for each HID device
    var devicePath = {};
    console.log("HID Devices");
    var numDevices = hidDevices.length;
    for (var i = 0; i < numDevices; i++) {
      var deviceId = hidDevices[i].vendorId +"-"+ hidDevices[i].productId;

      if (!devicePath[deviceId]) {
        devicePath[deviceId]=hidDevices[i].path;
        var preChar = deviceId == '1240-63' ? '*' : '';
        console.log(preChar+hidDevices[i].product + " - Path" + hidDevices[i].product);
      }

    }



    // El dispositivo SLTH1 está en la lista
    if (devicePath["1240-63"]) {
      var mydevice = new hid.HID(devicePath["1240-63"]);
      getSamples(mydevice, 1000);
      recordValues(5000);
    }



    return "Started";
  }

  var getSamples = function(mydevice, delay) {
    var cmd = new Buffer(64);
    cmd[0] = '0x87';

    var tmp = "";
    var luz = "";
    var hum = "";

    mydevice.on('data', function(data) {
      var replycmd = data[0];

      var newtmp = ((data[2] << 8) + data[1])*0.0625;

      // Chequea que no sea un valor anómalo (> 500 grados)
      tmp = newtmp <500 ? newtmp : tmp;
      
      luz = ((data[4] << 8) + data[3])/1.2;
      hum = ((data[6] << 8) + data[5])/8.5;

      //console.log("Cmd: "+replycmd);
      //console.log("Tmp: "+tmp+"Luz: "+luz+"Hum: "+hum);
      //console.log(lightbuffer);
      if (tmp) {
        tempbuffer.push(tmp);
      }
      
      lightbuffer.push(luz);
      humiditybuffer.push(hum);

    });


    // Cada 5 segundos genera datos simulados de temperatura y los registra para el dispositivo corespondiente
    setInterval(function() {

      mydevice.write(cmd);

    }, delay)

  }

  var recordValues = function(delay) {
    setInterval(function() {
      var avgTemp = null;
      var avgLight = null;
      var avgHumidity = null;

      var avgTemp = _.reduce(tempbuffer, function(memo,d) {return memo+d},0)/tempbuffer.length;
      var avgLight = _.reduce(lightbuffer, function(memo,d) {return memo+d},0)/lightbuffer.length;
      var avgHumidity = _.reduce(humiditybuffer, function(memo,d) {return memo+d},0)/humiditybuffer.length;
      console.log("Promedio Temp: "+avgTemp);
      console.log("Promedio Luz: "+avgLight);
      console.log("Promedio Hum: "+avgHumidity);

      tempbuffer = [avgTemp];      
      lightbuffer = [avgLight];      
      humiditybuffer = [avgHumidity];

      sendData(xivelyFeed, xivelyApi, {'temperature':avgTemp, 'light':avgLight, 'humidity':avgHumidity})

    }, delay)
  }

  var sendData = function(feedId, apiKey, streamdata) {

    // Datos a enviar por HTTP
    var data = JSON.stringify({
      "version":"1.0.0",
       "datastreams" : [ {
            "id" : 'temperature',
            "current_value" : streamdata.temperature
        },{
            "id" : 'light',
            "current_value" : streamdata.light
        },{
            "id" : 'humidity',
            "current_value" : streamdata.humidity
        },
      ]
    });


    // Llamada http
    request({
      uri: "https://api.xively.com/v2/feeds/"+feedId+".json",
      method: "PUT",
      headers: {
            'X-ApiKey': apiKey
      },
      body: data
    }, function(error, response, body) {
      console.log(body);
    });

  }

  return this;
}; 




SimpleSense.prototype.Start = function() {
  return 'awesome';
};


module.exports = SimpleSense;


