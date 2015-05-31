(function() {
    angular.module('PlantsApp')
        .factory('plantList', ['pouchDB', plantListService]);

    function plantListService(pouchDB) {
        var db = plantsDB();
        /**
         * Get and initialize the plants database
         * @returns {PouchDB}
         */
        function plantsDB() {
            var db = pouchDB('plants');
            db.putIfNotExists(db.createDesignDoc('list_items', function (doc) {
                if (doc.type === 'list-plant')
                    emit(doc.list_id, {_id: doc.plant_id});
                else if (doc.type === "unknown")
                    emit(doc.year + " " + doc.site + " Unknowns");
                else if (doc.idYear)
                    emit(doc.idYear + " Plants");
            }));
            return db;
        }

        var self = {
            // List name for all plants
            ALL_PLANTS: 'All Plants',

            /**
             * Get a single plant by code
             * @param {String} code USDA code
             * @returns {Promise} plant
             */
            getPlant: function(code) {
                return db.get(code).then(function(plant) {
                    plant.code = plant._id;
                    return plant;
                });
            },

            /**
             * Get stored plant lists
             * @returns {Promise} [{name: count}, ...]
             */
            getLists: function () {
                return db.query('list_items', { reduce: '_count', group: true})
            },

            /**
             * Get plants from a stored plant list
             * @param {String} [name=ALL_PLANTS]
             * @returns {Promise} array of plants
             */
            getPlants: function(name) {
                var docs;
                if (name === self.ALL_PLANTS || name === undefined)
                    docs = db.allDocs({startKey: 'A', endKey: 'ZZZZ', include_docs: true});
                else
                    docs = db.query({key: 'list-' + name, include_docs: true});
                return docs.then(function(result) {
                    return result.rows.map(function (row) { return row.doc; });
                });
            }
        };

        return self;
    }
})();