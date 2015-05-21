(function() {
    angular.module('PlantsApp')
        .config(function config($stateProvider, $urlRouterProvider) {
            // oauth
            $urlRouterProvider.when('/access_token=:accessToken', function ($location) {
                var hash = $location.path().substr(1);
                console.log('when', $location.path());
                return '/login/' + hash;
            });
            // states
            $stateProvider.state('index', {
                url: '/',
                controller: 'IndexCtrl',
                templateUrl: ''
            });
            $urlRouterProvider.when('', '/');

            $stateProvider.state('login', {
                url: '/login',
                controller: 'LoginCtrl',
                templateUrl: 'app/components/login/login.html'
            });

            $stateProvider.state('auth', {
                url: '/login/access_token={access_token}&token_type={token_type}&state={state}&uid={uid}',
                controller: 'LoginCtrl',
                templateUrl: 'app/components/login/login.html'
            });

            $stateProvider.state('list', {
                url: '/list',
                controller: 'PlantListCtrl',
                templateUrl: 'app/components/plant/list.html'
            });

            $stateProvider.state('detail', {
                url: '/detail/{code}',
                controller: 'PlantDetailCtrl',
                templateUrl: 'app/components/plant/detail.html'
            });
        })

        .controller('IndexCtrl', IndexCtrl);

    // Empty controller that deals with logins
    function IndexCtrl($state, $ionicHistory, dropbox) {
        $ionicHistory.nextViewOptions({
            disableAnimate: true,
            disableBack: true
        });
        // Try to login with saved credentials
        dropbox.authenticate({interactive:false}, function(error, client) {
            if (error) {
                client.reset();
                $state.go('login');
            }
            else {
                $state.go('list');
            }
        });
    }
})();