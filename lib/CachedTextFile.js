'use strict';
const fs = require("fs");
class CachedTextFile {
    /**
     *
     * @param {string} filePath
     * @param {number} checkInterval minimum time (ms) between mtime checks
     */
    constructor(filePath, checkInterval = 3000){
        /**
         * @type {string}
         */
        this._path = filePath;
        /**
         * @type {number}
         * @private
         */
        this._checkInterval = checkInterval;
        /**
         * @type {number}
         * @private
         */
        this._lastMod = 0;
        /**
         * @type {number}
         * @private
         */
        this._lastCheck = 0;
        /**
         *
         * @type {string}
         * @private
         */
        this._contents = null;
    }
    get lastMod() {
        return this._lastMod;
    }
    get path() {
        return this._path;
    }
    changed(){
        let now = new Date();
        let changed;
        if(!this._lastCheck || (now.getTime() - this._lastCheck) > this._checkInterval){
            let stats = fs.statSync(this.path);
            let lastMod = Math.max(stats.mtime.getTime(), stats.ctime.getTime());
            if(!this._lastMod || lastMod > this._lastMod){
                changed = true;
            }else{
                changed = false;
            }
        }else{
            changed = false;
        }
        return changed;
    }
    read(){
        let now = new Date();
        let txt;
        if(!this._lastCheck || (now.getTime() - this._lastCheck) > this._checkInterval){
            let stats = fs.statSync(this.path);
            let lastMod = Math.max(stats.mtime.getTime(), stats.ctime.getTime());
            if(!this._lastMod || lastMod > this._lastMod){
                this._contents = fs.readFileSync(this.path, 'utf8');
                this._lastCheck = now.getTime();
                this._lastMod = lastMod;
                txt = this._contents;
            }else{
                txt = this._contents;
            }
        }else{
            txt = this._contents;
        }
        return txt;
    }
}
module.exports = CachedTextFile;