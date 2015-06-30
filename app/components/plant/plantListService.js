(function() {
    angular.module('PlantsApp')
        .factory('plantList', ['$q', 'pouchDB', 'pouchReplicate', plantListService]);

    function plantListService($q, pouchDB, pouchReplicate) {
        var db = pouchDB('plants');

        var self = {
            // List name for all plants
            ALL_PLANTS: 'All Plants',

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
            getPlant: function(code) {
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
            },

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
            getLists: function() {
                return localDocMemoize('lists', buildLists)().then(function (data) {
                    data.lists.map = data.map;
                    return data.lists;
                });
            },

            /**
             * Get plants from a stored plant list
             * @param {String} [id=ALL_PLANTS]
             * @returns {Promise} array of plants
             */
            getPlants: function(id) {
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
                    console.log('getPlants: allDocs', options, new Date());
                    return db.allDocs(options).then(function(result) {
                        console.log('getPlants: result', result, new Date());
                        return getDocs(result.rows);
                    })
                }
                return self.getLists().then(function(lists) {
                    return db.allDocs({keys:lists.map[id].plants, include_docs:true}).then(function(result) {
                        console.log('getPlants: from computed list', result);
                        return getDocs(result.rows);
                    });
                });
            },
            /**
             * Pull changes from the remote database
             * @param [remoteDb] already opened remote database. Created if necessary.
             * @returns {Promise} PouchDB replicator
             */
            'sync': function(remoteDb) {
                return $q.when(remoteDb || pouchDB.openRemote('plants')).then(function(remoteDb) {
                    return pouchReplicate(remoteDb, db);
                });
            }
        };

        /**
         * Function decorator that memoizes data in _local docs based on update_seq
         * @param cacheId doc id (without '_local/')
         * @param dataFunc function returning a promise to data to be memoized
         * @returns {function} Memoized version of function
         */
        function localDocMemoize(cacheId, dataFunc) {
            cacheId = '_local/' + cacheId;
            return function() {
                var args = arguments;
                // Look for cache
                return db.get(cacheId).catch(function (err) {
                    if (err.status !== 404)
                        throw err;
                    return {_id: cacheId, update_seq: 0};
                }).then(function (cache) {
                    return db.info().then(function (info) {
                        if (cache.update_seq === info.update_seq) {
                            console.log('Using memoized data from ' + cacheId);
                            return cache.data;
                        }
                        // No cache or old cache: rebuild
                        return dataFunc(args).then(function (data) {
                            // Update cache
                            return db.upsert(cacheId, function(doc) {
                                doc.data = data;
                                doc.update_seq = info.update_seq;
                                return doc;
                            }).then(function () {
                                console.log('data cached', data);
                                return data;
                            });
                        });
                    });
                }).catch(console.log.bind(console));
            }
        }

        function buildLists() {
            console.log('buildLists start', new Date());

            var lists = [];
            var listMap = {};
            /**
             * Return an Array of lists
             * @param rows Array of rows from allDocs()
             * @param parseId function taking a docId and returning an object { list: '', plant: '' }
             * @return {Array} lists
             */
            function addListItems(rows, parseId) {
                function addPlant(id) {
                    var item = parseId(id);
                    var list = getList(item.list);
                    // Add plant to this list and parents
                    while (list) {
                        if (! list.plantsMap[item.plant]) {
                            list.plantsMap[item.plant] = true;
                            list.plants.push(item.plant);
                            ++list.count;
                        }
                        list = list.parent;
                    }
                }
                // Get or create a list object
                function getList(listId) {
                    if (listMap[listId])
                        return listMap[listId];
                    // Split the last part of the path off
                    var pathSplit = listId.match(/(.*)\/([^\/]*)$/);
                    var list = {
                        id: listId,
                        name: pathSplit ? pathSplit[2] : listId,
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
                        var parent = getList(list.parent);
                        list.parent = parent;
                        parent.children.push(list);
                    }
                    // Add to the main Array of lists
                    if (! list.parent)
                        lists.push(list);
                    return list;
                }
                angular.forEach(rows, function(row) { addPlant(row.key) });
            }

            // All plants
            return db.allDocs({startkey:'A', endkey:'ZZZZ'}).then(function(result) {
                console.log('buildLists ALL_PLANTS start', new Date());
                lists.push({
                    id: self.ALL_PLANTS,
                    name: self.ALL_PLANTS,
                    parent: null,
                    children: [], // Don't need children for special ALL_PLANTS
                    count: result.rows.length
                });
                console.log('buildLists ALL_PLANTS end', new Date());
            }).then(function() {
                // List documents
                db.allDocs({startkey: 'list-plant:', endkey: 'list-plant:\uffff'}).then(function (result) {
                    console.log('getLists list-plants start', new Date());
                    addListItems(result.rows, function (id) {
                        var data = id.split(':');
                        return {
                            list: data[1],
                            plant: data[2]
                        };
                    });
                    console.log('getLists list-plants done', new Date());
                });
            }).then(function() {
                // Unknowns
                db.allDocs({startkey: 'unk:', endkey: 'unk:\uffff'}).then(function (result) {
                    console.log('getLists unknowns start', new Date());
                    addListItems(result.rows, function (id) {
                        var data = id.split(':');
                        return {
                            list: ['Unknowns', data[1], data[2]].join(' '), // Unknowns YEAR SITE
                            plant: id
                        };
                    });
                    console.log('getLists unknowns done', new Date());
                });
            }).then(function() {
                // Compact lists and remove recursive objects (for JSON)
                function compact(list) {
                    delete list.parent;
                    delete list.listMap;
                    angular.forEach(list.children, compact);
                }
                angular.forEach(lists, compact);
                return {lists:lists, map:listMap};
            });
        }

        self.sync();

        return self;
    }
})();