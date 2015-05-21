(function() {
    angular.module('PlantsApp')
        .controller('DetailCtrl', DetailCtrl);

    function DetailCtrl($scope, $stateParams, plantList, flickr) {
        var code = $stateParams.code;
        $scope.flickr = flickr;
        $scope.getPhotoUrl = flickr.getPhotoUrl;
        plantList().success(function (plants) {
            for (var i = 0; i < plants.length; ++i) {
                var plant = plants[i];
                if (plant.code == code) {
                    $scope.plant = plant;
                    console.log('DetailCtrl done', plant);
                    flickr.query(plant.scientific, function (data) {
                        console.log('Flickr done', data);
                        var photos = flickr.getPhotos(data);
                        $scope.photos = photos;
                        if (photos.length > 0) {
                            $scope.thumbnail = flickr.getPhotoUrl(photos[0], flickr.SMALL);
                            $scope.caption = photos[0].title;
                        }
                    });
                    break;
                }
            }
        });
    }
})();