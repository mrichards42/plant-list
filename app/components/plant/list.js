(function() {
    angular.module('PlantsApp')
        .controller('PlantListCtrl', ['$scope', 'plantList', PlantListCtrl]);

    function PlantListCtrl($scope, plantList) {
        plantList().success(function(data) {
            $scope.plants = data;
            console.log('PlantListCtrl done', data);
        });
    }
})();