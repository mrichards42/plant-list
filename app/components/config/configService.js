(function () {
    angular.module('PlantsApp')
        .factory('config', ConfigService);

    function ConfigService() {
        var KEY = 'plants-config';

        /**
         * Constructs a new config object from localStorage.
         * Call {@code ConfigObject.save()} to save changes back to localStorage
         * @constructor
         */
        function ConfigObject() {
            try {
                angular.copy(JSON.parse(localStorage.getItem(KEY)), this);
            }
            catch (err) {
                // Do nothing, this will just be an empty object
                console.log('config error');
            }
        }

        ConfigObject.prototype.save = function() {
            localStorage.setItem(KEY, JSON.stringify(this));
        };

        return {
            /**
             * Loads a new {@link ConfigObject} from localStorage
             */
            load: function () {
                return new ConfigObject();
            }
        };
    }
})();