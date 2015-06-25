(function() {
    angular.module('PlantsApp')
        .controller('ConfigCtrl', ['$scope', '$ionicPopup', 'config', ConfigCtrl]);

    function ConfigCtrl($scope, $ionicPopup, config) {
        var cfg = config.load();

        function remoteDb() {
            return new PouchDB("https://" + cfg.database + ".cloudant.com/plants", {skipSetup: true});
        }

        /**
         * Login to the DB with a token (aka UUID login)
         * If no token exists, login with real credentials and create a token
         */
        function login() {
            var db = remoteDb();
            // Login with a token and save token to cfg
            function tokenLogin(token) {
                token = cfg.token || token || ['', ''];
                return db.login(token[0], token[1]).then(function (result) {
                    cfg.token = token;
                    console.log('successfully logged in with token', token);
                    return result;
                });
            }
            return tokenLogin().catch(function(err) {
                if (err.status !== 403 && err.status !== 400)
                    throw err;
                // Login with real credentials
                return db.login(cfg.username, cfg.password).then(function(result) {
                    console.log(result);
                    // Create a dummy login to act as a token
                    var token = [PouchDB.utils.uuid(), PouchDB.utils.uuid()];
                    return db.signup(token[0], token[1]).then(function() {
                        return tokenLogin(token);
                    });
                });
            });
        }

        $scope.config = cfg;
        $scope.login = function() {
            cfg.database = cfg.username;
            login().then(function() {
                // Don't save plaintext password
                cfg.password = '';
                cfg.save();
                cfg.isLoggedIn = true;
            }).catch(function (err) {
                console.log(err);
                $ionicPopup.alert({
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