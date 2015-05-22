(function() {
    angular.module('PlantsApp')
        .factory('plantList', ['$http', 'storage', plantListService]);

    function plantListService($http, storage) {
        var KEY = 'plant-lists';
        var loadPromise;
        var plantList;
        var codeMap = {};
        /**
         * Get the entire plant list
         * @returns {Promise} array of plants
         */
        function load() {
            if (! loadPromise) {
                console.log('Getting plants list');
                loadPromise = $http.get('assets/json/plants.json').then(function(response) {
                    plantList = response.data;
                    for(var i=0; i < plantList.length; ++i) {
                        var plant = plantList[i];
                        codeMap[plant.code] = plant;
                    }
                    return plantList;
                });
            }
            return loadPromise;
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
                return load().then(function() {
                    return codeMap[code];
                });
            },
            /**
             * Get a list of plants by code (or all plants with no arguments)
             * @param {Array} [codes=all plants] array of USDA codes
             * @returns {Promise} array of plants
             */
            getPlants: function(codes) {
                return load().then(function(allPlants) {
                    if (! codes)
                        return allPlants;
                    var result = [];
                    for (var i=0; i < codes.length; ++i) {
                        var code = codes[i];
                        result.push(codeMap[code]);
                    }
                    return result;
                });
            },

            /**
             * Get stored plant lists (with default)
             * @returns {Promise} plant list object
             */
            getLists: function () {
                return storage.getPromise(KEY, {});
            },

            /**
             * Get plants from a stored plant list
             * @param {String} name
             * @returns {Promise} array of plants
             */
            getListPlants: function(name) {
                if (name == self.ALL_PLANTS)
                    return self.getPlants();
                return self.getLists().then(function(lists) {
                    return self.getPlants(lists[name] || []);
                });
            },
            /**
             * Save a plant list
             * @param {String} name
             * @param {Array} codes array of USDA codes
             */
            saveList: function(name, codes) {
                self.getLists().then(function(lists) {
                    lists[name] = codes;
                    storage.set(KEY, lists);
                });
            }
        };
        // Add lists of plants by year
        self.getPlants().then(function(plants) {
            var byYear = {};
            for(var i=0; i<plants.length; ++i) {
                var plant = plants[i];
                if (plant.idYear) {
                    if (! byYear[plant.idYear])
                        byYear[plant.idYear] = [];
                    byYear[plant.idYear].push(plant.code);
                }
            }
            angular.forEach(byYear, function(codes, year) {
                self.saveList(year + ' Plants', codes);
            });
        });
        return self;
    }
})();