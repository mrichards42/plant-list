(function() {
    angular.module('PlantsApp')
        .controller('ConfigCtrl', ['$scope', 'config', ConfigCtrl]);

    function ConfigCtrl($scope, config) {
        var cfg = config.load();
        $scope.config = cfg;
        $scope.login = function() {
            cfg.isLoggedIn = true;
            cfg.save();
        };

        $scope.logout = function() {
            cfg.password = "";
            if (! cfg.saveUsername)
                cfg.username = "";
            cfg.isLoggedIn = false;
            cfg.save();
        };
    }
})();