const utils = require('./utils');

class ItemCache {
    /**
     *
     * @param {Function} keyFn generates a unique string key for a cached object
     * @param {Object[]|Object.<String,Object>} [entries] array to populate or prepopulated cache object
     * @constructor
     */
    constructor(keyFn, entries) {
        this.items = {};
        if (typeof keyFn !== 'function') {
            throw new Error("missing extract cache key function");
        }
        this.keyFn = keyFn;
        if (entries && entries instanceof Array) {
            this.storeAll(entries);
        } else if (entries && typeof entries === 'object') {
            this.items = entries;
        }
    }


    /**
     *
     * @param {Object} image
     * @return {String}
     */
    calculateKey(image) {

        try {
            return this.keyFn(image);
        } catch (e) {
            console.error(e.stack);
            throw new Error("could not extract key from " + image.link + ": " + e.message);
        }
    }

    /**
     *
     * @param {Object} image
     */
    store(image) {
        const key = this.calculateKey(image);
        this.items[key] = image;
    }

    /**
     *
     * @param {Object[]}images
     */
    storeAll(images) {
        images.forEach(i => this.store(i));
    }

    /**
     *
     * @param {Number} count
     * @return {Object[]}
     */
    getRandom(count) {
        const keys = Object.keys(this.items);
        const o = [];
        while (o.length < count && o.length < keys.length) {
            const idx = utils.randomArrayIndex(keys);
            o.push(this.items[keys[idx]]);
            keys.splice(idx, 1);
        }
        return o;
    }

    /**
     *
     * @return {Number}
     */
    getSize() {
        return Object.keys(this.items).length;
    }

    /**
     *
     * @return {boolean}
     */
    isEmpty() {
        return this.getSize() < 1;
    }

    /**
     *
     * @return {Object[]}
     */
    getAll() {
        return Object.keys(this.items).map(k => this.items[k])
    }

    /**
     *
     * @return {Object[]}
     */
    filter(filterFn) {
        return this.getAll().filter(filterFn);
    }

    /**
     *
     * @return {Object[]}
     */
    map(mapFn) {
        return this.getAll().map(mapFn);
    }


}
module.exports = ItemCache;