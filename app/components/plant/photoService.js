(function() {
    angular.module('PlantsApp')
        .factory('flickr', ['$http', 'config', PhotoService]);

    function PhotoService($http, config) {
        var self = {
            // Photo sizes
            THUMB: 't', // thumbnail, 100 on longest side
            SMALL: 'm', // small, 240 on longest side
            MEDIUM: 'z', // medium, 640 on longest side
            LARGE: 'b', // large, 1024 on longest side
            getServiceUrl: function (service) {
                return "https://www.flickr.com/services/rest/?method=" + service
            },
            // Query and call a success callback
            query: function (searchTerm, callback) {
                config.load(function() {
                    var url = self.getServiceUrl("flickr.photos.search") +
                        "&sort=relevance" +
                        "&per_page=10" +
                        "&format=json" +
                        "&text=" + searchTerm +
                        "&api_key=" + config.get('flickr_api_key');
                    return $http.jsonp(url + "&jsoncallback=JSON_CALLBACK").success(callback);
                });
            },
            // Get photos from a flickr JSON response object
            getPhotos: function (data) {
                return data.stat != 'ok' ? [] : data.photos.photo;
            },
            // Get a photo given a response photo from query()
            getPhotoUrl: function (photo, size) {
                return "https://farm" + photo.farm + ".staticflickr.com/" +
                    photo.server + "/" +
                    photo.id + "_" + photo.secret + "_" + (size || self.THUMB) + ".jpg";
            }
        };
        return self;
    }
})();