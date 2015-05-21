(function() {
    angular.module('PlantsApp')
        .controller('PlantDetailCtrl', ['$scope', '$stateParams', 'plantList', 'flickr', PlantDetailCtrl]);

    function PlantDetailCtrl($scope, $stateParams, plantList, flickr) {
        var code = $stateParams.code;
        $scope.getPhotoUrl = flickr.getPhotoUrl;
        plantList.getPlant(code).then(function(plant) {
            $scope.plant = plant;
            // Look for photos
            flickr.query(plant.scientific, function (data) {
                console.log('photo queried', data);
                var photos = flickr.getPhotos(data);
                $scope.photos = photos;
                if (photos.length > 0) {
                    $scope.thumbnail = flickr.getPhotoUrl(photos[0], flickr.SMALL);
                    $scope.caption = photos[0].title;
                }
            });
        });
    }
})();