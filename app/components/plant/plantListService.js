(function() {
    angular.module('PlantsApp')
        .factory('plantList', ['$http', '$q', 'pouchDB', plantListService]);

    function plantListService($http, $q, pouchDB) {
        var dbPromise = plantsDB();
        var dbIsLoading = true;
        /**
         * Get and initialize the plants database
         * @returns {PouchDB}
         */
        function plantsDB() {
            var db = pouchDB('plants');
            return $q.all([
                // Add list_items view design doc
                db.upsertView('list_items',
                    function (doc) {
                        if (doc.type === 'list-plant')
                            emit(doc.list_id, {_id: doc.plant_id});
                        else if (doc.type === "unknown")
                            emit('list:' + doc.year + " " + doc.site + " Unknowns");
                        else if (doc.idYear)
                            emit('list:' + doc.idYear + " Plants");
                    },
                    '_count'
                ),
                // Add plant data
                db.get('VIRO3').catch(function (err) {
                    if (err.status !== 404)
                        throw err;
                    return $http.get('assets/json/all_plants.json').then(function (result) {
                        return result.data.map(function(row) { row._id = row.code; return row; });
                    }).catch(function (err) {
                        console.log('Error fetching all_plants.json', err);
                    }).then(function (rows) {
                        console.log('plants', rows);
                        return db.bulkDocs(rows);
                    });
                }),
                // Add Diversity lists
                db.get('list-plant:2014 TALL Diversity/TALL_001/Subplot 31/TALL_001 31.1.10:VIRO3').catch(function (err) {
                    if (err.status !== 404)
                        throw err;
                    return $http.get('assets/json/div_lists.json').then(function (result) {
                        console.log('list-plants', result);
                        return db.bulkDocs(result.data);
                    }).catch(function (err) {
                        console.log('Error fetching div_lists.json', err);
                    });
                })
            ]).then(function () {
                dbIsLoading = false;
                return db;
            });
        }

        // Decorator function that waits for the db to initialize
        function withDB(func) {
            return function() {
                var originalArgs = Array.prototype.slice.call(arguments);
                return dbPromise.then(function(db) {
                    return func.apply(func, [db].concat(originalArgs));
                });
            }
        }

        var self = {
            // List name for all plants
            ALL_PLANTS: 'All Plants',

            /**
             * Is the database still loading?
             * @returns {boolean}
             */
            isLoading: function() {
                return dbIsLoading;
            },

            /**
             * Get a single plant by code
             * @param {String} code USDA code
             * @returns {Promise} plant
             */
            getPlant: withDB(function(db, code) {
                return db.get(code).then(function(plant) {
                    plant.code = plant._id;
                    return plant;
                });
            }),

            /**
             * Return a list name from an id
             * @param listId
             * @returns {string}
             */
            getListName: function(listId) {
                if (listId == self.ALL_PLANTS)
                    return listId;
                // Cut "list:" off the front, or take the last part of the path
                return listId.substr(Math.max(5, listId.lastIndexOf('/')+1));
            },

            /**
             * Get stored plant lists
             * @returns {Promise} [{id:list_id, name:name, count:count, path:[parents, of, list]}, ...]
             */
            getLists: withDB(function (db) {
                console.log('getLists start', new Date());
                // Count all plants
                return db.allDocs({startkey:'A', endkey:'ZZZZ'}).then(function(result) {
                    var lists = [{
                        id: self.ALL_PLANTS,
                        name: self.ALL_PLANTS,
                        parent: null,
                        children: [],
                        count: result.rows.length
                    }];
                    console.log('getLists got ALL_PLANTS', new Date());
                    // Add each list
                    //return db.query('list_items', {group: true}).then(function(result) {
                    return db.allDocs({startkey:'list-plant:', endkey:'list-plant:\uffff'}).then(function(result) {
                        console.log('getLists got list_items', new Date());
                        var listMap = {}; // id: list
                        function addListPlant(id) {
                            var idSplit = id.split(':');
                            var listId = idSplit[1];
                            var plantId = idSplit[2];
                            var list = listMap[listId] || addList(listId);
                            // Add plant
                            while (list) {
                                if (! list.plantsMap[plantId]) {
                                    list.plantsMap[plantId] = true;
                                    list.plants.push(plantId);
                                    ++list.count;
                                }
                                list = list.parent;
                            }
                        }
                        function addList(id) {
                            // Split the last part of the path off
                            var pathSplit = id.match(/(.*)\/([^\/]*)$/);
                            var list = {
                                id: id,
                                name: pathSplit ? pathSplit[2] : id,
                                parent: pathSplit ? pathSplit[1] : null,
                                children: [],
                                plants: [],
                                plantsMap: {},
                                count: 0
                            };
                            listMap[list.id] = list;
                            // Create hierarchy
                            if (list.parent) {
                                // Get or create parent
                                var parent = listMap[list.parent] || addList(list.parent);
                                list.parent = parent;
                                // Add this list's count up the hierarchy
                                parent.children.push(list);
                            }
                            // Add to the main Array of lists
                            if (! list.parent)
                                lists.push(list);
                            return list;
                        }
                        angular.forEach(result.rows, function(row) { addListPlant(row.key) });
                        console.log('getLists done', new Date());
                        return lists;
                    });
                });
            }),

            /**
             * Get plants from a stored plant list
             * @param {String} [id=ALL_PLANTS]
             * @param [options={include_docs:true}]
             * @returns {Promise} array of plants
             */
            getPlants: withDB(function(db, id, options) {
                console.log(arguments);
                options = options || {};
                options.include_docs = options.include_docs == undefined ? true : options.include_docs;
                var docs;
                if (id == self.ALL_PLANTS || id === undefined) {
                    options.startkey = options.startkey === undefined ? 'A' : options.startkey;
                    options.endkey = options.endkey === undefined ? 'ZZZZ' : options.endkey;
                    console.log('getPlants: allDocs', options);
                    return db.allDocs(options).then(function(result) {
                        return result.rows.map(function(row) { return row.doc; });
                    })
                }
                else {
                    options.startkey = id;
                    options.endkey = id + '/\uffff';
                    options.reduce = options.reduce === undefined ? false : options.reduce;
                    console.log('getPlants: query', options);
                    docs = db.query('list_items', options);
                }
                return docs.then(function(result) {
                    console.log('getPlants: result', result);
                    var plants = [];
                    var idSet = {};
                    for (var i=0; i < result.rows.length; ++i) {
                        var row = result.rows[i];
                        var doc = row.doc;
                        var id = row.value && row.value._id ? row.value._id : row.id;
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
            })
        };

        return self;
    }
})();