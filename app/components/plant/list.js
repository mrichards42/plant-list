(function() {
    angular.module('PlantsApp')
        .controller('PlantListCtrl', ['$scope', '$stateParams', 'plantList', PlantListCtrl]);

    function PlantListCtrl($scope, $stateParams, plantList) {
        var listName = $stateParams.name || plantList.ALL_PLANTS;
        $scope.listName = listName;
        plantList.getPlants(listName).then(function (list) {
            console.log(list);
            $scope.plants = list;
        });
    }
})();