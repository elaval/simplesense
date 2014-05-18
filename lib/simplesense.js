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
  mac = require("./mac_address.js")


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

var nodeInfo = {}
nodeInfo.ipExterna = "";
nodeInfo.ipInterna = "";
nodeInfo.macAddress = "";


/*
* Gets external ip address 
* Returns a promise with the ip
*/
function getExternalIp() {
  var deferred = q.defer();
  request('http://jsonip.com/', function(error, response, body) {
    if (error) {
      deferred.reject(error);
    } else {
      var ipinfo = JSON.parse(body);
      deferred.resolve(ipinfo.ip);
    }
    });
    return deferred.promise
}



/**
* Gets macAdress of current device
* Returns a promise with the address
*/
function getMacAddress() {
  var deferred = q.defer();

  mac.getMacAddress(function(mac) {
    if (mac) {
      deferred.resolve(mac);
    } else {
      deferred.reject("Can not get mac address");
    }

  })
  return deferred.promise
}



/**
* Gets local IPs (eg. 192.168.0.1)
* Return promise with the address
*/
function getLocalIp() {
  var deferred = q.defer();

  var ips = [];

  var os=require('os');
  var ifaces=os.networkInterfaces();
  for (var dev in ifaces) {
    var alias=0;
    ifaces[dev].forEach(function(details){
      if (details.family=='IPv4' && details.address!='127.0.0.1') {
        console.log(dev+(alias?':'+alias:''),details.address);
        ips.push(details.address);
        ++alias;
      }
    });
  }

  if (ips.length >0) {
    deferred.resolve([ips[0]])
  } else {
    deferred.reject("Error: no ip detected")
  }

  return deferred.promise
}

/**
* Record device parameters on firebase
*/ 
function firebaseRecordDevice(nodeinfo) {
  // Registra datos de nodo en FireBase asociados a cada serial
  var myserialref = myRootRef.child('serial').child(nodeInfo.macAddress);
  myserialref.child('localIp').set(nodeInfo.ipInterna);
  myserialref.child('externalIp').set(nodeInfo.ipExterna);
  myserialref.child('lastconnection').set(Firebase.ServerValue.TIMESTAMP);


  // Registra datos en nodo en FireBase asociados a cada IP externo
  // Reemplaza puntos "." por underscore "_" en dirección para que se un nodo válido
  var escapedExtIp = nodeInfo.ipExterna.replace(/\./g, "_");
  var escapedLocalIp = nodeInfo.ipInterna.replace(/\./g, "_");
  var myIpRef = myRootRef.child("ip").child(escapedExtIp);
  myIpRef.child('localIps').child(escapedLocalIp).set(true);
  myIpRef.child('localIps').child(escapedLocalIp).child('lastconnection').set(Firebase.ServerValue.TIMESTAMP);
}

getExternalIp().then(function(ip) {
  console.log("External IP: "+ip);

  return getMacAddress();
})
.then(function(add) {
  console.log("Mac: "+add)

  return getLocalIp()
})
.then(function(ip) {
  console.log("IP: "+ip)
})


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

  /**
  * Start - inicia lectura de datos
  */
  this.Start = function() {

    //Obtener direccion y registrar en Firebase
    getMacAddress()
    .then(function(currentMac) {
      console.log('mac: '+currentMac);

      if (nconf.get('macAddress') != currentMac) {
        console.log('new mac address: '+currentMac);
        nconf.set('macAddress', currentMac);
      } else  {
        console.log('new mac address: '+currentMac);
      }

      return getExternalIp();
    })
    .then(function(ip) {
      console.log('external ip: '+ip);

      nodeInfo.ipExterna = ip;

      return getLocalIp();
    })
    .then(function(ip, fam) {
      console.log('local ip: '+ip+' - fam: '+fam);

      nodeInfo.macAddress = nconf.get('macAddress');
      nodeInfo.ipInterna = ip;

      firebaseRecordDevice(nodeInfo);
    })


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
      console.log("DATA")
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

    mydevice.on('error',function(error) {
      console.log('error');
    })

    // Cada 5 segundos genera datos simulados de temperatura y los registra para el dispositivo corespondiente
    setInterval(function() {

      mydevice.write(cmd);
      console.log("WRITE")

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


