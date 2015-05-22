/**
 * Persistent storage
 * Uses localStorage caching and JSON objects
 */

(function () {
    angular.module('PlantsApp')
        .factory('storage', ['$q', StorageService]);

    function StorageService($q) {
        var self = {
            _data: {},
            get: function (key, fallback) {
                return self._data[key] || (self._data[key] = (JSON.parse(localStorage.getItem(key)) || fallback));
            },
            set: function (key, value) {
                self._data[key] = value;
                localStorage.setItem(key, JSON.stringify(value));
            },
            getPromise: function(key, fallback) {
                return $q(function(resolve) {
                    resolve(self.get(key, fallback));
                });
            }
        };
        return self;
    }
})();