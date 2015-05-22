angular.module('PlantsApp', ['ionic', 'ui.router'])
    .directive('plantMainMenu', function() {
        return {
            restrict: 'E',
            templateUrl: 'app/menus/main.html'
        }
    });
