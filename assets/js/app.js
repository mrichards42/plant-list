angular.module("PlantsApp", [ "ionic", "ui.router", "pouchdb" ]).directive("plantMainMenu", function() {
    return {
        restrict: "E",
        templateUrl: "app/menus/main.html"
    };
}).directive("syncButton", function() {
    return {
        restrict: "E",
        templateUrl: "app/components/sync/sync.html"
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
    angular.module("PlantsApp").controller("ConfigCtrl", [ "$scope", "$ionicPopup", "config", "pouchDB", "plantList", ConfigCtrl ]);
    function ConfigCtrl($scope, $ionicPopup, config, pouchDB, plantList) {
        var cfg = config.load();
        function getRemoteUrl() {
            return "https://" + cfg.database + ".cloudant.com/plants";
        }
        $scope.config = cfg;
        $scope.login = function() {
            cfg.database = cfg.username;
            pouchDB.openRemote({
                url: getRemoteUrl(),
                username: cfg.username,
                password: cfg.password
            }).then(function(db) {
                plantList.sync(db).then(console.log.bind(console)).catch(console.log.bind(console));
                if (!cfg.saveUsername) cfg.username = "";
                cfg.password = "";
                cfg.isLoggedIn = true;
                cfg.save();
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
            pouchDB.openRemote(getRemoteUrl(), {
                skipSetup: true
            }).logout();
            cfg.isLoggedIn = false;
            cfg.save();
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
    angular.module("PlantsApp").controller("PlantListCtrl", [ "$scope", "$stateParams", "plantList", PlantListCtrl ]);
    function PlantListCtrl($scope, $stateParams, plantList) {
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
            console.log("$scope.plants", list);
            $scope.plants = list;
            console.log("$scope.plants done");
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
    angular.module("PlantsApp").factory("plantList", [ "$q", "pouchDB", "pouchReplicate", plantListService ]);
    function plantListService($q, pouchDB, pouchReplicate) {
        var db = pouchDB("plants");
        var self = {
            ALL_PLANTS: "All Plants",
            isUnknown: function(plant) {
                return (typeof plant === "object" ? plant._id : plant).substr(0, 3) == "unk";
            },
            getPlant: function(code) {
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
            },
            getListName: function(listId) {
                if (listId == self.ALL_PLANTS) return listId;
                return listId.substr(listId.lastIndexOf("/") + 1);
            },
            getLists: function() {
                return localDocMemoize("lists", buildLists)().then(function(data) {
                    data.lists.map = data.map;
                    return data.lists;
                });
            },
            getPlants: function(id) {
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
                    console.log("getPlants: allDocs", options, new Date());
                    return db.allDocs(options).then(function(result) {
                        console.log("getPlants: result", result, new Date());
                        return getDocs(result.rows);
                    });
                }
                return self.getLists().then(function(lists) {
                    return db.allDocs({
                        keys: lists.map[id].plants,
                        include_docs: true
                    }).then(function(result) {
                        console.log("getPlants: from computed list", result);
                        return getDocs(result.rows);
                    });
                });
            },
            sync: function(remoteDb) {
                return $q.when(remoteDb || pouchDB.openRemote("plants")).then(function(remoteDb) {
                    return pouchReplicate(remoteDb, db);
                });
            }
        };
        function localDocMemoize(cacheId, dataFunc) {
            cacheId = "_local/" + cacheId;
            return function() {
                var args = arguments;
                return db.get(cacheId).catch(function(err) {
                    if (err.status !== 404) throw err;
                    return {
                        _id: cacheId,
                        update_seq: 0
                    };
                }).then(function(cache) {
                    return db.info().then(function(info) {
                        if (cache.update_seq === info.update_seq) {
                            console.log("Using memoized data from " + cacheId);
                            return cache.data;
                        }
                        return dataFunc(args).then(function(data) {
                            return db.upsert(cacheId, function(doc) {
                                doc.data = data;
                                doc.update_seq = info.update_seq;
                                return doc;
                            }).then(function() {
                                console.log("data cached", data);
                                return data;
                            });
                        });
                    });
                }).catch(console.log.bind(console));
            };
        }
        function buildLists() {
            console.log("buildLists start", new Date());
            var lists = [];
            var listMap = {};
            function addListItems(rows, parseId) {
                function addPlant(id) {
                    var item = parseId(id);
                    var list = getList(item.list);
                    while (list) {
                        if (!list.plantsMap[item.plant]) {
                            list.plantsMap[item.plant] = true;
                            list.plants.push(item.plant);
                            ++list.count;
                        }
                        list = list.parent;
                    }
                }
                function getList(listId) {
                    if (listMap[listId]) return listMap[listId];
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
                    if (list.parent) {
                        var parent = getList(list.parent);
                        list.parent = parent;
                        parent.children.push(list);
                    }
                    if (!list.parent) lists.push(list);
                    return list;
                }
                angular.forEach(rows, function(row) {
                    addPlant(row.key);
                });
            }
            return db.allDocs({
                startkey: "A",
                endkey: "ZZZZ"
            }).then(function(result) {
                console.log("buildLists ALL_PLANTS start", new Date());
                lists.push({
                    id: self.ALL_PLANTS,
                    name: self.ALL_PLANTS,
                    parent: null,
                    children: [],
                    count: result.rows.length
                });
                console.log("buildLists ALL_PLANTS end", new Date());
            }).then(function() {
                return db.allDocs({
                    startkey: "list-plant:",
                    endkey: "list-plant:￿"
                }).then(function(result) {
                    console.log("getLists list-plants start", new Date());
                    addListItems(result.rows, function(id) {
                        var data = id.split(":");
                        return {
                            list: data[1],
                            plant: data[2]
                        };
                    });
                    console.log("getLists list-plants done", new Date());
                });
            }).then(function() {
                return db.allDocs({
                    startkey: "unk:",
                    endkey: "unk:￿"
                }).then(function(result) {
                    console.log("getLists unknowns start", new Date());
                    addListItems(result.rows, function(id) {
                        var data = id.split(":");
                        return {
                            list: [ "Unknowns", data[1], data[2] ].join(" "),
                            plant: id
                        };
                    });
                    console.log("getLists unknowns done", new Date());
                });
            }).then(function() {
                function compact(list) {
                    delete list.parent;
                    delete list.listMap;
                    angular.forEach(list.children, compact);
                }
                angular.forEach(lists, compact);
                return {
                    lists: lists,
                    map: listMap
                };
            });
        }
        self.sync();
        return self;
    }
})();

(function() {
    angular.module("PlantsApp").factory("pouchReplicate", function() {
        function replicator(source, target, options) {
            sendEvent("start");
            ++running;
            return getDumpRev(target).then(function(targetRev) {
                return getDumpRev(source).then(function(sourceRev) {
                    console.log("Comparing pouchdb-dump revisions");
                    console.log("source", sourceRev, "target", targetRev);
                    return sourceRev > targetRev;
                });
            }).then(function(shouldUpdate) {
                console.log(shouldUpdate ? "Using pouchdb-dump" : "Skipping pouchdb-dump");
                if (!shouldUpdate) return;
                return source.get("_local/dump").then(function(dump) {
                    return target.load(dump.dump, {
                        proxy: source.getUrl()
                    }).then(function() {
                        return saveDumpRev(target, dump._rev);
                    });
                }).then(function() {
                    return target.info().then(function(info) {
                        updateInfo({
                            ok: true,
                            docs_read: info.doc_count,
                            docs_written: info.doc_count
                        });
                    });
                });
            }).then(function() {
                console.log("Starting replication");
                var rep = PouchDB.replicate(source, target, options);
                rep.on("complete", function(info) {
                    updateInfo(info);
                    onDone();
                }).on("error", function(err) {
                    errors.push(err);
                    onDone();
                });
                return rep;
            }).catch(function(err) {
                console.log(err);
            });
        }
        function getDumpRev(db) {
            return db.get("_local/dump-info").then(function(info) {
                return info.latest_rev;
            }).catch(function(err) {
                if (err.status !== 404) throw err;
                return "0";
            });
        }
        function saveDumpRev(db, rev) {
            return db.upsert("_local/dump-info", function(doc) {
                doc.latest_rev = rev;
                return doc;
            });
        }
        replicator.on = function(event, handler) {
            handlers[event] && handlers[event].push(handler);
            return replicator;
        };
        var handlers = {
            complete: [],
            error: [],
            start: []
        };
        function sendEvent(event) {
            var args = Array.prototype.slice.call(arguments, 1);
            angular.forEach(handlers[event], function(callback) {
                callback.apply(null, args);
            });
        }
        var running = 0;
        var errors = [];
        var infos = {};
        function updateInfo(i) {
            infos.ok = (infos.ok === undefined ? true : infos.ok) && (i.ok === undefined ? true : i.ok);
            infos.errors = (infos.errors || []).concat(i.errors || []);
            infos.last_seq = i.last_seq || 0;
            angular.forEach([ "doc_write_failures", "docs_read", "docs_written" ], function(key) {
                infos[key] = (infos[key] || 0) + (i[key] || 0);
            });
        }
        function onDone() {
            --running;
            if (running <= 0) {
                if (errors.length > 0) sendEvent("error", errors); else sendEvent("complete", infos);
                errors = [];
                infos = {};
            }
        }
        return replicator;
    });
})();

(function() {
    angular.module("PlantsApp").controller("SyncCtrl", [ "$scope", "$state", "$ionicPopup", "toast", "plantList", "pouchReplicate", SyncCtrl ]);
    function SyncCtrl($scope, $state, $ionicPopup, toast, plantList, pouchReplicate) {
        $scope.isSyncing = false;
        $scope.sync = function() {
            plantList.sync().catch(function(err) {
                if (err.name !== "authentication_error") throw err;
                $ionicPopup.confirm({
                    title: "Sync error",
                    template: "Please login to sync plants database",
                    okText: "Login"
                }).then(function() {
                    $state.go("config");
                });
            });
        };
        pouchReplicate.on("start", function() {
            $scope.isSyncing = true;
        }).on("complete", function(info) {
            $scope.isSyncing = false;
            if (info.docs_written && info.docs_read) toast.show("Updated " + info.docs_written + " of " + info.docs_read + " docs");
        }).on("error", function() {
            $scope.isSyncing = false;
            toast.show("Errors during sync");
        });
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
    angular.module("pouchdb").run([ "$q", "pouchDB", function($q, pouchDB) {
        PouchDB.plugin({
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
            },
            tokenLogin: function(username, password) {
                var db = this;
                var token = getToken(db) || [];
                return loginWithToken(db, token).catch(function(err) {
                    if (err.status !== 403 && err.status !== 400) throw err;
                    if (!username || !password) throw err;
                    return db.login(username, password).then(function(result) {
                        console.log(result);
                        var token = [ PouchDB.utils.uuid(), PouchDB.utils.uuid() ];
                        return db.signup(token[0], token[1]).then(function() {
                            return loginWithToken(db, token);
                        });
                    });
                });
            }
        });
        var TOKEN_KEY = "plantlist-token:";
        var REMOTE_KEY = "plantlist-remote:";
        function getHost(db) {
            return db.getHost(db.getUrl());
        }
        function getToken(db) {
            return JSON.parse(localStorage.getItem(TOKEN_KEY + getHost(db).host));
        }
        function saveToken(db, token) {
            var key = TOKEN_KEY + getHost(db).host;
            if (!token) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(token));
        }
        function loginWithToken(db, token) {
            return db.login(token[0], token[1]).then(function(result) {
                token[2] = db.getHost(db.getUrl()).host;
                saveToken(db, token);
                console.log("successfully logged in with token", token);
                return result;
            });
        }
        pouchDB.openRemote = function(name, opts) {
            if (typeof name === "object") {
                opts = name;
            } else {
                opts = opts || {};
                if (name.indexOf("://") !== -1) opts.url = name; else opts.name = name;
            }
            var url = opts.url || localStorage.getItem(REMOTE_KEY + opts.name);
            if (!url) {
                return $q.reject({
                    status: 400,
                    name: "bad_request",
                    reason: "Missing/invalid DB name",
                    error: true
                });
            }
            var db = pouchDB(url, {
                skipSetup: true
            });
            if (opts.skipSetup) return db;
            return db.tokenLogin(opts.username, opts.password).then(function() {
                localStorage.setItem(REMOTE_KEY + (opts.name || getHost(db).db), db.getUrl());
                return db;
            });
        };
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

(function() {
    angular.module("PlantsApp").factory("toast", [ "$ionicLoading", function($ionicLoading) {
        return {
            show: function(opts) {
                if (typeof opts === "string") opts = {
                    message: opts
                };
                var message = opts.message || "";
                return $ionicLoading.show(angular.extend(opts, {
                    noBackdrop: true,
                    duration: 2e3,
                    template: message
                }));
            },
            hide: $ionicLoading.hide
        };
    } ]);
})();

angular.module("PlantsApp").run([ "$templateCache", function($templateCache) {
    "use strict";
    $templateCache.put("app/components/config/config.html", '<ion-view view-title=Config><ion-content><div ng-hide=config.isLoggedIn><form name=loginForm ng-submit=login()><div class=list><label class="item item-input"><input type=text ng-model=config.username placeholder=Username required></label><label class="item item-input"><input type=password ng-model=config.password placeholder=Password required></label><ion-checkbox class="item item-input" ng-model=config.saveUsername>Save Username</ion-checkbox></div></form></div><div><div ng-show=config.isLoggedIn class=padding>Signed in as <strong>{{ config.username }}</strong> <button class="button button-block button-positive" ng-click=logout()>Sign Out</button></div><div ng-hide=config.isLoggedIn class=padding><button class="button button-block button-positive" ng-click=login() ng-disabled=loginForm.$invalid>Sign In</button></div></div></ion-content></ion-view>');
    $templateCache.put("app/components/plant/detail.html", '<ion-view><ion-nav-title>{{ unknown.name || plant.scientific }}</ion-nav-title><ion-content><div ng-show=unknown><h2>{{ unknown.name }}</h2><div class=row><div class=col-33>Code</div><div class=col>{{ unknown.code }}{{ unknown.idCode ? \' (\' + unknown.idCode + \')\': \'\'}}</div></div><div class=row><div class=col-33>Collected</div><div class=col>{{ unknown.collectedDate }} {{ unknown.collector }}</div></div><div class=row><div class=col-33>Plot</div><div class=col>{{ unknown.plot }}</div></div><div class=row><div class=col-33>Habitat</div><div class=col>{{ unknown.habitat }}</div></div><div class=row><div class=col-33>Description</div><div class=col>{{ unknown.description }}</div></div><h3 ng-show="unknown.synonyms.length > 0">Synonyms</h3><div class=row ng-repeat="synonym in unknown.synonyms"><a class=col-25 ui-sref=detail({id:synonym._id})>{{ synonym.code }}</a><div class="col scientific">{{ synonym.name }}</div></div></div><div ng-show=plant><h2>{{ plant.scientific }}</h2><h3>{{ plant.common }}</h3><a href="http://plants.usda.gov/core/profile?symbol={{ plant.code }}">USDA</a><div class=plant-detail><div class=row><div class=col>Code</div><div class=col>{{ plant.code }}</div></div><div class=row><div class=col>Family</div><div class=col>{{ plant.family }} ({{ plant.familyCommon }})</div></div><div class=row><div class=col>Growth Form</div><div class=col>{{ plant.growth.join(\', \') }}</div></div></div><h3 ng-show="plant.synonyms.length > 0">Synonyms</h3><div class=row ng-repeat="synonym in plant.synonyms"><div class=col-25>{{ synonym.code }}</div><div class="col scientific">{{ synonym.scientific }}</div></div><div class=plant-thumb><img src="{{ thumbnail }}"><div class=thumb-caption>{{ caption }}</div></div></div></ion-content></ion-view>');
    $templateCache.put("app/components/plant/list.html", '<ion-view><ion-nav-title>{{ listName }}</ion-nav-title><ion-header-bar align-title=left class="bar-subheader bar-clear item-input-inset"><label class=item-input-wrapper><i class="icon ion-ios-search placeholder-icon"></i> <input type=search placeholder=Search ng-model=searchText> <button class="button ion-android-close button-dark button-clear" ng-show=searchText on-tap="searchText=\'\'"></button></label></ion-header-bar><ion-content><ion-list class=plant-list><ion-item collection-repeat="plant in plants | filter:plantFilter(searchText) | orderBy:\'scientific || code\'" ui-sref=detail({id:plant._id}) ng-class="(plant.idYear || plant.idCode) ? \'id-\' + (plant.idYear || 2015) : \'\'"><div class=col-code><div>{{ plant.code }}</div><div>{{ plant.idCode }}</div></div><div class=col-name><div ng-class="plant.scientific ? \'scientific\' : \'common\'">{{ plant.scientific || plant.name }}{{ genusSuffix(plant) }}</div><div ng-class="plant.scientific ? \'common\' : \'scientific\'">{{ plant.common || plant.idScientific }}</div></div><div class=col-growth><div ng-repeat="form in plant.growth" ng-class="\'growth-\' + form.toLowerCase().split(\'/\')[0]">{{ form == "Fern" ? "Fn" : form[0] }}</div></div></ion-item></ion-list></ion-content></ion-view>');
    $templateCache.put("app/components/sync/sync.html", "<button ng-controller=SyncCtrl class=\"button button-icon icon\" ng-class=\"isSyncing ? '' : 'ion-android-sync'\" ng-click=sync()><ion-spinner icon=bubbles class=spinner-light ng-show=isSyncing></ion-spinner></button>");
    $templateCache.put("app/menus/list_item.html", "<ion-item ng-click><a ng-style=\"{'padding-left':(16 * (list.depth = 1 + (list.parent.depth || 0))) +  'px'}\" ng-click=toggleChildren(list)><i class=expand-collapse ng-class=\"areChildrenShown(list) ? 'ion-arrow-down-b' : 'ion-arrow-right-b'\" ng-show=\"list.children.length > 0\"></i></a> <span ui-sref=list({id:list.id}) menu-close>{{ list.name }} ({{ list.count }})</span></ion-item><div ng-show=areChildrenShown(list)><div ng-repeat=\"list in list.children\" ng-include=\"'app/menus/list_item.html'\"></div></div>");
    $templateCache.put("app/menus/main.html", '<ion-header-bar class="bar bar-header bar-balanced"><h1 class=title>Plant Lists</h1></ion-header-bar><ion-content has-header=true ng-controller=MainMenuCtrl><ion-list><div ng-repeat="list in plantLists" ng-include="\'app/menus/list_item.html\'"></div></ion-list></ion-content>');
} ]);