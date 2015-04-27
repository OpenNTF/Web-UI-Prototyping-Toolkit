function MemoryCache(args){
    this.name = args.name || function(){throw new Error("missing name");}();
    this.keygen = args.keygen;
    this.preprocess = undefined;
    if(args.hasOwnProperty("preprocess") && typeof args.preprocess === 'function'){
        this.preprocess = args.preprocess;
    }
    this.cache = {};

    this.storeKeyValue= function(cacheKey, value){
        var v = value;
        if(typeof this.preprocess === 'function'){
            v = this.preprocess(cacheKey, value);
        }
        this.cache[cacheKey] =v;
    };
    this.storeValue = function(value){
        var key = this.keygen(value);
        this.storeKeyValue(key, value);
    };
    this.containsKey = function(key){
        return this.cache.hasOwnProperty(key);
    };
    this.get = function(key){
        return this.cache[key];
    };
    this.countCached = function(){
        return Object.keys(this.cache).length;
    }

}

module.exports = {
    MemoryCache:MemoryCache
};