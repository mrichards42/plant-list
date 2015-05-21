/**
 * Persistent storage
 * Uses localStorage caching and JSON objects
 */

(function () {
    angular.module('PlantsApp')
        .factory('storage', StorageService);

    function StorageService() {
        var self = {
            _data: {},
            get: function (key) {
                return self._data[key] || JSON.parse(localStorage.getItem(key));
            },
            set: function (key, value) {
                self._data[key] = value;
                localStorage.setItem(key, JSON.stringify(value));
            }
        };
        return self;
    }
})();