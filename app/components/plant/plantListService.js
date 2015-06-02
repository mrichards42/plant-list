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

            // listId: list
            listMap: {},

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
                // Take the last part of the path
                return listId.substr(listId.lastIndexOf('/') + 1);
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
                    return db.allDocs({startkey:'list-plant:', endkey:'list-plant:\uffff'}).then(function(result) {
                        console.log('getLists got list-plants', new Date());
                        self.listMap = {}; // id: list (
                        function addListPlant(id) {
                            var idSplit = id.split(':');
                            var listId = idSplit[1];
                            var plantId = idSplit[2];
                            var list = self.listMap[listId] || addList(listId);
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
                            self.listMap[list.id] = list;
                            // Create hierarchy
                            if (list.parent) {
                                // Get or create parent
                                var parent = self.listMap[list.parent] || addList(list.parent);
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
             * @returns {Promise} array of plants
             */
            getPlants: withDB(function(db, id) {
                var options;
                function getDocs(rows) {
                    return rows.map(function(row) {
                        return row.doc || {code: row.key, scientific: row.key, common: 'unknown'};
                    });
                }
                // All plants
                if (id == self.ALL_PLANTS || id === undefined) {
                    options = {
                        startkey: 'A',
                        endkey: 'Z\uffff',
                        include_docs: true
                    };
                    console.log('getPlants: allDocs', options);
                    return db.allDocs(options).then(function(result) {
                        console.log('getPlants: result', result);
                        return getDocs(result.rows);
                    })
                }
                // Shortcut if we've called getLists() already
                else if (self.listMap[id]) {
                    return db.allDocs({keys:self.listMap[id].plants, include_docs:true}).then(function(result) {
                        console.log('getPlants: from computed list', result);
                        return getDocs(result.rows);
                    });
                }
                // Otherwise assemble the list from list-plant docs
                options = {
                    startkey: 'list-plant:' + id + '/',
                    endkey: 'list-plant:' + id + '/\uffff'
                };
                console.log('getPlants: allDocs', options);
                return db.allDocs(options).then(function(pathResult) {
                    options = {
                        startkey: 'list-plant:' + id + ':',
                        endkey: 'list-plant:' + id + ':\uffff'
                    };
                    console.log('getPlants: allDocs', options);
                    return db.allDocs(options).then(function (keyResult) {
                        return pathResult.rows.concat(keyResult.rows);
                    });
                }).then(function(rows) {
                    var plantIds = [];
                    var idMap = {};
                    angular.forEach(rows, function(row) {
                        var idSplit = row.key.split(':');
                        var plantId = idSplit[2];
                        if (! idMap[plantId]) {
                            // Remove duplicates
                            idMap[plantId] = true;
                            plantIds.push(plantId);
                        }
                    });
                    // Fetch docs for plant ids
                    return db.allDocs({keys:plantIds, include_docs:true}).then(function(result) {
                        console.log('getPlants: result', result);
                        return getDocs(result.rows);
                    })
                });
            })
        };

        return self;
    }
})();