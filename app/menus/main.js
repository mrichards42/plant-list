(function() {
    angular.module('PlantsApp')
        .controller('MainMenuCtrl', ['$scope', '$q', 'plantList', MainMenuCtrl]);

    function MainMenuCtrl($scope, $q, plantList) {
        // Make an array of {name, count} objects representing all plant lists
        $q.all({
            all: plantList.getPlants(),
            lists: plantList.getLists()
        }).then(function(result) {
            console.log(result);
            var plantLists = [{name: plantList.ALL_PLANTS, count: result.all.length}];
            angular.forEach(result.lists, function(count, name) {
                plantLists.push({name: name, count: count});
            });
            $scope.plantLists = plantLists;
        });
    }
})();