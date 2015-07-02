angular.module('PlantsApp', ['ionic', 'ui.router', 'pouchdb'])
    .directive('plantMainMenu', function() {
        return {
            restrict: 'E',
            templateUrl: 'app/menus/main.html'
        }
    })
    .directive('plGallery', function() {
        return {
            restrict: 'E',
            scope: {
                images: '=images'
            },
            templateUrl: 'app/components/photo/scroller.html'
        }
    });
