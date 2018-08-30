const _ = require('lodash')
const logging = require('homeautomation-js-lib/logging.js')

const MAX_HISTORY_LENGTH = 10

class EightUser  {
    constructor(name) {
        this._name = name
        this._present = false
        this.userDataArray = []
    }

    _logInfo() {
        logging.debug('start log: ' + this.name())
        this.userDataArray.forEach(userData => {
            logging.debug('   heatingLevel:' + userData['heatingLevel'])
        })
        logging.debug(' present: ' + this.present())
        logging.debug('end log')
    }

    updatePresent() {
// """
// Determine presence based on bed heating level and end presence
// time reported by the api.
// Idea originated from Alex Lee Yuk Cheung SmartThings Code.
// """
        if (!this._present) {
            if (this.heatingLevel() > 50) {
                // Can likely make this better
                if (!this.nowHeating())
                    this._present = true
                else if (this.heatingLevel() - this.targetHeatingLevel() >= 8)
                    this._present = true
            } else if ( this.heatingLevel() > 25 ) {
                // Catch rising edge
                if ((this.heatingLevel(1) - this.heatingLevel(2) >= 2)
                    && (this.heatingLevel(2) - this.heatingLevel(3) >= 2)
                        && (this.heatingLevel(3) - this.heatingLevel(4) >= 2)) {
                    // Values are increasing so we are likely in bed
                    if (!this.nowHeating()) {
                        this._present = true
                    } else if (this.heatingLevel() - this.targetHeatingLevel() >= 8) {
                        this._present = true
                    }
                }
            }
        } else if ( this._present ) {
            if ( this.heatingLevel() <= 15 ) {
                // Failsafe, very slow
                this._present = false
            } else if ( this.heatingLevel() < 50 ) {
                if ((this.heatingLevel(1) - this.heatingLevel(2) < 0)
                    && (this.heatingLevel(2) - this.heatingLevel(3) < 0)
                        && (this.heatingLevel(3) - this.heatingLevel(4) < 0))
                    // Values are decreasing so we are likely out of bed
                    this._present = false
            }
        }
    }


    updateUser(userData) {
        this.userDataArray.unshift(userData)
        if ( this.userDataArray.length > MAX_HISTORY_LENGTH ) {
            this.userDataArray = this.userDataArray.slice(0,MAX_HISTORY_LENGTH)
        }

        this.updatePresent()
        this._logInfo()
    }

    userData(index = 0) {
        if ( index > this.userDataArray.length ) {
            index = this.userDataArray.length - 1
        }
        return this.userDataArray[index]
    }

    name() {
        return this._name
    }
    present() {
        return this._present
    }
    userId() {
        return this.userData()['userId']
    }
    nowHeating() {
        return this.userData()['nowHeating']
    }
    heatingDuration() {
        return this.userData()['heatingDuration']
    }
    heatingLevel(history = 0) {
        return this.userData()['heatingLevel']
    }
    targetHeatingLevel() {
        return this.userData()['targetHeatingLevel']
    }
    presenceEnd() {
        return this.userData()['presenceEnd']
    }
    presenceStart() {
        return this.userData()['presenceStart']
    }
}

module.exports = EightUser
