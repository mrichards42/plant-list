/**
 * PouchDB service
 */

(function () {
    angular.module('PlantsApp')
        .factory('plantsDB', ['pouchDB', PlantsDbService]);

    function PlantsDbService(pouchDB) {
        var db = pouchDB('plantsDB');
        return db;
    }
})();
