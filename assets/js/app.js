angular.module("PlantsApp", [ "ionic", "ui.router", "pouchdb" ]).directive("plantMainMenu", function() {
    return {
        restrict: "E",
        templateUrl: "app/menus/main.html"
    };
}).directive("plGallery", function() {
    return {
        restrict: "E",
        scope: {
            images: "=images"
        },
        templateUrl: "app/components/photo/scroller.html"
    };
});

(function() {
    angular.module("PlantsApp").config([ "$stateProvider", "$urlRouterProvider", function config($stateProvider, $urlRouterProvider) {
        $urlRouterProvider.when("", "/list");
        $urlRouterProvider.when("/", "/list");
        $urlRouterProvider.when("/list", "/list/");
        $stateProvider.state("list", {
            url: "/list/{id}",
            controller: "PlantListCtrl",
            templateUrl: "app/components/plant/list.html"
        });
        $stateProvider.state("detail", {
            url: "/detail/{id}",
            controller: "PlantDetailCtrl",
            templateUrl: "app/components/plant/detail.html"
        });
    } ]);
})();

(function() {
    angular.module("PlantsApp").controller("ScrollerCtrl", [ "$scope", "$ionicModal", ScrollerCtrl ]);
    function ScrollerCtrl($scope, $ionicModal) {
        var modal;
        var modalIsConstructed = false;
        $ionicModal.fromTemplateUrl("app/components/photo/scrollerPopover.html", {
            scope: $scope,
            animation: "slide-in-up"
        }).then(function(result) {
            modal = result;
        });
        $scope.showImage = function(index) {
            if (modal) {
                if (modalIsConstructed) $scope.slide = index;
                modal.show().then(function() {
                    $scope.slide = index;
                    modalIsConstructed = true;
                });
            }
        };
        $scope.hideModal = function() {
            if (modal) modal.hide();
        };
        $scope.$on("$destroy", function() {
            if (modal) modal.remove();
        });
    }
})();

(function() {
    angular.module("PlantsApp").controller("PlantDetailCtrl", [ "$scope", "$stateParams", "plantList", "flickr", PlantDetailCtrl ]);
    function PlantDetailCtrl($scope, $stateParams, plantList, flickr) {
        var plantId = $stateParams.id;
        $scope.getPhotoUrl = flickr.getPhotoUrl;
        plantList.getPlant(plantId).then(function(plant) {
            console.log(plant);
            if (plantList.isUnknown(plant)) {
                $scope.unknown = plant;
                $scope.plant = plant.idPlant;
            } else $scope.plant = plant;
            $scope.photos = [ "//c1.staticflickr.com/5/4002/4678501836_bb93ceb85f_n.jpg", "//c2.staticflickr.com/6/5599/15441200271_5f2cb4fcda_n.jpg", "//c4.staticflickr.com/4/3205/3094830857_e4c0293447_m.jpg" ];
        });
    }
})();

(function() {
    angular.module("PlantsApp").controller("PlantListCtrl", [ "$scope", "$stateParams", "$ionicLoading", "plantList", PlantListCtrl ]);
    function PlantListCtrl($scope, $stateParams, $ionicLoading, plantList) {
        if (plantList.isLoading()) $ionicLoading.show({
            template: "Initializing Plant List..."
        });
        $scope.genusSuffix = function(plant) {
            if (plant.code.lastIndexOf("SPP") == plant.code.length - 3) return " spp. (lump)"; else if (plant.scientific && plant.scientific == plant.genus) return " sp."; else return "";
        };
        $scope.plantFilter = function(query) {
            if (!query) return function() {
                return true;
            };
            query = query.toLowerCase();
            return function(plant) {
                function matches(val) {
                    return val && val.toLowerCase().indexOf(query) !== -1;
                }
                if (matches(plant.code) || matches(plant.scientific) || matches(plant.common) || matches(plant.idCode) || matches(plant.idScientific) || matches(plant.name)) return true;
                if (plant.synonyms) {
                    return plant.synonyms.some(function(syn) {
                        return matches(syn.code) || matches(syn.scientific);
                    });
                }
                return false;
            };
        };
        var listId = $stateParams.id || plantList.ALL_PLANTS;
        $scope.listName = plantList.getListName(listId);
        plantList.getPlants(listId).then(function(list) {
            console.log(list);
            $scope.plants = list;
            $ionicLoading.hide();
        });
    }
})();

