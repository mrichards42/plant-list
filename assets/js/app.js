angular.module("PlantsApp", [ "ionic", "ui.router", "pouchdb" ]).directive("plantMainMenu", function() {
    return {
        restrict: "E",
        templateUrl: "app/menus/main.html"
    };
});

(function() {
    angular.module("PlantsApp").config([ "$stateProvider", "$urlRouterProvider", function config($stateProvider, $urlRouterProvider) {
        $urlRouterProvider.when("", "/list");
        $urlRouterProvider.when("/", "/list");
        $urlRouterProvider.when("/list", "/list/");
        $stateProvider.state("config", {
            url: "/config",
            controller: "ConfigCtrl",
            templateUrl: "app/components/config/config.html"
        });
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
    angular.module("PlantsApp").controller("ConfigCtrl", [ "$scope", "$ionicPopup", "config", ConfigCtrl ]);
    function ConfigCtrl($scope, $ionicPopup, config) {
        var cfg = config.load();
        function remoteDb() {
            return new PouchDB("https://" + cfg.database + ".cloudant.com/plants", {
                skipSetup: true
            });
        }
        function login() {
            var db = remoteDb();
            function tokenLogin(token) {
                token = token || cfg.token || [ "", "" ];
                return db.login(token[0], token[1]).then(function(result) {
                    cfg.token = token;
                    console.log("successfully logged in with token", token);
                    return result;
                });
            }
            return tokenLogin().catch(function(err) {
                if (err.status !== 403 && err.status !== 400) throw err;
                return db.login(cfg.username, cfg.password).then(function(result) {
                    console.log(result);
                    var token = [ PouchDB.utils.uuid(), PouchDB.utils.uuid() ];
                    return db.signup(token[0], token[1]).then(function() {
                        return tokenLogin(token);
                    });
                });
            });
        }
        $scope.config = cfg;
        $scope.login = function() {
            cfg.database = cfg.username;
            login().then(function() {
                cfg.password = "";
                cfg.save();
                cfg.isLoggedIn = true;
                $scope.$apply();
            }).catch(function(err) {
                console.log(err);
                $ionicPopup.alert({
                    title: "Could not log in",
                    template: "Check username and password"
                });
            });
        };
        $scope.logout = function() {
            cfg.password = "";
            if (!cfg.saveUsername) cfg.username = "";
            remoteDb().logout().then(console.log.bind(console));
            cfg.save();
            cfg.isLoggedIn = false;
        };
    }
})();

(function() {
    angular.module("PlantsApp").factory("config", ConfigService);
    function ConfigService() {
        var KEY = "plants-config";
        function ConfigObject() {
            try {
                angular.copy(JSON.parse(localStorage.getItem(KEY)), this);
            } catch (err) {
                console.log("config error");
            }
        }
        ConfigObject.prototype.save = function() {
            localStorage.setItem(KEY, JSON.stringify(this));
        };
        return {
            load: function() {
                return new ConfigObject();
            }
        };
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
            flickr.query(plant.scientific, function(data) {
                console.log("photo queried", data);
                var photos = flickr.getPhotos(data);
                $scope.photos = photos;
                if (photos.length > 0) {
                    $scope.thumbnail = flickr.getPhotoUrl(photos[0], flickr.SMALL);
                    $scope.caption = photos[0].title;
                }
            });
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
            return $q.all([ db.get("VIRO3").catch(function(err) {
                if (err.status !== 404) throw err;
                return $http.get("assets/json/all_plants.json").then(function(result) {
                    return result.data.map(function(row) {
                        row._id = row.code;
                        return row;
                    });
                }).catch(function(err) {
                    console.log("Error fetching all_plants.json", err);
                }).then(function(rows) {
                    console.log("plants", rows);
                    return db.bulkDocs(rows);
                });
            }), db.get("list-plant:2014 TALL Diversity/TALL_001/Subplot 31/TALL_001 31.1.10:VIRO3").catch(function(err) {
                if (err.status !== 404) throw err;
                return $http.get("assets/json/div_lists.json").then(function(result) {
                    console.log("list-plants", result);
                    return db.bulkDocs(result.data);
                }).catch(function(err) {
                    console.log("Error fetching div_lists.json", err);
                });
            }), db.get("unk:2015:TALL:001").catch(function(err) {
                if (err.status !== 404) throw err;
                return $http.get("assets/json/TALL_unknowns.json").then(function(result) {
                    console.log("unknowns", result);
                    return db.bulkDocs(result.data);
                }).catch(function(err) {
                    console.log("Error fetching TALL_unknowns.json", err);
                });
            }) ]).then(function() {
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
    angular.module("PlantsApp").run([ "$q", function($q) {
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
            upsert: function(doc, equalsFunction) {
                var db = this;
                equalsFunction = equalsFunction || angular.equals;
                return db.get(doc._id).then(function(result) {
                    doc._rev = result.rev;
                    if (!equalsFunction(doc, result)) return db.put(doc); else return result;
                }).catch(function(err) {
                    if (err.status === 404) return db.put(doc);
                    throw err;
                });
            },
            upsertView: function(name, mapFunction, reduceFunction) {
                var db = this;
                var doc = db.createViewDoc(name, mapFunction, reduceFunction);
                return db.upsert(doc, function(a, b) {
                    return a.views[name].map === b.views[name].map && a.views[name].reduce === b.views[name].reduce;
                });
            },
            openDB: function(name) {
                return new PouchDB(name ? getUrl(this, name) : this.getUrl());
            }
        });
        PouchDB.plugin({
            getSecurity: function() {
                return this.request({
                    url: "_security"
                });
            },
            putSecurity: function(doc) {
                return this.request({
                    url: "_security",
                    body: doc,
                    method: "PUT"
                });
            }
        });
        function getUrl(db, path) {
            var host = db.getHost(db.getUrl());
            return host.protocol + "://" + host.host + "/" + (path || "");
        }
        function isCloudant(db) {
            return db.getUrl().match(/\.cloudant\.com/);
        }
        var pouchLogin = PouchDB.prototype.login;
        var pouchSignup = PouchDB.prototype.signup;
        PouchDB.plugin({
            login: function(username, password, opts, callback) {
                opts = opts || {};
                if (isCloudant(this)) {
                    opts.ajax = angular.extend({
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: "name=" + encodeURIComponent(username) + "&password=" + encodeURIComponent(password)
                    }, opts.ajax || {});
                }
                var args = [ username, password, opts ];
                if (callback) args.push(callback);
                return pouchLogin.apply(this, args);
            },
            signup: function(username, password, opts, callback) {
                opts = opts || {};
                opts.roles = opts.roles || [ "user" ];
                if (isCloudant(this)) {
                    var salt = PouchDB.utils.uuid();
                    var hash = CryptoJS.SHA1(password + salt).toString();
                    opts.metadata = opts.metadata || {};
                    opts.metadata.password_sha = hash;
                    opts.metadata.salt = salt;
                    opts.metadata.password_scheme = "simple";
                    opts.metadata.password = "";
                    opts.metadata.useragent = navigator.userAgent;
                    opts.metadata.created = new Date().toString();
                }
                var args = [ username, password, opts ];
                if (callback) args.push(callback);
                return pouchSignup.apply(this, args);
            },
            setupSecurity: function(dbList, securityDoc) {
                var db = this;
                dbList = dbList || [ db.getHost(db.getUrl()).db ];
                securityDoc = securityDoc || {
                    couchdb_auth_only: true,
                    members: {
                        names: [],
                        roles: [ "user" ]
                    },
                    admins: {}
                };
                var usersDb = new PouchDB(getUrl(db, "_users"));
                return $q.all(dbList.map(function(name) {
                    return db.openDB(name).putSecurity(securityDoc);
                }));
            }
        });
    } ]);
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
    $templateCache.put("app/components/config/config.html", '<ion-view view-title=Config><ion-content><div ng-hide=config.isLoggedIn><form name=loginForm ng-submit=login()><div class=list><label class="item item-input"><input type=text ng-model=config.username placeholder=Username required></label><label class="item item-input"><input type=password ng-model=config.password placeholder=Password required></label><ion-checkbox class="item item-input" ng-model=config.saveUsername>Save Username</ion-checkbox></div></form></div><div><div ng-show=config.isLoggedIn class=padding>Signed in as <strong>{{ config.username }}</strong> <button class="button button-block button-positive" ng-click=logout()>Sign Out</button></div><div ng-hide=config.isLoggedIn class=padding><button class="button button-block button-positive" ng-click=login() ng-disabled=loginForm.$invalid>Sign In</button></div></div></ion-content></ion-view>');
    $templateCache.put("app/components/plant/detail.html", '<ion-view><ion-nav-title>{{ unknown.name || plant.scientific }}</ion-nav-title><ion-content><div ng-show=unknown><h2>{{ unknown.name }}</h2><div class=row><div class=col-33>Code</div><div class=col>{{ unknown.code }}{{ unknown.idCode ? \' (\' + unknown.idCode + \')\': \'\'}}</div></div><div class=row><div class=col-33>Collected</div><div class=col>{{ unknown.collectedDate }} {{ unknown.collector }}</div></div><div class=row><div class=col-33>Plot</div><div class=col>{{ unknown.plot }}</div></div><div class=row><div class=col-33>Habitat</div><div class=col>{{ unknown.habitat }}</div></div><div class=row><div class=col-33>Description</div><div class=col>{{ unknown.description }}</div></div><h3 ng-show="unknown.synonyms.length > 0">Synonyms</h3><div class=row ng-repeat="synonym in unknown.synonyms"><a class=col-25 ui-sref=detail({id:synonym._id})>{{ synonym.code }}</a><div class="col scientific">{{ synonym.name }}</div></div></div><div ng-show=plant><h2>{{ plant.scientific }}</h2><h3>{{ plant.common }}</h3><a href="http://plants.usda.gov/core/profile?symbol={{ plant.code }}">USDA</a><div class=plant-detail><div class=row><div class=col>Code</div><div class=col>{{ plant.code }}</div></div><div class=row><div class=col>Family</div><div class=col>{{ plant.family }} ({{ plant.familyCommon }})</div></div><div class=row><div class=col>Growth Form</div><div class=col>{{ plant.growth.join(\', \') }}</div></div></div><h3 ng-show="plant.synonyms.length > 0">Synonyms</h3><div class=row ng-repeat="synonym in plant.synonyms"><div class=col-25>{{ synonym.code }}</div><div class="col scientific">{{ synonym.scientific }}</div></div><div class=plant-thumb><img src="{{ thumbnail }}"><div class=thumb-caption>{{ caption }}</div></div></div></ion-content></ion-view>');
    $templateCache.put("app/components/plant/list.html", '<ion-view><ion-nav-title>{{ listName }}</ion-nav-title><ion-header-bar align-title=left class="bar-subheader bar-clear item-input-inset"><label class=item-input-wrapper><i class="icon ion-ios-search placeholder-icon"></i> <input type=search placeholder=Search ng-model=searchText> <button class="button ion-android-close button-dark button-clear" ng-show=searchText on-tap="searchText=\'\'"></button></label></ion-header-bar><ion-content><ion-list class=plant-list><ion-item collection-repeat="plant in plants | filter:plantFilter(searchText) | orderBy:\'scientific || code\'" ui-sref=detail({id:plant._id}) ng-class="(plant.idYear || plant.idCode) ? \'id-\' + (plant.idYear || 2015) : \'\'"><div class=col-code><div>{{ plant.code }}</div><div>{{ plant.idCode }}</div></div><div class=col-name><div ng-class="plant.scientific ? \'scientific\' : \'common\'">{{ plant.scientific || plant.name }}{{ genusSuffix(plant) }}</div><div ng-class="plant.scientific ? \'common\' : \'scientific\'">{{ plant.common || plant.idScientific }}</div></div><div class=col-growth><div ng-repeat="form in plant.growth" ng-class="\'growth-\' + form.toLowerCase().split(\'/\')[0]">{{ form == "Fern" ? "Fn" : form[0] }}</div></div></ion-item></ion-list></ion-content></ion-view>');
    $templateCache.put("app/menus/list_item.html", "<ion-item ng-click><a ng-style=\"{'padding-left':(16 * (list.depth = 1 + (list.parent.depth || 0))) +  'px'}\" ng-click=toggleChildren(list)><i class=expand-collapse ng-class=\"areChildrenShown(list) ? 'ion-arrow-down-b' : 'ion-arrow-right-b'\" ng-show=\"list.children.length > 0\"></i></a> <span ui-sref=list({id:list.id}) menu-close>{{ list.name }} ({{ list.count }})</span></ion-item><div ng-show=areChildrenShown(list)><div ng-repeat=\"list in list.children\" ng-include=\"'app/menus/list_item.html'\"></div></div>");
    $templateCache.put("app/menus/main.html", '<ion-header-bar class="bar bar-header bar-balanced"><h1 class=title>Plant Lists</h1></ion-header-bar><ion-content has-header=true ng-controller=MainMenuCtrl><ion-list><div ng-repeat="list in plantLists" ng-include="\'app/menus/list_item.html\'"></div></ion-list></ion-content>');
} ]);