/**
* PouchDB Utility functions
*/

(function () {
angular.module('pouchdb').run(['$q', 'pouchDB', function($q, pouchDB) {

    // Utility functions
    PouchDB.plugin({
        /**
         * Create a design document for a view
         * The view and design doc share the name so queries can be made with just the name
         * @param name
         * @param mapFunction
         * @param [reduceFunction]
         * @returns {{_id: string, views: {}}}
         */
        'createViewDoc': function(name, mapFunction, reduceFunction) {
            var ddoc = {
                _id: '_design/' + name,
                views: {}
            };
            ddoc.views[name] = { map: mapFunction.toString() };
            if (reduceFunction)
                ddoc.views[name].reduce = reduceFunction.toString();
            return ddoc;
        },
        /**
         * Open a new PouchDB on the same server
         * @param [name=current db] Database name
         * @returns {PouchDB}
         */
        'openDB': function(name) {
            return new PouchDB(name ? getUrl(this, name) : this.getUrl());
        }
    });

    // Security functions
    PouchDB.plugin({
        /**
         * Get the security document
         * @returns {Promise} _security doc
         */
        'getSecurity': function () {
            return this.request({url: '_security'});
        },
        /**
         * Put the security document
         * @param doc _security document
         * @returns {Promise} doc
         */
        'putSecurity': function (doc) {
            return this.request({
                url: '_security',
                body: doc,
                method: 'PUT'
            });
        }
    });

    /**
     * Get a path using the database's host
     * @param db PouchDB
     * @param path path after host
     * @returns {string}
     */
    function getUrl(db, path) {
        var host = db.getHost(db.getUrl());
        return host.protocol + '://' + host.host + '/' + (path || '');
    }

    /**
     * Is this a Cloudant db?
     * @param db
     * @returns {true/false}
     */
    function isCloudant(db) {
        return db.getUrl().match(/\.cloudant\.com/);
    }

    // Security/Users functions
    var pouchLogin = PouchDB.prototype.login;
    var pouchSignup = PouchDB.prototype.signup;

    PouchDB.plugin({
        // pouch-authorization Cloudant fix
        // Add x-www-form-urlencoded and a urlencoded body for Cloudant databases
        'login': function (username, password, opts, callback) {
            opts = opts || {};
            if (isCloudant(this)) {
                opts.ajax = angular.extend({
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: 'name=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password)
                }, opts.ajax || {});
            }
            // Assemble args and call function
            // NB: the original function checks arguments.length to decide if there
            // is a callback, so we can't just include null callback as an arg.
            var args = [username, password, opts];
            if (callback)
                args.push(callback);
            return pouchLogin.apply(this, args);
        },
        // pouch-authorization Cloudant fix
        // Hash password during signup
        // Default 'user' role
        'signup': function (username, password, opts, callback) {
            opts = opts || {};
            opts.roles = opts.roles || ['user'];
            if (isCloudant(this)) {
                // SHA-1 hash
                var salt = PouchDB.utils.uuid();
                var hash = CryptoJS.SHA1(password + salt).toString();
                // Add to doc
                opts.metadata = opts.metadata || {};
                opts.metadata.password_sha = hash;
                opts.metadata.salt = salt;
                opts.metadata.password_scheme = 'simple';
                opts.metadata.password = ''; // blank out password
                // Add identifying data
                opts.metadata.useragent = navigator.userAgent;
                opts.metadata.created = new Date().toString();
            }
            // Assemble args and call function
            var args = [username, password, opts];
            if (callback)
                args.push(callback);
            return pouchSignup.apply(this, args);
        },
        /**
         * Ensure a _users database exists and add _security documents to each database
         *
         * Requires admin to be logged in, and is mostly useful for cloudant.
         *
         * @param [dbList=current database] Array of database names that should have _security documents
         * @param [securityDoc] Defaults to couchdb_auth_only with 'user' role having read/write access
         * @returns {Promise} $q.all(putSecurity() for each database)
         */
        'setupSecurity': function(dbList, securityDoc) {
            var db = this;
            dbList = dbList || [db.getHost(db.getUrl()).db];
            securityDoc = securityDoc || {
                "couchdb_auth_only": true,
                "members": {
                    "names": [],
                    "roles": ['user']
                },
                "admins": {}
            };
            // By *not* passing skipSetup: true, Pouch will try to create the _users db
            var usersDb = new PouchDB(getUrl(db, '_users'));
            // Add security doc to all databases
            return $q.all(dbList.map(function(name) {
                return db.openDB(name).putSecurity(securityDoc);
            }));
        },
        /**
         * Login with a token, or create a new token for login
         * @param [username] Credentials if token does not exist
         * @param [password]
         * @returns {Promise} result of login
         */
        'tokenLogin': function(username, password) {
            var db = this;
            var token = getToken(db) || [];
            // Try to login with the token
            return loginWithToken(db, token).catch(function(err) {
                if (err.status !== 403 && err.status !== 400)
                    throw err;
                if (! username || ! password)
                    throw err;
                // Login with real credentials
                return db.login(username, password).then(function(result) {
                    console.log(result);
                    // Create a dummy login to act as a token
                    var token = [PouchDB.utils.uuid(), PouchDB.utils.uuid()];
                    return db.signup(token[0], token[1]).then(function() {
                        // Try again
                        return loginWithToken(db, token);
                    });
                });
            });
        }
    });

    // Login caching
    var TOKEN_KEY = 'plantlist-token:';
    var REMOTE_KEY = 'plantlist-remote:';
    function getHost(db) {
        return db.getHost(db.getUrl());
    }

    function getToken(db) {
        return JSON.parse(localStorage.getItem(TOKEN_KEY + getHost(db).host));
    }

    function saveToken(db, token) {
        var key = TOKEN_KEY + getHost(db).host;
        if (! token)
            localStorage.removeItem(key);
        else
            localStorage.setItem(key, JSON.stringify(token));
    }

    // Login with a token and save it
    function loginWithToken(db, token) {
        return db.login(token[0], token[1]).then(function (result) {
            token[2] = db.getHost(db.getUrl()).host;
            saveToken(db, token);
            console.log('successfully logged in with token', token);
            return result;
        });
    }

    /**
     * Open a remote database with a cached url
     *
     * This function caches url and login token
     *
     * @param [name] database name
     * @param [opts] options object
     * @param [opts.name] database name
     * @param [opts.url] url if name is not provided
     * @param [opts.skipSetup] don't login to the database
     * @param [opts.username] username for login
     * @param [opts.password] password for login
     * @returns {Promise} logged in PouchDB
     */
    pouchDB.openRemote = function(name, opts) {
        // Get options
        if (typeof name === 'object') {
            opts = name;
        }
        else {
            opts = opts || {};
            if (name.indexOf('://') !== -1)
                opts.url = name;
            else
                opts.name = name;
        }
        // Open db
        var url = opts.url || localStorage.getItem(REMOTE_KEY + opts.name);
        if (! url) {
            // Return a PouchDB-like error object
            return $q.reject({
                status: 400,
                name: 'bad_request',
                reason: 'Missing/invalid DB name',
                error: true
            });
        }
        var db = pouchDB(url, {skipSetup:true});
        if (opts.skipSetup)
            return db;
        // login with token or supplied credentials
        return db.tokenLogin(opts.username, opts.password)
            .then(function() {
                // Cache using supplied name or database name
                localStorage.setItem(REMOTE_KEY + (opts.name || getHost(db).db), db.getUrl());
                return db;
            });
    }
}])})();
