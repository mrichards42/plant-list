(function() {
    angular.module('PlantsApp')
        .factory('plantList', ['$http', plantListService]);

    // TODO: create an api that uses promises
    // TODO: make this work with dropbox config files
    function plantListService($http) {
        var promise = null;
        return function() {
            if (!promise) {
                promise = $http.get('assets/json/plants.json');
                console.log('Getting plants list');
            }
            return promise;
        };
    }

})();