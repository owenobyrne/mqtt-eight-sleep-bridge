const _ = require('lodash')
const request = require('request')
const EventEmitter = require('events')
const repeat = require('repeat')
const logging = require('homeautomation-js-lib/logging.js')
const moment = require('moment')

const constants = require('./constants.js')
const EightUser = require('./eight_user.js')

module.exports = new EventEmitter()

var USERNAME = null
var PASSWORD = null

var EIGHT_ACCESS_TOKEN = null
var EIGHT_USER_ID = null
var EIGHT_EXPIRATION_DATE = null

var users = {}

function getAPIURL(path = '/') {
    return constants.API_BASE_URL + path
}

function _headers(callback) {
    if ( _.isNil(callback))
        return 

    _getAccessToken(function(accessToken) {
        var headers = constants.headers
        if ( !_.isNil(accessToken))
            headers['Session-Token'] = accessToken
    
        callback(headers)
    })
}

function _get(path, body = {}, callback) {
    _headers(function(headers) {
        request.get({ url: getAPIURL(path), headers: headers, json: true },
            function(err, httpResponse, body) {
                logging.debug('_get url:' + path)
                logging.debug('error:' + err)
                logging.debug('httpResponse:' + httpResponse)
                logging.debug('body:' + body)

                if (!_.isNil(callback)) {
                    callback(err, httpResponse, body)
                }
            })    
    })
}

function _post(path, body = {}, callback) {
    _headers(function(headers) {
            request.post({ url: getAPIURL(path), headers: headers, body: body, json: true },
                function(err, httpResponse, body) {
                    logging.debug('_post url:' + path)
                    logging.debug('error:' + err)
                    logging.debug('httpResponse:' + httpResponse)
                    logging.debug('body:' + body)

                    if (!_.isNil(callback)) {
                        callback(err, httpResponse, body)
                    }
            })
    })
}

function _put(path, body = {}, callback) {
    _headers(function(headers) {
            request.put({ url: getAPIURL(path), headers: headers, body: body, json: true },
                function(err, httpResponse, body) {
                    logging.debug('_put url:' + path)
                    logging.debug('error:' + err)
                    logging.debug('httpResponse:' + httpResponse)
                    logging.debug('body:' + body)

                    if (!_.isNil(callback)) {
                        callback(err, httpResponse, body)
                    }
                })
    })
}

function _addMinutes(date, minutes) {
    if ( minutes > 0 )
        return moment(date).add(minutes, 'm').toDate()
    
    return moment(date).subtract(minutes, 'm').toDate()
}

function _addDays(date, days) {
    if ( days > 0 )
        return moment(date).add(days, 'd').toDate()
    
    return moment(date).subtract(days, 'd').toDate()
}

function _needsRenew(callback) {
    if ( _.isNil(callback))
        return

    _getExpirationDate(function(expirationDate) {
        _getUserID(function(userID) {
            _getAccessToken(function(accessToken) {
                const dateToExpire = _addDays(new Date(), -1)
                if ( _.isNil(userID) || _.isNil(accessToken) || _.isNil(expirationDate) || (expirationDate < dateToExpire)) {
                    callback(true)
                } else {
                    callback(false)
                }
            })
        })
    })
}

function _setExpirationDate(expirationDate) {
    EIGHT_EXPIRATION_DATE = expirationDate
}

function _getExpirationDate(callback) {
    setTimeout(function (){
        callback(EIGHT_EXPIRATION_DATE)
    },1)
}

function _setUserID(userID) {
    EIGHT_USER_ID = userID
}

function _getUserID(callback) {
    setTimeout(function (){
        callback(EIGHT_USER_ID)
    },1)
}

function _setAccessToken(token) {
    EIGHT_ACCESS_TOKEN = token
}

function _getAccessToken(callback) {
    setTimeout(function (){
        callback(EIGHT_ACCESS_TOKEN)
    },1)
}

function refreshCredentials(callback) {
    logging.debug('refreshing credentials')
    const body = {
        'email': USERNAME,
        'password' : PASSWORD
    }

    _post(constants.loginPath, body, function(err, httpResponse, body) {
        logging.debug('credential response: ' + body)
        if (_.isNil(err)) {
            const session = body.session
            if ( !_.isNil(session) ) {
                const token = session.token
                const userID = session.userId
                const expirationDate = session.expirationDate

                if ( !_.isNil(token) && !_.isNil(userID) && !_.isNil(expirationDate)) {
                    logging.debug('Success, noting tokens')
                    _setAccessToken(token)
                    _setUserID(userID)
                    _setExpirationDate(expirationDate)
                    if ( !_.isNil(callback)) {
                        callback(userID, token, expirationDate)
                        return
                    }
                } else {
                    logging.error('Could not log in (missing body keys): ' + body)
                }
            }
        } else {
            logging.error('Could not log in: ' + body)
        }

        if ( !_.isNil(callback)) {
            callback(null, null, null)
        }
    })
}


