var app = angular.module('PlantsApp', ['ionic', 'ui.router']);

app.config(function config($stateProvider, $urlRouterProvider) {
    // oauth urls
    $urlRouterProvider.when('/access_token=:accessToken', function($location) {
        var hash = $location.path().substr(1);
        console.log('when', $location.path());
        return '/login/' + hash;
    });
    // states
    $stateProvider.state('index', {
        url:'/',
        controller:'IndexCtrl',
        templateUrl:''
    });
    $urlRouterProvider.when('', '/');

    $stateProvider.state('login', {
        url:'/login',
        controller:'LoginCtrl',
        templateUrl:'templates/login.html'
    });

    $stateProvider.state('auth', {
        url:'/login/access_token={access_token}&token_type={token_type}&state={state}&uid={uid}',
        controller:'LoginCtrl',
        templateUrl:'templates/login.html'
    });

    $stateProvider.state('list', {
        url:'/list',
        controller:'PlantListCtrl',
        templateUrl:'templates/list.html'
    });

    $stateProvider.state('detail', {
        url:'/detail/{code}',
        controller:'DetailCtrl',
        templateUrl:'templates/detail.html'
    });
});

app.factory('dropbox', function($state) {
    var credentials = { key: '72z2t0scx09nr87' };
    credentials.token = localStorage.getItem('dropbox-token');
    var client = new Dropbox.Client(credentials);
    console.log('new dropbox', client);
    return client;
});

app.factory('config', function(dropbox) {
    var self = {
        _config: {},
        get: function(key) {
            return self._config[key] || JSON.parse(localStorage.getItem('config-' + key));
        },
        set: function(key, value) {
            self._config[key] = value
            localStorage.setItem('config-' + key, JSON.stringify(value));
        },
        hasConfig: function() {
            return self.get('version') != null;
        },
        // Promise version of the config file
        load: function(callback) {
            if (self.hasConfig())
                callback(self);
            else
                self.update(callback);
        },
        // Load from dropbox, replacing config if version > current
        update: function(callback) {
            dropbox.readFile('/plants_data/config.json', function(error, data) {
                console.log(error, data);
                d = data;
                if (error) {
                    console.log('error fetching config.json', error);
                }
                else if (data) {
                    var config = JSON.parse(data);
                    var oldVersion = self.get('version');
                    // Update
                    if (! oldVersion || config.version > version)
                        for (var key in config)
                            self.set(key, config[key]);
                    if (callback)
                        callback(self);
                }
            });
        }
    };
    return self;
});

// TODO: make this work with dropbox config files
app.factory('plantList', function($http) {
    var promise = null;
    return function() {
        if (!promise) {
            promise = $http.get('plants.json');
            console.log('Getting plants list');
        }
        return promise;
    };
});


app.factory('flickr', function($http, config) {
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
});

app.controller('IndexCtrl', function IndexCtrl($state, $ionicHistory, dropbox) {
    $ionicHistory.nextViewOptions({
        disableAnimate: true,
        disableBack: true
    });
    console.log('indexctrl');
    // Try to login with saved credentials
    dropbox.authenticate({interactive:false}, function(error, client) {
        if (error) {
            client.reset();
            $state.go('login');
        }
        else {
            $state.go('list');
        }
    });
});

app.controller('LoginCtrl', function LoginCtrl($scope, $stateParams, config, dropbox) {
    // Authenticate function (attached to login button)
    $scope.authenticate = function () {
        dropbox.authenticate(function (error, client) {
            if (error) {
                client.reset();
                return alert('Error logging in to Dropbox: ' + error);
            }
            // NB: app is reloaded with the redirect url, so we can't do anything here
        });
    };

    // Finish authentication if necessary (on redirect)
    if (! dropbox.isAuthenticated() && $stateParams.access_token) {
        // Update credentials
        var credentials = dropbox.credentials();
        credentials.token = $stateParams.access_token;
        dropbox.setCredentials(credentials);
        console.log('params:', $stateParams);
        console.log('credentials:', credentials);
        console.log('dropbox', dropbox);
        dropbox.authenticate({interactive:false});
        console.log('authenticated:', dropbox.isAuthenticated());
        localStorage.setItem('dropbox-token', credentials.token);
    }

    $scope.isAuthenticated = dropbox.isAuthenticated();

    if (dropbox.isAuthenticated()) {
        listDir('/');
        config.loadFromDropbox(function(cfg) {
            console.log(cfg);
        });
    }
});

app.controller('PlantListCtrl', function PlantListCtrl($scope, plantList) {
    plantList().success(function(data) {
        $scope.plants = data;
        console.log('PlantListCtrl done', data);
    });
});

app.controller('DetailCtrl', function DetailCtrl($scope, $stateParams, plantList, flickr) {
    var code = $stateParams.code;
    $scope.flickr = flickr;
    $scope.getPhotoUrl = flickr.getPhotoUrl;
    plantList().success(function(plants) {
        for (var i=0; i < plants.length; ++i) {
            var plant = plants[i];
            if (plant.code == code) {
                $scope.plant = plant;
                console.log('DetailCtrl done', plant);
                flickr.query(plant.scientific, function(data) {
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
});
