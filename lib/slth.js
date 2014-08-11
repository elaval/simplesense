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

  /*
  ** Transforma la muestra de medición en grados celsius, 
  ** incluye transformacion de temperaturas negativas.
  */
  var getCelsius = function(rawData, index){
      var celsius = ((rawData[index + 1] << 8) + rawData[index]);
      //La sonda de temperatura está desconectada
      if(celsius === 32767){
        if(debugging)
          console.log("Error : The temperature sensor is disconnected. ");
        celsius = 0;
      }
      //la temperatura es negativa, se aplica complemento a 2
      else if(celsius > 32767){
       //invierte los bit del entero sin signo para obtener el número negativo con signo
        celsius = celsius ^ parseInt((new Array(celsius.toString(2).length+1)).join("1"),2);
        celsius = - (celsius+1)/16;
        
      }
      //temperatura positiva
      else{
        celsius = (celsius * 0.0625);
      }
      return Math.round((celsius) * 100)/100 ; // redondeo a 2 decimales.
  }/*end getCelsius*/

  /*
  **  Transforma la medición de luminosidad a lux.
  */
  var getLux = function(rawData, index){
    var lux = ((rawData[index + 1] << 8) + rawData[index]);
    lux = lux*1.2;
    return Math.round(lux*100)/100;
  }/* end getLux*/

  /*
  **  Trasnforma la medición de humedad a escala lineal con 400 ->0  & 800 -> 10
  */
  var getHumidity = function(rawData, index){
    var hum = ((rawData[index + 1] << 8) + rawData[index]);
    hum = 10*(hum-400)/400;
    hum = hum > 10 ? 10 : hum;
    return Math.round(hum *100)/100;
  }
  /**
  * Procesa data recibida de SLTH
  */
  var ProcessData = function(data) {
    var tmp = null;
    var luz = null;
    var hum = null;

    var cmd = data[0];
    if (debugging) console.log('SLTH - Received data for command: ' + commandnames[cmd]);

    switch(commandnames[cmd]){
      //0x81 comando de temperatura y luz
      case 'temp_light':
        tmp = getCelsius(data, 1);
        luz = getLux(data, 3);
        break;
      // 0x82 comamdo de temperatura
      case 'temp':
        tmp = getCelsius(data, 1);
        break;
      // 0x83 comando de luminosidad
      case 'light':
        luz = getLux(data, 1);
        break;
      // 0x86 comando de humedad
      case 'humidity':
        hum = getHumidity(data , 1);
        break;
      //0x87 comando de temperatura {index: 1} , luz {index 3} y humedad {index : 5}
      case 'temp_light_humidity':  
        tmp = getCelsius(data, 1);
        luz = getLux(data, 3);
        hum = getHumidity(data , 5);
        if(debugging) console.log(" temperature :"+ tmp +" light :"+luz +" humidity :"+ hum);
        break;
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
