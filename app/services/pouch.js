/**
 * PouchDB Utility functions
 */

(function () {
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
            return db.get(doc._id).then(function(result) {
                // Compare map/reduce functions
                if (result.views[name].map != doc.views[name].map ||
                        result.views[name].reduce != doc.views[name].reduce) {
                    // Put
                    doc._rev = result._rev;
                    return db.put(doc);
                }
                return result;
            }).catch(function (err) {
                if (err.status === 404)
                    return db.put(doc); // Doc does not exist; insert
                throw err;
            });
        }
    });
})();