(function() {
    angular.module("PlantsApp").factory("flickr", [ "$http", "config", PhotoService ]);
    function PhotoService($http, config) {
        var self = {
            THUMB: "t",
            SMALL: "m",
            MEDIUM: "z",
            LARGE: "b",
            getServiceUrl: function(service) {
                return "https://www.flickr.com/services/rest/?method=" + service;
            },
            query: function(searchTerm, callback) {
                config.load(function() {
                    var url = self.getServiceUrl("flickr.photos.search") + "&sort=relevance" + "&per_page=10" + "&format=json" + "&text=" + searchTerm + "&api_key=" + config.get("flickr_api_key");
                    return $http.jsonp(url + "&jsoncallback=JSON_CALLBACK").success(callback);
                });
            },
            getPhotos: function(data) {
                return data.stat != "ok" ? [] : data.photos.photo;
            },
            getPhotoUrl: function(photo, size) {
                return "https://farm" + photo.farm + ".staticflickr.com/" + photo.server + "/" + photo.id + "_" + photo.secret + "_" + (size || self.THUMB) + ".jpg";
            }
        };
        return self;
    }
})();

(function() {
    angular.module("PlantsApp").factory("plantList", [ "$http", "$q", "pouchDB", plantListService ]);
    function plantListService($http, $q, pouchDB) {
        var dbPromise = plantsDB();
        var dbIsLoading = true;
        function plantsDB() {
            var db = pouchDB("plants");
            function loadData(checkId, startkey, endkey, jsonFile) {
                return db.get(checkId).catch(function(err) {
                    if (err.status !== 404) throw err;
                    console.log("updating db with " + jsonFile);
                    return $http.get(jsonFile).then(function(result) {
                        return db.allDocs({
                            startkey: startkey,
                            endkey: endkey
                        }).then(function(allDocs) {
                            var existing = {};
                            angular.forEach(allDocs.rows, function(row) {
                                existing[row.id] = row.value.rev;
                            });
                            angular.forEach(result.data, function(row) {
                                var rev = existing[row._id];
                                if (rev) row._rev = rev;
                            });
                            return db.bulkDocs(result.data);
                        });
                    }).catch(function(err) {
                        console.log("Error fetching " + jsonFile, err);
                    });
                });
            }
            return $q.all([ loadData("VIRO3", "A", "ZZZZ", "assets/json/all_plants.json"), loadData("list-plant:2014 TALL Diversity/TALL_001/Subplot 31/TALL_001 31.1.10:VIRO3", "list-plant:2014 TALL Diversity", "list-plant:2014 TALL Diversity￿", "assets/json/div_lists.json"), loadData("unk:2015:TALL:603", "unk:2015:TALL:", "unk:2015:TALL:￿", "assets/json/TALL_unknowns.json") ]).then(function() {
                dbIsLoading = false;
                return db;
            });
        }
        function withDB(func) {
            return function() {
                var originalArgs = Array.prototype.slice.call(arguments);
                return dbPromise.then(function(db) {
                    return func.apply(func, [ db ].concat(originalArgs));
                });
            };
        }
        var self = {
            ALL_PLANTS: "All Plants",
            listMap: {},
            isLoading: function() {
                return dbIsLoading;
            },
            isUnknown: function(plant) {
                return (typeof plant === "object" ? plant._id : plant).substr(0, 3) == "unk";
            },
            getPlant: withDB(function(db, code) {
                return db.get(code).then(function(plant) {
                    if (!self.isUnknown(plant)) return plant;
                    return db.allDocs({
                        keys: plant.synonyms || [],
                        include_docs: true
                    }).then(function(result) {
                        angular.forEach(result.rows, function(row, i) {
                            if (row.doc) {
                                plant.synonyms[i] = row.doc;
                                if (!plant.idCode && row.doc.idCode) plant.idCode = row.doc.idCode;
                            }
                        });
                        return plant;
                    }).then(function(plant) {
                        if (!plant.idCode) return plant;
                        return db.get(plant.idCode).catch(function() {
                            return;
                        }).then(function(result) {
                            plant.idPlant = result;
                            return plant;
                        });
                    });
                });
            }),
            getListName: function(listId) {
                if (listId == self.ALL_PLANTS) return listId;
                return listId.substr(listId.lastIndexOf("/") + 1);
            },
            getLists: withDB(function(db) {
                console.log("getLists start", new Date());
                return db.allDocs({
                    startkey: "A",
                    endkey: "ZZZZ"
                }).then(function(result) {
                    console.log("getLists got ALL_PLANTS", new Date());
                    return [ {
                        id: self.ALL_PLANTS,
                        name: self.ALL_PLANTS,
                        parent: null,
                        children: [],
                        count: result.rows.length
                    } ];
                }).then(function(lists) {
                    return db.allDocs({
                        startkey: "list-plant:",
                        endkey: "list-plant:￿"
                    }).then(function(result) {
                        console.log("getLists got list-plants", new Date());
                        self.listMap = {};
                        function addListPlant(id) {
                            var idSplit = id.split(":");
                            var listId = idSplit[1];
                            var plantId = idSplit[2];
                            var list = self.listMap[listId] || addList(listId);
                            while (list) {
                                if (!list.plantsMap[plantId]) {
                                    list.plantsMap[plantId] = true;
                                    list.plants.push(plantId);
                                    ++list.count;
                                }
                                list = list.parent;
                            }
                        }
                        function addList(id) {
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
                            if (list.parent) {
                                var parent = self.listMap[list.parent] || addList(list.parent);
                                list.parent = parent;
                                parent.children.push(list);
                            }
                            if (!list.parent) lists.push(list);
                            return list;
                        }
                        angular.forEach(result.rows, function(row) {
                            addListPlant(row.key);
                        });
                        console.log("getLists list-plants done", new Date());
                        return lists;
                    });
                }).then(function(lists) {
                    return db.allDocs({
                        startkey: "unk:",
                        endkey: "unk:￿"
                    }).then(function(result) {
                        console.log("getLists got unknowns", new Date());
                        function addUnknown(id) {
                            var unk = id.split(":");
                            var year = unk[1];
                            var site = unk[2];
                            var listName = "Unknowns" + " " + year + " " + site;
                            var listId = "unk:" + year + ":" + site;
                            var list = self.listMap[listId] || {
                                id: listId,
                                name: listName,
                                parent: null,
                                children: [],
                                plants: [],
                                count: 0
                            };
                            if (!self.listMap[list.id]) {
                                self.listMap[list.id] = list;
                                lists.push(list);
                            }
                            list.count += 1;
                            list.plants.push(id);
                        }
                        angular.forEach(result.rows, function(row) {
                            addUnknown(row.key);
                        });
                        console.log("getLists unknowns done", new Date());
                        return lists;
                    });
                });
            }),
            getPlants: withDB(function(db, id) {
                var options;
                function getDocs(rows) {
                    return rows.map(function(row) {
                        return row.doc || {
                            code: row.key,
                            scientific: row.key,
                            common: "unknown"
                        };
                    });
                }
                if (id == self.ALL_PLANTS || id === undefined) {
                    options = {
                        startkey: "A",
                        endkey: "Z￿",
                        include_docs: true
                    };
                    console.log("getPlants: allDocs", options);
                    return db.allDocs(options).then(function(result) {
                        console.log("getPlants: result", result);
                        return getDocs(result.rows);
                    });
                } else if (self.listMap[id]) {
                    return db.allDocs({
                        keys: self.listMap[id].plants,
                        include_docs: true
                    }).then(function(result) {
                        console.log("getPlants: from computed list", result);
                        return getDocs(result.rows);
                    });
                }
                if (!self.isUnknown(id)) id = "list-plant:" + id;
                options = {
                    startkey: id + "/",
                    endkey: id + "/￿"
                };
                console.log("getPlants: allDocs", options);
                return db.allDocs(options).then(function(pathResult) {
                    options = {
                        startkey: id + ":",
                        endkey: id + ":￿"
                    };
                    console.log("getPlants: allDocs", options);
                    return db.allDocs(options).then(function(keyResult) {
                        return pathResult.rows.concat(keyResult.rows);
                    });
                }).then(function(rows) {
                    var plantIds = [];
                    var idMap = {};
                    angular.forEach(rows, function(row) {
                        var idSplit = row.key.split(":");
                        var plantId = idSplit[2];
                        if (self.isUnknown(row.key)) plantId = idSplit.join(":");
                        if (!idMap[plantId]) {
                            idMap[plantId] = true;
                            plantIds.push(plantId);
                        }
                    });
                    return db.allDocs({
                        keys: plantIds,
                        include_docs: true
                    }).then(function(result) {
                        console.log("getPlants: result", result);
                        return getDocs(result.rows);
                    });
                });
            })
        };
        return self;
    }
})();

