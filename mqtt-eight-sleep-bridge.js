// Requirements
const mqtt = require('mqtt')
const _ = require('lodash')
const logging = require('homeautomation-js-lib/logging.js')
const health = require('homeautomation-js-lib/health.js')
const eight = require('./lib/eight_sleep.js')

require('homeautomation-js-lib/mqtt_helpers.js')

const username = process.env.USERNAME
const password = process.env.PASSWORD
var pollTime = process.env.POLL_FREQUENCY
const mqttHost = process.env.MQTT_HOST
const mqttUsername = process.env.MQTT_USERNAME
const mqttPassword = process.env.MQTT_PASSWORD

if ( _.isNil(pollTime) ) {
    pollTime = 30
}

var shouldRetain = process.env.MQTT_RETAIN
var deviceId = "";

if (_.isNil(shouldRetain)) {
    shouldRetain = true
}

var mqttOptions = {}

if (!_.isNil(shouldRetain)) {
    mqttOptions['retain'] = shouldRetain
}

// Config
const baseTopic = process.env.SLEEP_TOPIC

if (_.isNil(baseTopic)) {
    logging.warn('SLEEP_TOPIC not set, not starting')
    process.abort()
}

// Setup MQTT
const mqttClient  = mqtt.connect('mqtt://' + mqttHost, { username: mqttUsername, password: mqttPassword })

mqttClient.on('connect', () => {
    mqttClient.subscribe('eight/#')
})

mqttClient.on('message', (topic, message) => {
    var command = {}
    
    if (topic === baseTopic + '/left/setlevel') {
        command = { leftTargetHeatingLevel: _.parseInt(message.toString()) }
        eight.setDeviceHeatingLevel(deviceId, command, function(err, device) {})
    } else if (topic === baseTopic + '/right/setlevel') {
        command = { rightTargetHeatingLevel: _.parseInt(message.toString()) }
        eight.setDeviceHeatingLevel(deviceId, command, function(err, device) {})
    } else if (topic === baseTopic + '/left/switch/on') {
        command = { leftHeatingDuration: 3600 };
        eight.setDeviceHeatingLevel(deviceId, command, function(err, device) {})
    } else if (topic === baseTopic + '/left/switch/off') {
        command = { leftHeatingDuration: 0 };
        eight.setDeviceHeatingLevel(deviceId, command, function(err, device) {})
    } else if (topic === baseTopic + '/right/switch/on') {
        command = { rightHeatingDuration: 3600 };
        eight.setDeviceHeatingLevel(deviceId, command, function(err, device) {})
    } else if (topic === baseTopic + '/right/switch/off') {
        command = { rightHeatingDuration: 0 };
        eight.setDeviceHeatingLevel(deviceId, command, function(err, device) {})
    }

    
})

eight.start(username, password, pollTime)

eight.on('updated', (result) => {
    logging.debug('eight updated')
    if (_.isNil(result)) return
    
    Object.keys(result).forEach(key => {
        const value = result[key]

        if (key === "deviceId") { deviceId = value }

        logging.debug('   base: ' + key + ': ' + value)
        var topic = baseTopic + '/' + key

        mqttClient.publish(topic, JSON.stringify(value).toString(), mqttOptions)
    })
})

eight.on('user-updated', (user) => {
    logging.debug('user updated: ' + user.name())

    var topic = baseTopic + '/' + user.name() + '/'

    mqttClient.publish(topic + 'nowHeating', user.nowHeating().toString(), mqttOptions)
    mqttClient.publish(topic + 'present', user.present().toString(), mqttOptions)
    mqttClient.publish(topic + 'heatingLevel', user.heatingLevel().toString(), mqttOptions)
    mqttClient.publish(topic + 'userId', user.userId().toString(), mqttOptions)
    mqttClient.publish(topic + 'heatingDuration', user.heatingDuration().toString(), mqttOptions)
    mqttClient.publish(topic + 'targetHeatingLevel', user.targetHeatingLevel().toString(), mqttOptions)
    mqttClient.publish(topic + 'presenceEnd', user.presenceEnd().toString(), mqttOptions)
    mqttClient.publish(topic + 'presenceStart', user.presenceStart().toString(), mqttOptions)

})

