/**
 * PouchDB replication handler
 */

(function () {
    angular.module('PlantsApp').factory('pouchReplicate', function() {
        /**
         * Start a PouchDB/CouchDB replication
         *
         * Uses pouchdb-dump/pouchdb-load for initial replication, then switches to standard replication
         *
         * @param source
         * @param target
         * @param options
         * @returns {Promise}
         */
        function replicator(source, target, options) {
            sendEvent('start');
            ++running;

            // Try to load a full pouchdb-dump
            return getDumpRev(target).then(function(targetRev) {
                return getDumpRev(source).then(function(sourceRev) {
                    console.log('Comparing pouchdb-dump revisions');
                    console.log('source', sourceRev, 'target', targetRev);
                    return sourceRev > targetRev;
                });
            }).then(function(shouldUpdate) {
                console.log(shouldUpdate ? 'Using pouchdb-dump' : 'Skipping pouchdb-dump');
                if (! shouldUpdate)
                    return;
                return source.get('_local/dump').then(function(dump) {
                    return target.load(dump.dump, {proxy: source.getUrl()}).then(function () {
                        return saveDumpRev(target, dump._rev)
                    })
                }).then(function() {
                    return target.info().then(function(info) {
                        // Assume all docs are updated
                        updateInfo({
                            ok:true,
                            docs_read: info.doc_count,
                            docs_written: info.doc_count
                        });
                    })
                });
            }).then(function() {
                // Handoff to regular replication
                console.log('Starting replication');
                var rep = PouchDB.replicate(source, target, options);
                rep.on('complete', function (info) {
                    updateInfo(info);
                    onDone();
                }).on('error', function (err) {
                    errors.push(err);
                    onDone();
                });
                return rep;
            }).catch(function(err) {
                console.log(err);
            })
        }

        // Return the pouchdb-dump revision for a database
        function getDumpRev(db) {
            return db.get('_local/dump-info').then(function (info) {
                return info.latest_rev;
            }).catch(function (err) {
                if (err.status !== 404)
                    throw err;
                return "0";
            })
        }

        // Save a dump revision to a database
        function saveDumpRev(db, rev) {
            return db.upsert('_local/dump-info', function(doc) {
                doc.latest_rev = rev;
                return doc;
            });
        }

        /**
         * Connect an event handler
         * @param event one of 'start', 'complete', or 'error'
         * @param handler callback function taking 0 or more arguments
         * @returns {replicator} for chaining
         */
        replicator.on = function (event, handler) {
            handlers[event] && handlers[event].push(handler);
            return replicator;
        };

        var handlers = {
            'complete': [],
            'error': [],
            'start': []
        };

        function sendEvent(event) {
            var args = Array.prototype.slice.call(arguments, 1);
            angular.forEach(handlers[event], function (callback) {
                callback.apply(null, args);
            });
        }

        // Track number of running replications for complete/error callbacks
        var running = 0;
        var errors = [];
        var infos = {};

        function updateInfo(i) {
            infos.ok = (infos.ok === undefined ? true : infos.ok) &&
                        (i.ok === undefined ? true : i.ok);
            infos.errors = (infos.errors || []).concat(i.errors || []);
            infos.last_seq = i.last_seq || 0;
            angular.forEach([
                'doc_write_failures',
                'docs_read',
                'docs_written'
            ], function(key) {
                infos[key] = (infos[key] || 0) + (i[key] || 0);
            });
        }

        function onDone() {
            --running;
            if (running <= 0) {
                if (errors.length > 0)
                    sendEvent('error', errors);
                else
                    sendEvent('complete', infos);
                errors = [];
                infos = {};
            }
        }

        return replicator;
    });
})();
