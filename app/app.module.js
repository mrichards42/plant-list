angular.module('PlantsApp', ['ionic', 'ui.router', 'pouchdb'])
    .directive('plantMainMenu', function() {
        return {
            restrict: 'E',
            templateUrl: 'app/menus/main.html'
        }
    });
