(function () {
    angular.module('PlantsApp')
        .factory('config', ConfigService);

    function ConfigService() {
        var self = {
            _config: {},
            get: function (key) {
                return self._config[key] || JSON.parse(localStorage.getItem('config-' + key));
            },
            set: function (key, value) {
                self._config[key] = value;
                localStorage.setItem('config-' + key, JSON.stringify(value));
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