function myDevices(callback) {
    if ( _.isNil(callback))
        return

    _needsRenew(function(needsRenew) {
        if ( needsRenew ) {
            logging.error('cannot query devices when needs renew')
            callback('not authenticated', null)
            return
        }

        _get(constants.myDevicesPath, null, function(err, httpResponse, body) {
            logging.debug('my devices response: ' + body)
            if ( _.isNil(err) ) {
                if ( !_.isNil(body.user)) {
                    const devices = body.user.devices
                    callback(null, devices)
                } else {
                    callback('missing user devices', null)
                }
                
            } else {
                callback(err, null)
            }
        })
    })
}

function queryDevice(device, callback) {
    if ( _.isNil(callback) || _.isNil(device))
        return

    _needsRenew(function(needsRenew) {
        if ( needsRenew ) {
            logging.error('cannot query device when needs renew')
            callback('not authenticated', null)
            return
        }

        _get(constants.devicesQueryBase + device + constants.deviceQuery, null, function(err, httpResponse, body) {
            logging.debug('my device response: ' + httpResponse)
            logging.debug('              body: ' + body)
            if ( _.isNil(err) ) {
                const devices = body.result
                callback(null, devices)
            } else {
                callback(err, null)
            }
        })
    })
}

/**
 * 
 * @param {*} device 
 * @param {*} heatingConfig { "[left|right]TargetHeatingLevel": 75, "[left|right]HeatingDuration": 3600 }
 * @param {*} callback 
 */
function setDeviceHeatingLevel(device, heatingConfig, callback) {
    if ( _.isNil(callback) || _.isNil(heatingConfig) || _.isNil(device))
        return

    _needsRenew(function(needsRenew) {
        if ( needsRenew ) {
            logging.error('cannot query device when needs renew')
            callback('not authenticated', null)
            return
        }

        _put(constants.devicesQueryBase + device, heatingConfig, function(err, httpResponse, body) {
            logging.debug('my device response: ' + httpResponse)
        
            if ( _.isNil(err) ) {
                const device = body.device
                callback(null, device)
            } else {
                callback(err, null)
            }
        })
    })
}

function queryUserDevices(device, callback) {
    if ( _.isNil(callback) || _.isNil(device))
        return

    _needsRenew(function(needsRenew) {
        if ( needsRenew ) {
            logging.error('cannot query device when needs renew')
            callback('not authenticated', null)
            return
        }

        _get(constants.devicesQueryBase + device + constants.ownerQuery, null, function(err, httpResponse, body) {
            logging.debug('my device response: ' + httpResponse)
            logging.debug('              body: ' + body)
            if ( _.isNil(err) ) {
                const devices = null//body.result.devices
                callback(null, devices)
            } else {
                callback(err, null)
            }
        })
    })
}

String.prototype.lowerCaseFirst = function() {
    return this.charAt(0).toLowerCase() + this.slice(1)
}

function poll() {
    logging.debug('starting poll')
    const pollingAction = function() {
        myDevices(function(err, devices) {
            if ( _.isNil(devices))
                return

            logging.debug('devices: ' + JSON.stringify(devices))

            devices.forEach(device => {
                queryDevice(device, function(err, result) {
                    var generalResults = {}
                    var left = {}
                    var right = {}

                    if ( _.isNil(result))
                        return

                    Object.keys(result).forEach(key => {
                        const value = result[key]
                
                        if ( key.startsWith('left') ) {
                            left[key.replace('left', '').lowerCaseFirst()] = value
                        } else if ( key.startsWith('right') ) {
                            right[key.replace('right', '').lowerCaseFirst()] = value
                        } else {
                            generalResults[key] = value
                        }
                    })
                    

                    var leftUser = users['left']
                    var rightUser = users['right']

                    if ( _.isNil(leftUser)) {
                        leftUser = new EightUser('left')
                        users['left'] = leftUser
                    }
                    if ( _.isNil(rightUser)) {
                        rightUser = new EightUser('right')
                        users['right'] = rightUser
                    }

                    leftUser.updateUser(left)
                    rightUser.updateUser(right)

                    module.exports.emit('updated', generalResults)
                    module.exports.emit('user-updated', leftUser)
                    module.exports.emit('user-updated', rightUser)
                })
            })
        })

    }
    _needsRenew(function(needsRenew) {
        logging.debug('needs renew: ' + needsRenew)
        if ( needsRenew ) {
            refreshCredentials(function(userID, token, expirationDate) {
                logging.debug('access token: ' + userID)
                logging.debug('userID: ' + token)
                logging.debug('expiration date: ' + expirationDate)
                pollingAction()
            })

        } else {
            logging.debug('querying devices')
            pollingAction()
        }
    })
}


module.exports.start = function(username, password, frequency) {
    if ( _.isNil(username) || _.isNil(password) ) {
        throw 'empty username or password'
    }
    if ( _.isNil(frequency) ) {
        frequency = 30
    }

    USERNAME = username
    PASSWORD = password
    
    repeat(poll).every(frequency, 's').start.in(1, 'sec')
}

module.exports.setDeviceHeatingLevel = setDeviceHeatingLevel
