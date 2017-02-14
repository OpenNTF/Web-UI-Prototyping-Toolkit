const winston = require("winston"),
    path = require('path');

const loggingLevels = {
    disabled: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    all: 5
};
let loggingLevel = 3;

class Logger {

    constructor(args) {
        this.sourceFilePath = args.sourceFilePath;
        this.sourceFilename = path.basename(this.sourceFilePath);
        this.sourcePostFix = ' - ';
        this.logger = new (winston.Logger)({
            transports: [
                new (winston.transports.Console)({level: 'silly'})//,
//            new (winston.transports.File)({ filename: 'somefile.log' })
            ]
        });
    }

    static get level(){
        return loggingLevel;
    }

    static set level(level){

        if(typeof level === 'number'){
            if(level < 0 || level > 5){
                throw new Error("Illegal logging level: " + level);
            }
            loggingLevel = level;
        }else if(typeof level === 'string'){
            const ll = level.toLowerCase();
            if(!loggingLevels.hasOwnProperty(ll)){
                throw new Error("Illegal logging level: " + level);
            }
            loggingLevel = loggingLevels[ll];
        }else{
            throw new Error("Illegal logging level: " + level);
        }
    }

    info(msg, arg) {
        if (loggingLevel >= 3) {
            if (arguments.length > 1) {
                this.logger.info(this.sourceFilename + this.sourcePostFix + msg, arg);
            } else {
                this.logger.info(this.sourceFilename + this.sourcePostFix + msg);
            }
        }
    }

    debug(msg, arg) {
        if (loggingLevel >= 4) {
            if (arguments.length > 1) {
                this.logger.log('debug', this.sourceFilename + this.sourcePostFix + msg, arg);
            } else {
                this.logger.log('debug', this.sourceFilename + this.sourcePostFix + msg);
            }
        }
    }

    warn(msg, arg) {
        if (loggingLevel >= 2) {
            if (arguments.length > 1) {
                this.logger.warn(":WARN: " + this.sourceFilename + this.sourcePostFix + msg, arg);
            } else {
                this.logger.warn(":WARN: " + this.sourceFilename + this.sourcePostFix + msg);
            }
        }
    }

    error(msg, arg) {
        if (loggingLevel >= 1) {
            if (arguments.length > 1) {
                this.logger.error(":ERROR: " + this.sourceFilename + this.sourcePostFix + msg, arg);
            } else {
                this.logger.error(":ERROR: " + this.sourceFilename + this.sourcePostFix + msg);
            }
        }
    }

    trace(msg, arg) {
        if (loggingLevel >= 5) {
            if (arguments.length > 1) {
                this.logger.log('log', ":TRACE: " + this.sourceFilename + this.sourcePostFix + msg, arg);
            } else {
                this.logger.log('log', ":TRACE: " + this.sourceFilename + this.sourcePostFix + msg);
            }
        }
    }
}

module.exports = Logger;