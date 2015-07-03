(function() {

// Replicate app then bootstrap
var db = new PouchDB('app');
var remote = new PouchDB(getRemote());
db.replicate.from(remote).catch(function (err) {
    if (err.status !== 500)
        console.log(err);
    // Assume we're offline and continue as if replication completed
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
    // index.html is an attachment to the app doc, so we can just strip the
    // '/index.html' off the path to get the doc name
    // e.g. 'db/app/APP_DOC/index.html'
    var docId = location.pathname.split('/').slice(-2)[0];

    // Bootstrap the main application
    loadModule(docId);

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
 * Return a remote database name that hosts the CouchApp
 *
 * Result is stored in localStorage
 *
 * Locations searched:
 * (1) db search param
 * (2) localStorage
 * (3) host
 */
function getRemote() {
    var remote = (location.search.match(/\?db=(.*)/) || [])[1] ||
        localStorage.getItem('bootstrap-remote-db') ||
        (location.protocol + '//' + location.host + '/app');
    localStorage.setItem('bootstrap-remote-db', remote);
    console.log('getRemote', remote);
    return remote;
}

// forEach or no-op if arr is null
function forEach(arr, func) {
    arr = arr || [];
    for (var i = 0; i < arr.length; ++i)
        func(arr[i], i);
}

})();