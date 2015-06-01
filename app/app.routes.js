(function() {
    angular.module('PlantsApp')
        .config(['$stateProvider', '$urlRouterProvider', function config($stateProvider, $urlRouterProvider) {
            // states
            $urlRouterProvider.when('', '/list');
            $urlRouterProvider.when('/', '/list');
            $urlRouterProvider.when('/list', '/list/');

            $stateProvider.state('list', {
                url: '/list/{id}',
                controller: 'PlantListCtrl',
                templateUrl: 'app/components/plant/list.html'
            });

            $stateProvider.state('detail', {
                url: '/detail/{code}',
                controller: 'PlantDetailCtrl',
                templateUrl: 'app/components/plant/detail.html'
            });
        }])
})();