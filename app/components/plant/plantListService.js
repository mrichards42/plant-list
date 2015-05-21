(function() {
    angular.module('PlantsApp')
        .factory('plantList', ['$http', plantListService]);

    function plantListService($http) {
        var loadPromise;
        var plantList;
        var codeMap = {};
        var self = {
            /**
             * Get the entire plant list
             * @returns {Promise} plant object array promise
             */
            getList: function() {
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
            },
            /**
             * Get a single plant by code
             * @param {String} code USDA code
             * @returns {Promise} plant object promise
             */
            getPlant: function(code) {
                return self.getList().then(function() {
                    return codeMap[code];
                });
            },
            /**
             * Get a list of plants by code
             * @param {Array} codes array of USDA codes
             * @returns {Promise} plant object array promise
             */
            getPlants: function(codes) {
                return self.getList().then(function() {
                    var result = [];
                    for (var i=0; i < codes.length; ++i) {
                        var code = codeMap[i];
                        result.push(codeMap[code]);
                    }
                    return result;
                });
            }
        };
        plants = self;
        return self;
    }
})();