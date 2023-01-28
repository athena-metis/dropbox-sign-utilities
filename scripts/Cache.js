'use strict';

class Cache {
    constructor() {
        this._store = {};
    }

    get(key) { return this._store[key] ?? null; }
    set(key, value) { return this._store[key] = value; }
    clearKey(key) { return delete(this._store[key]); }
    clearAll() { return this._store = {}; }

}