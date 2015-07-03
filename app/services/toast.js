/**
 * Toast ctrl using $ionicLoading
 */

(function () {
    angular.module('PlantsApp').factory('toast', ['$ionicLoading', function($ionicLoading) {
        return {
            /**
             * Show a toast
             * @param opts Message or opts object
             * @param [opts.message] Message
             * @param [opts.duration=2000] Duration in ms
             * @param [opts.noBackdrop=true] Hide backdrop
             * @returns {Object} loading indicator from $ionicLoading.show()
             */
            show: function(opts) {
                if (typeof opts === 'string')
                    opts = {message:opts};
                var message = opts.message || '';
                return $ionicLoading.show(angular.extend(opts, {
                    noBackdrop: true,
                    duration: 2000,
                    template: message
                }));
            },
            /**
             * Hide the current toast
             */
            hide: $ionicLoading.hide
        };
    }]);
})();