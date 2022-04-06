'use strict'

const mqtt = require ('mqtt');

var client  = mqtt.connect('mqtt://127.0.0.1:1883');

//connect and subscribe to topic

client.on('connect', function () {
  console.log('MQTT client has subscribed successfully');
});

let timeLoop,i=1

if( process.argv[2] == undefined){          //Getting the time in seconds for the loop
  timeLoop = 60000                       //default 1 minute
} else {
  timeLoop = process.argv[2]*1000
}


function start(){
	const time = Date.now();
	let message = {
        'Message' : i,
        'id' : "Device1",
        'timestamp' : time,
        'data' : {
            'Humidity' : 1245,
            'Pressure' : 1548/1000,
            'Temperature' : 23000/1000 
        },
	};
	console.log('Publishing MQTT message ...')
	let messageS = JSON.stringify(message)
    console.log('Message: %s',messageS)
    client.publish("test", messageS);
	i++
}

setInterval(function(){
	start()
},timeLoop)