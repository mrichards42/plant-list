(function() {
    angular.module('PlantsApp')
        .controller('MainMenuCtrl', ['$scope', 'plantList', MainMenuCtrl]);

    function MainMenuCtrl($scope, plantList) {
        var shown = {};
        $scope.toggleChildren = function(list) {
            shown[list.id] = ! shown[list.id];
        };
        $scope.areChildrenShown = function(list) {
            return shown[list.id];
        };
        plantList.getLists().then(function(result) {
            console.log('Lists', result);
            $scope.plantLists = result;
        });
    }
})();