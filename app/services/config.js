(function () {
    angular.module('PlantsApp')
        .factory('config', ['storage', ConfigService]);

    function ConfigService(storage) {
        var self = {
            get: function (key) {
                return storage.get('config-' + key);
            },
            set: function (key, value) {
                storage.set('config-' + key, value);
            },
            hasConfig: function () {
                return self.get('version') != null;
            },
            // Callback version of the config file
            load: function (callback) {
                if (self.hasConfig())
                    callback(self);
                else
                    self.update(callback);
            },
            // Load from dropbox, replacing config if version > current
            update: function (callback) {
                callback(self);
            }
        };
        return self;
    }
})();