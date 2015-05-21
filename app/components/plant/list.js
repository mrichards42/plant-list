(function() {
    angular.module('PlantsApp')
        .controller('PlantListCtrl', ['$scope', 'plantList', PlantListCtrl]);

    function PlantListCtrl($scope, plantList) {
        console.log(plantList);
        $scope.plants = [];
        plantList.getList().then(function(list) {
            console.log('list', list);
            $scope.plants = list;
        });
    }
})();