(function() {
    angular.module('PlantsApp')
        .controller('PlantListCtrl', ['$scope', '$stateParams', 'plantList', PlantListCtrl]);

    function PlantListCtrl($scope, $stateParams, plantList) {
        var listName = $stateParams.name;
        $scope.genusSuffix = function(plant) {
            if (plant.code.lastIndexOf("SPP") == plant.code.length - 3)
                return " spp. (lump)";
            else if (plant.scientific == plant.genus)
                return " sp.";
            else
                return "";
        };
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