(function() {
    angular.module("PlantsApp").controller("MainMenuCtrl", [ "$scope", "plantList", MainMenuCtrl ]);
    function MainMenuCtrl($scope, plantList) {
        var shown = {};
        $scope.toggleChildren = function(list) {
            shown[list.id] = !shown[list.id];
        };
        $scope.areChildrenShown = function(list) {
            return shown[list.id];
        };
        plantList.getLists().then(function(result) {
            console.log("Lists", result);
            $scope.plantLists = result;
        });
    }
})();

(function() {
    angular.module("PlantsApp").factory("config", [ "storage", ConfigService ]);
    function ConfigService(storage) {
        var self = {
            get: function(key) {
                return storage.get("config-" + key);
            },
            set: function(key, value) {
                storage.set("config-" + key, value);
            },
            hasConfig: function() {
                return self.get("version") != null;
            },
            load: function(callback) {
                if (self.hasConfig()) callback(self); else self.update(callback);
            },
            update: function(callback) {
                callback(self);
            }
        };
        return self;
    }
})();

(function() {
    PouchDB.plugin({
        putIfNotExists: function(doc, options) {
            return this.put(doc, options).catch(function(err) {
                if (err.status != 409) throw err;
                return doc;
            });
        },
        createViewDoc: function(name, mapFunction, reduceFunction) {
            var ddoc = {
                _id: "_design/" + name,
                views: {}
            };
            ddoc.views[name] = {
                map: mapFunction.toString()
            };
            if (reduceFunction) ddoc.views[name].reduce = reduceFunction.toString();
            return ddoc;
        },
        upsertView: function(name, mapFunction, reduceFunction) {
            var db = this;
            var doc = db.createViewDoc(name, mapFunction, reduceFunction);
            return db.get(doc._id).then(function(result) {
                if (result.views[name].map != doc.views[name].map || result.views[name].reduce != doc.views[name].reduce) {
                    doc._rev = result._rev;
                    return db.put(doc);
                }
                return result;
            }).catch(function(err) {
                if (err.status === 404) return db.put(doc);
                throw err;
            });
        }
    });
})();

