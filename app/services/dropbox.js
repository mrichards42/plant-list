(function() {
    angular.module('PlantsApp')
        .factory('dropbox', DropboxService);

    function DropboxService() {
        var credentials = { key: '72z2t0scx09nr87' };
        credentials.token = localStorage.getItem('dropbox-token');
        return new Dropbox.Client(credentials);
    }
})();