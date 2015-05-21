(function () {
    angular.module('PlantsApp')
        .config(['$stateProvider', '$urlRouterProvider', function config($stateProvider, $urlRouterProvider) {
            // dropbox won't use hash urls
            $urlRouterProvider.when('/access_token=:accessToken', function ($location) {
                var hash = $location.path().substr(1);
                console.log('when', $location.path());
                return '/login/' + hash;
            });
        }])
        .controller('LoginCtrl', ['$scope', '$stateParams', 'config', 'dropbox', LoginCtrl]);

    function LoginCtrl($scope, $stateParams, config, dropbox) {
        // Authenticate function (attached to login button)
        $scope.authenticate = function () {
            dropbox.authenticate(function (error, client) {
                if (error) {
                    client.reset();
                    return alert('Error logging in to Dropbox: ' + error);
                }
                // NB: app is reloaded with the redirect url, so we can't do anything here
            });
        };

        // Finish authentication if necessary (on redirect)
        if (!dropbox.isAuthenticated() && $stateParams.access_token) {
            // Update credentials
            var credentials = dropbox.credentials();
            credentials.token = $stateParams.access_token;
            dropbox.setCredentials(credentials);
            console.log('params:', $stateParams);
            console.log('credentials:', credentials);
            console.log('dropbox', dropbox);
            dropbox.authenticate({interactive: false});
            console.log('authenticated:', dropbox.isAuthenticated());
            localStorage.setItem('dropbox-token', credentials.token);
        }

        $scope.isAuthenticated = dropbox.isAuthenticated();

        if (dropbox.isAuthenticated()) {
            listDir('/');
            config.loadFromDropbox(function (cfg) {
                console.log(cfg);
            });
        }
    }
})();