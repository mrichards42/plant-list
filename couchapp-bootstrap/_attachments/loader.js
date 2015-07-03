(function() {
var APP = getAppInfo();
var db = new PouchDB('app');
var remote = new PouchDB(APP.db);
var start = Date.now();

// Store first access time in remote database in case it is ever recreated
// If local number does not match, destroy the local db and replicate from scratch
remote.get('_local/created').catch(function (err) {
    if (err.status !== 404)
        throw err;
    var doc = {_id:'_local/created', created:Date.now()};
    return remote.put(doc).then(function() { return doc });
}).then(function(remoteDoc) {
    return db.get('_local/created').catch(function(err) {
        if (err.status !== 404)
            throw err;
        return {}; // Dummy object
    }).then(function(localDoc) {
        if (localDoc.created !== remoteDoc.created) {
            // If no local doc exists or if it does not match the remote,
            // destroy the local database and recreate it
            return db.destroy().then(function() {
                db = new PouchDB('app');
                delete remoteDoc._rev;
                return db.put(remoteDoc);
            });
        }
    });
}).then(function() {
    // Replicate app then bootstrap
    return db.replicate.from(remote);
}).catch(function(err) {
    // Assume we're offline and continue as if replication completed
    console.log('Probably offline; skipping replication', err);
}).then(function () {
    // Map all docs by key for loadModule
    return db.allDocs({include_docs: true}).then(function (allDocs) {
        var docMap = {};
        forEach(allDocs.rows, function (row) {
            docMap[row.key] = row.doc
        });
        return docMap;
    });
}).then(function (docMap) {
    // Bootstrap the main application
    loadModule(APP.doc);
    console.log('Bootstrapping time: ' + (Date.now() - start)/1000);

    /**
     * Bootstrap a module
     *
     * Module doc format: {
     *    "_id": "module-id",
     *    "dependencies" : ["modules", "to-load", "first"],
     *    "app" : "app-module-id",
     *    "css": [".css { style: sheet; } "],
     *    "html": ["<div>stuff inside body tag</div>],
     *    "js": ["var script = 'js code';"],
     *    "ttf": [{"name":"name", "data": base64-encoded ttf],
     * }
     *
     * @param id docid
     */
    function loadModule(id) {
        var doc = docMap[id];
        // Load dependencies and app
        forEach(doc.dependencies, loadModule);
        if (doc.app)
            loadModule(doc.app);

        // CSS
        forEach(doc.css, loadCSS);

        // Fonts
        forEach(doc.ttf, function (font) {
            var name = font.name[0].toUpperCase() + font.name.substr(1);
            loadTTF(name, font.data);
        });

        // HTML
        forEach(doc.html, loadHTML);

        // Scripts
        forEach(doc.js, loadScript);
    }
});

// Load a stylesheet to <head>
var loadCSS = loadFunc(document.head, 'style', {type: 'text/css'});

// Load a javascript at the end of <body>
var loadScript = loadFunc(document.body, 'script', {type: 'text/javascript'});

// Load an html snippet as a <div> child of <body>
var loadHTML = loadFunc(document.body, 'div');

/**
 * Load a truetype font as a css font-face
 * @param facename
 * @param data base64 encoded font
 */
var loadTTF = function (facename, data) {
    return loadCSS(
        '@font-face {' +
        'font-family: "' + facename + '";' +
        'src: url(data:application/x-font-ttf;base64,' + data + ') format("truetype");' +
        'font-weight: normal;' +
        'font-style: normal;' +
        '}'
    );
};

// Factory for loadXXX functions
function loadFunc(parent, tag, attrs) {
    return function (text) {
        var el = document.createElement(tag);
        for (key in attrs)
            el[key] = attrs[key];
        el.innerHTML = text;
        return parent.appendChild(el);
    }
}

/**
 * Return an appinfo object: { 'db':'', 'doc':'' }
 *
 * Locations searched for app_doc
 * (1) app search param
 * (2) localStorage
 * (3) current page (db/app_doc/index.html)
 */
function getAppInfo() {
    var url = location.protocol + '//' + location.host + location.pathname;
    var app = (location.search.match(/\?app=(.*)/) || [])[1] ||
        localStorage.getItem('bootstrap-app') ||
        url.substr(0, url.lastIndexOf('/'));
    localStorage.setItem('bootstrap-app', app);
    var split = app.lastIndexOf('/');
    return {
        db:  app.substr(0, split),
        doc: app.substr(split+1)
    };
}

// forEach or no-op if arr is null
function forEach(arr, func) {
    arr = arr || [];
    for (var i = 0; i < arr.length; ++i)
        func(arr[i], i);
}

})();