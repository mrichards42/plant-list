/**
 * PouchDB Utility functions
 */

(function () {
angular.module('PlantsApp').run(['$q', function($q) {

    // Utility functions
    PouchDB.plugin({
        /**
         * Put a document if it does not exist
         * @param doc
         * @param [options]
         * @returns {Promise} doc
         */
        'putIfNotExists': function(doc, options) {
            return this.put(doc, options).catch(function(err) {
                    if (err.status != 409)
                        throw err;
                    return doc;
                }
            )
        },
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
         * Insert or update a doc
         * @param doc
         * @param [equalsFunction=angular.equals] Function to determine if two docs are equal
         * @returns {Promise} get if doc exists, put if not
         */
        'upsert': function(doc, equalsFunction) {
            var db = this;
            equalsFunction = equalsFunction || angular.equals;
            return db.get(doc._id).then(function(result) {
                // Update _rev
                doc._rev = result.rev;
                if (! equalsFunction(doc, result))
                    return db.put(doc);
                else
                    return result;
            }).catch(function (err) {
                if (err.status === 404)
                    return db.put(doc); // Doc does not exist; insert
                throw err;
            });
        },
        /**
         * Insert or update a view design document
         * Compares map/reduce functions so the design doc isn't updated if it is the same
         * @param name
         * @param mapFunction
         * @param [reduceFunction]
         * @returns {Promise} get if doc exists, put if not
         */
        'upsertView': function(name, mapFunction, reduceFunction) {
            var db = this;
            var doc = db.createViewDoc(name, mapFunction, reduceFunction);
            return db.upsert(doc, function(a, b) {
                return a.views[name].map === b.views[name].map &&
                    a.views[name].reduce === b.views[name].reduce;
            });
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
                return new PouchDB(getUrl(db, name)).putSecurity(securityDoc);
            }));
        }
    });
}])})();
