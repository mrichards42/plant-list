(function() {
    angular.module('PlantsApp')
        .controller('SyncCtrl', ['$scope', '$state', '$ionicPopup', 'toast', 'plantList', 'pouchReplicate', SyncCtrl]);

    function SyncCtrl($scope, $state, $ionicPopup, toast, plantList, pouchReplicate) {
        $scope.isSyncing = false;

        $scope.sync = function() {
            plantList.sync().catch(function(err) {
                if (err.name !== 'authentication_error')
                    throw err;
                // Ask user to login
                $ionicPopup.confirm({
                    title: 'Sync error',
                    template: 'Please login to sync plants database',
                    okText: 'Login'
                }).then(function() {
                    $state.go("config");
                });
            });
        };

        pouchReplicate.on('start', function() {
            $scope.isSyncing = true;
        }).on('complete', function(info) {
            $scope.isSyncing = false;
            if (info.docs_written && info.docs_read)
                toast.show('Updated ' + info.docs_written + ' of ' + info.docs_read + ' docs');
        }).on('error', function() {
            $scope.isSyncing = false;
            toast.show('Errors during sync');
        });
    }
})();