(function() {
    angular.module('PlantsApp')
        .controller('ConfigCtrl', ['$scope', '$ionicPopup', 'config', ConfigCtrl]);

    function ConfigCtrl($scope, $ionicPopup, config) {
        var cfg = config.load();
        function remoteDb() {
            return new PouchDB("https://" + cfg.username + ".cloudant.com/plants", {skipSetup: true});
        }
        $scope.config = cfg;
        $scope.login = function() {
            // Open db and try to login
            remoteDb().login(cfg.username, cfg.password).then(function(result) {
                cfg.isLoggedIn = true;
                console.log(result);
                cfg.save();
            }).catch(function (err) {
                console.log(err);
                var alertPopup = $ionicPopup.alert({
                    title: 'Could not log in',
                    template: 'Check username and password'
                });
            });
        };

        $scope.logout = function() {
            cfg.password = "";
            if (! cfg.saveUsername)
                cfg.username = "";
            remoteDb().logout().then(console.log.bind(console));
            cfg.isLoggedIn = false;
            cfg.save();
        };
    }
})();