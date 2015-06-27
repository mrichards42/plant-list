(function() {
    angular.module('PlantsApp')
        .controller('SyncCtrl', ['$scope', 'toast', 'plantList', 'pouchReplicate', SyncCtrl]);

    function SyncCtrl($scope, toast, plantList, pouchReplicate) {
        $scope.isSyncing = false;

        $scope.sync = plantList.sync;

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