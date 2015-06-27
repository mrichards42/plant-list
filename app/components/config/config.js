(function() {
    angular.module('PlantsApp')
        .controller('ConfigCtrl', ['$scope', '$ionicPopup', 'config', 'pouchDB', 'plantList', ConfigCtrl]);

    function ConfigCtrl($scope, $ionicPopup, config, pouchDB, plantList) {
        var cfg = config.load();

        function getRemoteUrl() {
            return "https://" + cfg.database + ".cloudant.com/plants";
        }

        $scope.config = cfg;
        $scope.login = function() {
            cfg.database = cfg.username;
            pouchDB.openRemote(getRemoteUrl()).then(function(db) {
                // Start update
                plantList.sync(db).then(console.log.bind(console)).catch(console.log.bind(console));
                // Don't save credentials
                if (! cfg.saveUsername)
                    cfg.username = '';
                cfg.password = '';
                cfg.isLoggedIn = true;
                cfg.save();
                $scope.$apply();
            }).catch(function (err) {
                console.log(err);
                $ionicPopup.alert({
                    title: 'Could not log in',
                    template: 'Check username and password'
                });
            });
        };

        $scope.logout = function() {
            pouchDB.openRemote(getRemoteUrl(), {skipSetup:true}).logout();
            cfg.isLoggedIn = false;
            cfg.save();
        };
    }
})();