(function() {
    angular.module("PlantsApp").factory("storage", [ "$q", StorageService ]);
    function StorageService($q) {
        var self = {
            _data: {},
            get: function(key, fallback) {
                return self._data[key] || (self._data[key] = JSON.parse(localStorage.getItem(key)) || fallback);
            },
            set: function(key, value) {
                self._data[key] = value;
                localStorage.setItem(key, JSON.stringify(value));
            },
            getPromise: function(key, fallback) {
                return $q(function(resolve) {
                    resolve(self.get(key, fallback));
                });
            }
        };
        return self;
    }
})();

angular.module("PlantsApp").run([ "$templateCache", function($templateCache) {
    "use strict";
    $templateCache.put("app/components/photo/scroller.html", '<ion-scroll direction=x style=white-space:nowrap has-bouncing=true ng-controller=ScrollerCtrl><img ng-repeat="image in images track by $index" ng-src={{image}} class=padding style=max-height:100px ng-click=showImage($index)></ion-scroll>');
    $templateCache.put("app/components/photo/scrollerPopover.html", '<ion-modal-view class=photo-gallery><ion-slide-box show-pager=false active-slide=slide><ion-slide ng-repeat="image in images" ng-click=hideModal()><img ng-src={{image}} ng-click=$event.stopPropagation();></ion-slide></ion-slide-box></ion-modal-view>');
    $templateCache.put("app/components/plant/detail.html", '<ion-view><ion-nav-title>{{ unknown.name || plant.scientific }}</ion-nav-title><ion-content><div ng-show=unknown><h2>{{ unknown.name }}</h2><div class=row><div class=col-33>Code</div><div class=col>{{ unknown.code }}{{ unknown.idCode ? \' (\' + unknown.idCode + \')\': \'\'}}</div></div><div class=row><div class=col-33>Collected</div><div class=col>{{ unknown.collectedDate }} {{ unknown.collector }}</div></div><div class=row><div class=col-33>Plot</div><div class=col>{{ unknown.plot }}</div></div><div class=row><div class=col-33>Habitat</div><div class=col>{{ unknown.habitat }}</div></div><div class=row><div class=col-33>Description</div><div class=col>{{ unknown.description }}</div></div><h3 ng-show="unknown.synonyms.length > 0">Synonyms</h3><div class=row ng-repeat="synonym in unknown.synonyms"><a class=col-25 ui-sref=detail({id:synonym._id})>{{ synonym.code }}</a><div class="col scientific">{{ synonym.name }}</div></div></div><div ng-show=plant><h2>{{ plant.scientific }}</h2><h3>{{ plant.common }}</h3><a href="http://plants.usda.gov/core/profile?symbol={{ plant.code }}">USDA</a><div class=plant-detail><div class=row><div class=col>Code</div><div class=col>{{ plant.code }}</div></div><div class=row><div class=col>Family</div><div class=col>{{ plant.family }} ({{ plant.familyCommon }})</div></div><div class=row><div class=col>Growth Form</div><div class=col>{{ plant.growth.join(\', \') }}</div></div></div><h3 ng-show="plant.synonyms.length > 0">Synonyms</h3><div class=row ng-repeat="synonym in plant.synonyms"><div class=col-25>{{ synonym.code }}</div><div class="col scientific">{{ synonym.scientific }}</div></div><div class=plant-thumb><img src="{{ thumbnail }}"><div class=thumb-caption>{{ caption }}</div></div></div><pl-gallery images=photos></pl-gallery></ion-content></ion-view>');
    $templateCache.put("app/components/plant/list.html", '<ion-view><ion-nav-title>{{ listName }}</ion-nav-title><ion-header-bar align-title=left class="bar-subheader bar-clear item-input-inset"><label class=item-input-wrapper><i class="icon ion-ios-search placeholder-icon"></i> <input type=search placeholder=Search ng-model=searchText> <button class="button ion-android-close button-dark button-clear" ng-show=searchText on-tap="searchText=\'\'"></button></label></ion-header-bar><ion-content><ion-list class=plant-list><ion-item collection-repeat="plant in plants | filter:plantFilter(searchText) | orderBy:\'scientific || code\'" ui-sref=detail({id:plant._id}) ng-class="(plant.idYear || plant.idCode) ? \'id-\' + (plant.idYear || 2015) : \'\'"><div class=col-code><div>{{ plant.code }}</div><div>{{ plant.idCode }}</div></div><div class=col-name><div ng-class="plant.scientific ? \'scientific\' : \'common\'">{{ plant.scientific || plant.name }}{{ genusSuffix(plant) }}</div><div ng-class="plant.scientific ? \'common\' : \'scientific\'">{{ plant.common || plant.idScientific }}</div></div><div class=col-growth><div ng-repeat="form in plant.growth" ng-class="\'growth-\' + form.toLowerCase().split(\'/\')[0]">{{ form == "Fern" ? "Fn" : form[0] }}</div></div></ion-item></ion-list></ion-content></ion-view>');
    $templateCache.put("app/menus/list_item.html", "<ion-item ng-click><a ng-style=\"{'padding-left':(16 * (list.depth = 1 + (list.parent.depth || 0))) +  'px'}\" ng-click=toggleChildren(list)><i class=expand-collapse ng-class=\"areChildrenShown(list) ? 'ion-arrow-down-b' : 'ion-arrow-right-b'\" ng-show=\"list.children.length > 0\"></i></a> <span ui-sref=list({id:list.id}) menu-close>{{ list.name }} ({{ list.count }})</span></ion-item><div ng-show=areChildrenShown(list)><div ng-repeat=\"list in list.children\" ng-include=\"'app/menus/list_item.html'\"></div></div>");
    $templateCache.put("app/menus/main.html", '<ion-header-bar class="bar bar-header bar-balanced"><h1 class=title>Plant Lists</h1></ion-header-bar><ion-content has-header=true ng-controller=MainMenuCtrl><ion-list><div ng-repeat="list in plantLists" ng-include="\'app/menus/list_item.html\'"></div></ion-list></ion-content>');
} ]);