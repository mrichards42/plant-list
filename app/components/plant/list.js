(function() {
    angular.module('PlantsApp')
        .controller('PlantListCtrl', ['$scope', '$stateParams', '$ionicLoading', 'plantList', PlantListCtrl]);

    function PlantListCtrl($scope, $stateParams, $ionicLoading, plantList) {
        if (plantList.isLoading())
            $ionicLoading.show({
                template: 'Initializing Plant List...'
            });
        $scope.genusSuffix = function(plant) {
            if (plant.code.lastIndexOf("SPP") == plant.code.length - 3)
                return " spp. (lump)";
            else if (plant.scientific == plant.genus)
                return " sp.";
            else
                return "";
        };
        var listId = $stateParams.id || plantList.ALL_PLANTS;
        $scope.listName = listId;
        plantList.getPlants(listId).then(function (list) {
            console.log(list);
            $scope.plants = list;
            $ionicLoading.hide();
        });
    }
})();