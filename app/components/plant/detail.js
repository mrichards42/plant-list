(function() {
    angular.module('PlantsApp')
        .controller('PlantDetailCtrl', ['$scope', '$stateParams', 'plantList', 'flickr', PlantDetailCtrl]);

    function PlantDetailCtrl($scope, $stateParams, plantList, flickr) {
        var plantId = $stateParams.id;
        $scope.getPhotoUrl = flickr.getPhotoUrl;
        plantList.getPlant(plantId).then(function(plant) {
            console.log(plant);
            if (plantList.isUnknown(plant)) {
                $scope.unknown = plant;
                $scope.plant = plant.idPlant;
            }
            else
                $scope.plant = plant;
            $scope.photos = [];
            // Look for photos
            /*
            flickr.query(plant.scientific, function (data) {
                console.log('photo queried', data);
                var photos = flickr.getPhotos(data);
                $scope.photos = photos;
                if (photos.length > 0) {
                    $scope.thumbnail = flickr.getPhotoUrl(photos[0], flickr.SMALL);
                    $scope.caption = photos[0].title;
                }
            });
            */
        });
    }
})();