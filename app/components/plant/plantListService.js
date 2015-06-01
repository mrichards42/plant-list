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
            }, '_count'));
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
                // Count all plants
                return db.allDocs({startkey:'A', endkey:'ZZZZ'}).then(function(result) {
                    console.log(result);
                    var lists = [{name: self.ALL_PLANTS, count: result.rows.length}];
                    // Count for each list
                    return db.query('list_items', {group: true}).then(function(result) {
                        return lists.concat(result.rows.map(function(row) { return {name:row.key, count:row.value} }));
                    });
                });
            },

            /**
             * Get plants from a stored plant list
             * @param {String} [id=ALL_PLANTS]
             * @param [options={include_docs:true}]
             * @returns {Promise} array of plants
             */
            getPlants: function(id, options) {
                options = options || {};
                options.include_docs = options.include_docs == undefined ? true : options.include_docs;
                var docs;
                if (id == self.ALL_PLANTS || id === undefined) {
                    options.startkey = options.startkey === undefined ? 'A' : options.startkey;
                    options.endkey = options.endkey === undefined ? 'ZZZZ' : options.endkey;
                    console.log('getPlants: allDocs', options);
                    docs = db.allDocs(options);
                }
                else {
                    options.startkey = id;
                    options.endkey = id + '\uffff';
                    options.reduce = options.reduce === undefined ? false : options.reduce;
                    console.log('getPlants: query', options);
                    docs = db.query('list_items', options);
                }
                return docs.then(function(result) {
                    var plants = [];
                    var idSet = {};
                    for (var i=0; i < result.rows.length; ++i) {
                        var doc = result.rows[i].doc;
                        var id = result.rows[i].value._id || result.rows[i].id;
                        // Remove duplicates
                        if (idSet[id])
                            continue;
                        idSet[id] = true;
                        if (doc) {
                            plants.push(doc);
                        }
                        else if (id != '2PLANT') {
                            plants.push({_id: id, code:id, scientific:id});
                            console.log('no plant', result.rows[i]);
                        }
                    }
                    return plants;
                });
            }
        };

        return self;
    }
})();