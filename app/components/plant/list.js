(function() {
    angular.module('PlantsApp')
        .controller('PlantListCtrl', ['$scope', '$stateParams', 'plantList', PlantListCtrl]);

    function PlantListCtrl($scope, $stateParams, plantList) {
        var listName = $stateParams.name;
        var promise;
        if (listName) {
            $scope.listName = listName;
            promise = plantList.getListPlants(listName);
        }
        else {
            $scope.listName = plantList.ALL_PLANTS;
            promise = plantList.getPlants();
        }
        promise.then(function (list) {
            console.log(list);
            $scope.plants = list;
        });
    }
})();