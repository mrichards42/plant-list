/**
 * Add PouchDB.putIfNotExists() and PouchDB.createDesignDoc()
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
        'createDesignDoc': function(name, mapFunction, reduceFunction) {
            var ddoc = {
                _id: '_design/' + name,
                views: {}
            };
            ddoc.views[name] = { map: mapFunction.toString() };
            if (reduceFunction)
                ddoc.views[name].reduce = reduceFunction.toString();
            return ddoc;
        }
    });
})();
