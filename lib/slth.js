'use strict';

var hid = require('node-hid');

function SLTH(opts) {
  if (!(this instanceof SLTH)) {
    return new SLTH(opts);
  }

  var debugging = false;
  var sampleperiod = 1000;

  var activeDevice = false;

  // Referencia al dispositivo HID correspondiente a una tarjeta SLTH
  var slthDevice = null;

  var avgTemp = null;
  var avgLight = null;
  var avgHumidity = null;

  var tempBuffer = [];
  var lightBuffer = [];
  var humidityBuffer = [];

  // Sum of sampled values since last time data was recalled (to calculate average)
  var tempSum = 0;
  var lightSum = 0;
  var humiditySum = 0;

  // Number of samples since last time data was recalled (to calculate average)
  var tempSamples = 0;
  var lightSamples = 0;
  var humiditySamples = 0;


  var commandcodes = {
    'led' : 0x80,
    'temp_light' : 0x81,
    'temp': 0x82,
    'ligth': 0x83,
    'bootloader' : 0x85,
    'humidity' : 0x86,
    'temp_light_humidity' : 0x87
  };

  var commandnames = {
    0x80:'led',
    0x81:'temp_light',
    0x82:'temp',
    0x83:'ligth',
    0x85:'bootloader',
    0x86:'humidity',
    0x87:'temp_light_humidity' 
  };

  // Command ribbon ... list of commands that will be executed sequentially
  var commandribbon = ['temp_light_humidity'];

  /**
  * Finds a SLTH device in HID and created  manager
  */
  var ConnectDevice = function() {
    var hidDevices = hid.devices();

    // Records the path for each HID device
    var devicePath = {};

    if (debugging) console.log('Checking HID Devices');

    var numDevices = hidDevices.length;

    // Recorre todos los dispositivos hid detectados y busca sensor SLTH (vendor 1240 / product 63)
    for (var i = 0; i < numDevices; i++) {
      // Crea un deviceID compuesto por vendorID-productId  (Ej '1240-63')
      var deviceId = hidDevices[i].vendorId +'-'+ hidDevices[i].productId;

      // Almacena los path para cada deviceId en devicePath
      if (!devicePath[deviceId]) {
        devicePath[deviceId]=hidDevices[i].path;

        // Muestra la lista de dispositivos encontrado (con un * frente al SLTH)
        var preChar = (deviceId === '1240-63' ? '*' : '');
        if (debugging) console.log(preChar+hidDevices[i].product + ' - Path' + hidDevices[i].product);
      }

    }

    // Si está el dispositivo SLTH, generar su manejador HID
    if (devicePath['1240-63']) {
      activeDevice = true;
      slthDevice = new hid.HID(devicePath['1240-63']);

      // Process received data
      slthDevice.on('data', ProcessData);

      slthDevice.on('error',function(error) {
        console.log('error');
      })

      if (debugging) console.log('SLTH device found');
    } else {
      if (debugging) console.log('SLTH Device NOT found');
    }

  };



  /**
  * Generates samples every 'sampleperiod' seconds
  */
  
  var StartSampling = function() {
    
    var outdata = new Buffer(64);
    var commandCounter = 0;




    // Cada 5 segundos genera datos simulados de temperatura y los registra para el dispositivo corespondiente
    setInterval(function() {

      // Each iteration sends a different command from the command ribbon
      var currentCommandName = commandribbon[commandCounter];
      commandCounter++;
      commandCounter = commandCounter & (commandribbon.length-1);

      outdata[0] = commandcodes[currentCommandName];

      try {
          slthDevice.write(outdata);
          if (debugging) console.log("SLTH - Send command: "+currentCommandName)
      }
      catch(err) {
          if (debugging) console.log("SLTH - Error : "+err)
      }

    }, sampleperiod)

  }

  /**
  * Procesa data recibida de SLHT
  */
  var ProcessData = function(data) {
    var tmp = null;
    var luz = null;
    var hum = null;

    var cmd = data[0];
    if (debugging) console.log('SLTH - Received data for command: '+commandnames[cmd]);

    // Respuesta de consulta de temperatura ('0x82')
    if (commandnames[cmd] === 'temp') {

      var newtmp = ((data[2] << 8) + data[1])*0.0625;
      // Chequea que no sea un valor anómalo (> 500 grados)
      tmp = newtmp <500 ? newtmp : tmp;
      if (debugging) console.log("Temp: "+tmp);
    } 

    else if (commandnames[cmd] === 'light') {
      luz = ((data[2] << 8) + data[1])/1.2;
      if (debugging) console.log("Luz: "+luz);
    } 

    else if (commandnames[cmd] === 'humidity') {
      var rawhum = ((data[2] << 8) + data[1]);

      // Valores crudos van de 0 a 790 ... con tierra seca en 400
      // Convertir a escala lineal con 400 ->0  & 800 -> 10
      hum = 10*(rawhum-400)/400;
      hum = hum > 10 ? 10 : hum;
      if (debugging) console.log("Hum: "+hum);
    } 

    else if (commandnames[cmd] === 'temp_light_humidity') {
      var newtmp = ((data[2] << 8) + data[1])*0.0625;
      // Chequea que no sea un valor anómalo (> 500 grados)
      tmp = newtmp <500 ? newtmp : tmp;
      luz = ((data[4] << 8) + data[3])/1.2;
      var rawhum = ((data[6] << 8) + data[5]);

      // Valores crudos van de 0 a 790 ... con tierra seca en 400
      // Convertir a escala lineal con 400 ->0  & 800 -> 10
      hum = 10*(rawhum-400)/400;
      hum = hum > 10 ? 10 : hum;

      hum = rawhum;
      if (debugging) console.log("Temp: "+tmp+" Luz: "+luz+" Hum: "+hum);
    } 

    if (tmp!=null) {
      tempSum = tempSum+tmp;
      tempSamples++;
      avgTemp = tempSum/tempSamples;
      tempBuffer.push(tmp);
    }

    if (luz!=null) {
      lightSum = lightSum+luz;
      lightSamples++;
      avgLight = lightSum/lightSamples;
      lightBuffer.push(luz);
    }

    if (hum!=null) {
      humiditySum = humiditySum+hum;
      humiditySamples++;
      avgHumidity = humiditySum/humiditySamples;
      humidityBuffer.push(hum);
    }

  }.bind(this);

  // Gets avarage of recent data measures for temperature, light & humidity
  this.getData = function() {
    humiditySum = 0;
    lightSum = 0;
    tempSum = 0;
    humiditySamples = 0;
    lightSamples = 0;
    tempSamples = 0;
    return {l: avgLight, t:avgTemp, h:avgHumidity};
  }



  this.start = function() {
    ConnectDevice();
    StartSampling();
  }

}


module.exports = SLTH;
