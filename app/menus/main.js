(function() {
    angular.module('PlantsApp')
        .directive('plantMainMenu', function() {
            return {
                restrict: 'E',
                templateUrl: 'app/menus/main.html'
            }
        })
        .controller('MainMenuCtrl', ['$scope', '$q', 'plantList', MainMenuCtrl]);

    function MainMenuCtrl($scope, $q, plantList) {
        // Make an array of {name, count} objects representing all plant lists
        $q.all({
            all: plantList.getPlants(),
            lists: plantList.getLists()
        }).then(function(result) {
            console.log(result);
            var plantLists = [{name: plantList.ALL_PLANTS, count: result.all.length}];
            angular.forEach(result.lists, function(list, name) {
                plantLists.push({name: name, count: list.length});
            });
            $scope.plantLists = plantLists;
        });
    }
})();