var slth = require('node-hid');
var Q = require('q');


function Arduino(opts) {
  if (!(this instanceof Arduino)) {
    return new Arduino(opts);
  }
 
  var analogpins = {
    'a0' :null,
    'a1' :null,
    'a2' :null,
    'a3' :null,
    'a4' :null,
    'a5' :null
  }

  this.start =  function() {
    var deferred = Q.defer();

    var five = require("johnny-five");
    var board = new five.Board();

    board.on("ready", function() {
      board.io.on('open', function(d) {console.log("OPEN"+d)})
      board.io.on('data', function(d) {console.log("DATA"+d)})
      board.io.on('close', function(d) {console.log("CLOSE"+d)})
      board.io.on('error', function(d) {console.log("ERROR"+d)})


      console.log('Arduino started');
      // Create an Led on pin 13
      var led = new five.Led(13);

      var a0 = new five.Sensor("A0");
      var a1 = new five.Sensor("A1");
      var a2 = new five.Sensor("A2");
      var a3 = new five.Sensor("A3");
      var a4 = new five.Sensor("A4");
      var a5 = new five.Sensor("A5");

      a0.on("data", function() {
        analogpins['a0'] = this.value;
      });

      a1.on("data", function() {
        analogpins['a1'] = this.value;
      });

      a2.on("data", function() {
        analogpins['a2'] = this.value;
      });

      a3.on("data", function() {
        analogpins['a3'] = this.value;
      });

      a4.on("data", function() {
        analogpins['a4'] = this.value;
     });

      a5.on("data", function() {
        analogpins['a5'] = this.value;
      });
      // Strobe the pin on/off, defaults to 100ms phases
      led.strobe();

      deferred.resolve(true);
    });

    board.on("error", function(error) {
      deferred.reject(false);
      console.log(error);
    });
    
    return deferred.promise;
  }

  this.getSensors = function() {
    return analogpins;
  }

};

module.exports = Arduino;
