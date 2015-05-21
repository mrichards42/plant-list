(function () {
    angular.module('PlantsApp')
        .factory('config', ['dropbox', ConfigService]);

    function ConfigService(dropbox) {
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
                dropbox.readFile('/plants_data/config.json', function (error, data) {
                    console.log(error, data);
                    if (error) {
                        console.log('error fetching config.json', error);
                    }
                    else if (data) {
                        var config = JSON.parse(data);
                        var oldVersion = self.get('version');
                        // Update
                        if (!oldVersion || config.version > version)
                            for (var key in config)
                                self.set(key, config[key]);
                        if (callback)
                            callback(self);
                    }
                });
            }
        };
        return self;
    }
})();