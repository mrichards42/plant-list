(function() {
    angular.module('PlantsApp')
        .controller('MainMenuCtrl', ['$scope', '$q', 'plantList', MainMenuCtrl]);

    function MainMenuCtrl($scope, $q, plantList) {
        plantList.getLists().then(function(result) {
            $scope.plantLists = result;
        });
    }
})();