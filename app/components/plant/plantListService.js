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

            /**
             * Add or update plants data if any
             * @param checkId   If db.get(checkId) fails, add or update data
             * @param startkey  startkey for updating existing documents
             * @param endkey    endkey for updating existing documents
             * @param jsonFile  JSON file with data (Array of Objects with _id)
             * @returns {Promise}
             */
            function loadData(checkId, startkey, endkey, jsonFile) {
                return db.get(checkId).catch(function(err) {
                    if (err.status !== 404)
                        throw err;
                    console.log('updating db with ' + jsonFile);
                    return $http.get(jsonFile).then(function (result) {
                        return db.allDocs({startkey:startkey, endkey:endkey}).then(function(allDocs) {
                            // Map id to rev
                            var existing = {};
                            angular.forEach(allDocs.rows, function(row) {
                                existing[row.id] = row.value.rev;
                            });
                            // Add _rev to each json doc
                            angular.forEach(result.data, function(row) {
                                var rev = existing[row._id];
                                if (rev)
                                    row._rev = rev;
                            });
                            return db.bulkDocs(result.data);
                        })
                    }).catch(function (err) {
                        console.log('Error fetching ' + jsonFile, err);
                    });
                });
            }

            return $q.all([
                // Plants
                loadData('VIRO3', 'A', 'ZZZZ', 'assets/json/all_plants.json'),
                // Diversity lists
                loadData(
                    'list-plant:2014 TALL Diversity/TALL_001/Subplot 31/TALL_001 31.1.10:VIRO3',
                    'list-plant:2014 TALL Diversity',
                    'list-plant:2014 TALL Diversity\uffff',
                    'assets/json/div_lists.json'),
                // Unknowns
                loadData(
                    'unk:2015:TALL:603',
                    'unk:2015:TALL:',
                    'unk:2015:TALL:\uffff',
                    'assets/json/TALL_unknowns.json'),
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
             * Is this plant (or list) an unknown?
             * @returns {boolean}
             */
            isUnknown: function(plant) {
                return (typeof plant === 'object' ? plant._id : plant).substr(0, 3)  == 'unk';
            },

            /**
             * Get a single plant by code
             * @param {String} code USDA code
             * @returns {Promise} plant
             */
            getPlant: withDB(function(db, code) {
                return db.get(code).then(function(plant) {
                    if (! self.isUnknown(plant))
                        return plant;
                    // Fetch unknown synonyms
                    return db.allDocs({keys: plant.synonyms || [], include_docs:true}).then(function(result) {
                        angular.forEach(result.rows, function(row, i) {
                            if (row.doc) {
                                plant.synonyms[i] = row.doc;
                                if (! plant.idCode && row.doc.idCode)
                                    plant.idCode = row.doc.idCode;
                            }
                        });
                        return plant;
                    }).then(function(plant) {
                        if (! plant.idCode)
                            return plant;
                        // Fetch identified plant (if this is an ID'd unknown)
                        return db.get(plant.idCode).catch(function() {
                            return;
                        }).then(function (result) {
                            plant.idPlant = result;
                            return plant;
                        });
                    });
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
                // All plants
                return db.allDocs({startkey:'A', endkey:'ZZZZ'}).then(function(result) {
                    console.log('getLists got ALL_PLANTS', new Date());
                    return [{
                        id: self.ALL_PLANTS,
                        name: self.ALL_PLANTS,
                        parent: null,
                        children: [],
                        count: result.rows.length
                    }];
                }).then(function(lists) {
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
                        console.log('getLists list-plants done', new Date());
                        return lists;
                    });
                }).then(function(lists) {
                    // Unknowns
                    return db.allDocs({startkey:'unk:', endkey:'unk:\uffff'}).then(function(result) {
                        console.log('getLists got unknowns', new Date());
                        function addUnknown(id) {
                            var unk = id.split(':');
                            var year = unk[1];
                            var site = unk[2];
                            // Add list
                            var listName = 'Unknowns' + ' ' + year + ' ' + site;
                            var listId = 'unk:' + year + ':' + site;
                            var list = self.listMap[listId] || {
                                id: listId,
                                name: listName,
                                parent: null,
                                children: [],
                                plants: [],
                                count: 0
                            };
                            if (! self.listMap[list.id]) {
                                self.listMap[list.id] = list;
                                lists.push(list);
                            }
                            // Add plant to list
                            list.count += 1;
                            list.plants.push(id);
                        }
                        angular.forEach(result.rows, function(row) { addUnknown(row.key) });
                        console.log('getLists unknowns done', new Date());
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
                if (! self.isUnknown(id))
                    id = 'list-plant:' + id;
                options = {
                    startkey: id + '/',
                    endkey: id + '/\uffff'
                };
                console.log('getPlants: allDocs', options);
                return db.allDocs(options).then(function(pathResult) {
                    options = {
                        startkey: id + ':',
                        endkey: id + ':\uffff'
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
                        if (self.isUnknown(row.key))
                            plantId = idSplit.join(':');
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