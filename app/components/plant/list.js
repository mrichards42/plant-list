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
            else if (plant.scientific && plant.scientific == plant.genus)
                return " sp.";
            else
                return "";
        };

        // Custom filter function:
        // Matches query against code, name, scientific, common, and synonyms
        $scope.plantFilter = function(query) {
            if (! query)
                return function() { return true; };
            query = query.toLowerCase();
            return function(plant) {
                function matches(val) {
                    return val && val.toLowerCase().indexOf(query) !== -1;
                }
                if (matches(plant.code) || matches(plant.scientific) || matches(plant.common) ||
                        matches(plant.idCode) || matches(plant.idScientific) || matches(plant.name))
                    return true;
                if (plant.synonyms) {
                    return plant.synonyms.some(function(syn) {
                        return matches(syn.code) || matches(syn.scientific);
                    });
                }
                return false;
            }
        };

        var listId = $stateParams.id || plantList.ALL_PLANTS;
        $scope.listName = plantList.getListName(listId);
        plantList.getPlants(listId).then(function (list) {
            console.log(list);
            $scope.plants = list;
            $ionicLoading.hide();
        });
    }
})();