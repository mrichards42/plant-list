(function() {
    angular.module('PlantsApp')
        .controller('PlantListCtrl', ['$scope', '$stateParams', 'plantList', PlantListCtrl]);

    function PlantListCtrl($scope, $stateParams, plantList) {
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
        });
    }
})();