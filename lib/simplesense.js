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
  _ = require('underscore'),
  Firebase = require('firebase'),
  q = require("q"),
  
  arduino = require("./arduino.js")(),
  slth = require("./slth.js")(),
  catalogue =require("./firebase_catalogue")();


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

var myRootRef = new Firebase('https://simplesense.firebaseio.com/');


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
  // Ensure opts is an object
  opts = opts || {};

  if ( !(this instanceof SimpleSense) ) {
    return new SimpleSense(opts);
  }

  var self = this;
  var tempbuffer=[];
  var lightbuffer=[];
  var humiditybuffer=[];

  /**
  * Record device parameters on firebase
  */ 
  function firebaseRecordDevice(deviceinfo) {
    // Registra datos de nodo en FireBase asociados a cada serial
    var myserialref = myRootRef.child('serial').child(deviceinfo.macAddress);
    myserialref.child('localIP').set(deviceinfo.localIP);
    myserialref.child('publicIP').set(deviceinfo.externalIP);
    myserialref.child('feedId').set(deviceinfo.feedId);    
    myserialref.child('feedKey').set(deviceinfo.feedKey);
    myserialref.child('lastconnection').set(Firebase.ServerValue.TIMESTAMP);
    myserialref.child('lastconnection_verbose').set((new Date).toString());


    // Registra datos en nodo en FireBase asociados a cada IP externo
    // Reemplaza puntos "." por underscore "_" en dirección para que se un nodo válido
    var escapedExtIP = deviceinfo.externalIP.replace(/\./g, "_");
    var escapedLocalIP = deviceinfo.localIP.replace(/\./g, "_");
    var myIPRef = myRootRef.child("publicIP").child(escapedExtIP);
    myIPRef.child('localIPs').child(escapedLocalIP).set(true);
    myIPRef.child('localIPs').child(escapedLocalIP).child(('lastconnection')).set(Firebase.ServerValue.TIMESTAMP);
    myIPRef.child('localIPs').child(escapedLocalIP).child(('serial')).set(deviceinfo.macAddress);
  }


  /**
  * Start - inicia lectura de datos
  */
  this.Start = function() {

    catalogue.start()
    .then(function(deviceinfo) {
      deviceinfo.feedId = xivelyFeed;      
      deviceinfo.feedKey = xivelyApi;
      firebaseRecordDevice(deviceinfo);
    });

    // Inicio de Arduino // TIDE MAkers
    arduino.start()
    .then(function() {
      console.log(arduino.getSensors());
    });

    
    slth.start();

    recordValues(5000);


    return "Started";
  }


  var recordValues = function(delay) {
    setInterval(function() {
      var currentData = slth.getData();
      console.log("Promedio Temp: "+currentData.t);
      console.log("Promedio Luz: "+currentData.l);
      console.log("Promedio Hum: "+currentData.h);

      sendData(xivelyFeed, xivelyApi, {'temperature':currentData.t, 'light':currentData.l, 'humidity':currentData.h})

      // Ej. {"a1":54, "a2":128, ...}
      var arduinoSensorValues = arduino.getSensors();

      sendData2(xivelyFeed, xivelyApi, arduinoSensorValues);
      

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

  };

  var sendData2 = function(feedId, apiKey, sensorValues) {

    var outputdataJSON = {
      "version":"1.0.0",
      "datastreams":[]
    };

    for(var id in sensorValues) {
      outputdataJSON.datastreams.push({
        'id': id,
        'current_value':sensorValues[id]
      })
    };

    // Datos a enviar por HTTP
    var outputdataString = JSON.stringify(outputdataJSON);

    // Llamada http
    request({
      uri: "https://api.xively.com/v2/feeds/"+feedId+".json",
      method: "PUT",
      headers: {
            'X-ApiKey': apiKey
      },
      body: outputdataString
    }, function(error, response, body) {
      //console.log(body);
    });

  }

  return this;
}; 




SimpleSense.prototype.Start = function() {
  return 'awesome';
};


module.exports = SimpleSense;


