var Firebase = require('firebase'),
  q = require('q'),
  mac = require("./mac_address.js"),
  nconf = require('nconf'),
  request = require("request");

var homeDir = require('path').dirname(require.main.filename);
var myRootRef = new Firebase('https://simplesense.firebaseio.com/');

//
// Setup nconf to use (in-order):
//   1. Command-line arguments
//   2. Environment variables
//   3. A file located at 'path/to/config.json'
//
nconf.argv()
       .env()
       .file({ file: homeDir+'/config.json' });



function Catalogue(opts) {
  if (!(this instanceof Catalogue)) {
    return new Catalogue(opts);
  }
 

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
        deferred.resolve(mac.trim());
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
          //console.log(dev+(alias?':'+alias:''),details.address);
          ips.push(details.address);
          ++alias;
        }
      });
    }

    if (ips.length >0) {
      deferred.resolve(ips[0])
    } else {
      deferred.reject("Error: no ip detected")
    }

    return deferred.promise
  }



  this.start = function() {
    var deferred = q.defer();
    var nodeinfo = {}

    var getAdresses = q.all([getMacAddress(), getLocalIp(), getExternalIp()]);

    getAdresses.spread(function(mac, localIP, externalIP){
      var nodeInfo = {
        'externalIP':externalIP,
        'localIP':localIP,
        'macAddress':mac
      }

      deferred.resolve(nodeInfo)
    });
    return deferred.promise;
  }

/*
    //Obtener direccion y registrar en Firebase
    getMacAddress()
    .then(function(currentMac) {
      console.log('mac: '+currentMac);
      nconf.set('macAddress', currentMac);
      nconf.save();

      return getExternalIp();
    })
    .then(function(ip) {
      console.log('external ip: '+ip);

      nodeInfo.ipExterna = ip;

      return getLocalIp();
    })
    .then(function(ip) {
      console.log('local ip: '+ip);

      nodeInfo.macAddress = nconf.get('macAddress');
      nodeInfo.ipInterna = ip;

      firebaseRecordDevice(nodeInfo);
    })
    .fail(function(error) {
      console.log(error);
    })
  }
  */

};

module.exports = Catalogue;
