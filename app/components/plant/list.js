(function() {
    angular.module('PlantsApp')
        .controller('PlantListCtrl', PlantListCtrl);

    function PlantListCtrl($scope, plantList) {
        plantList().success(function(data) {
            $scope.plants = data;
            console.log('PlantListCtrl done', data);
        });
    }
})();