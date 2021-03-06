module.exports = function(grunt) {

    // Extensions that are better as base64 (or they would contain many \uXXXX sequences)
    var BINARY = {
        'ttf': true
    };
    grunt.task.registerMultiTask('couchJson', 'Compile a couch bootstrapped module as a single json', function() {
        var options = this.options();
        var json = {
            _id: options.id || this.target
        };
        this.filesSrc.forEach(function(filename) {
            var ext = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
            json[ext] = json[ext] || [];
            if (! BINARY[ext]) {
                // Plain text is pushed as-is
                json[ext].push(grunt.file.read(filename));
            }
            else {
                // Binary data is base64-encoded and stored as a {name, data} object
                var data = grunt.file.read(filename, {encoding: null}).toString('base64');
                var name = filename.substring(filename.lastIndexOf('/') + 1, filename.lastIndexOf('.'));
                json[ext].push({name: name, data: data});
            }
        });
        grunt.file.write(this.data.dest, JSON.stringify(json));
    });

    // Project configuration.
    grunt.initConfig({
        'string-replace': {
            PlantsApp: {
                src:      'index_nocache.html',
                dest:     'index.html',
                options: {
                    // Add manifest
                    replacements: [{
                        pattern: '<html',
                        replacement: '<html manifest="application.appcache"'
                    },
                    // Replace js with min.js
                    {
                        pattern:/\.js"/gi,
                        replacement: '.min.js"'
                    }, {
                        pattern:/\.min\.min\.js"/gi,
                        replacement: '.min.js"'
                    }]
                }
            },
            PlantsCouchApp: {
                src: 'index_nocache.html',
                dest: 'couchjson/body.html',
                options: {
                    // Only save code between the body tags
                    replacements: [{
                        pattern: /[^]*<body[^>]*>[^\S]*/,
                        replacement: ''
                    }, {
                        pattern: /[^\S]*<\/body[^]*/,
                        replacement: ''
                    }]
                }
            }
        },
        // Bundle template html into a js file
        ngtemplates : {
            PlantsApp: {
                options:    {
                    htmlmin: {
                        collapseBooleanAttributes:      true,
                        collapseWhitespace:             true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      false,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true
                    }
                },
                src:      'app/**/*.html',
                dest:     'app/templates.bundle.js' // Export to app folder instead of assets so it can be unglified
            }
        },
        // Bundle and compess all javascripts
        uglify: {
            bundle : {
                options: {
                    compress: false,
                    mangle: false,
                    beautify: true
                },
                files: {
                    'assets/js/app.js': ['app/**/*.js']
                }
            },
            bundle_min : {
                options: {
                    sourceMap: true
                },
                files: {
                    'assets/js/app.min.js': ['app/**/*.js']
                }
            }
        },
        // Compile dependencies into json files
        'couchJson': {
            'ionic': {
                dest: 'couchjson/ionic.json',
                src: [
                    'assets/libs/ionic/js/ionic.bundle.min.js',
                    'assets/libs/ionic/css/ionic.min.css',
                    'assets/libs/ionic/fonts/ionicons.ttf'
                ]
            },
            'pouchdb': {
                dest: 'couchjson/pouchdb.json',
                src: [
                    'assets/libs/pouchdb/angular-pouchdb.js',
                    'assets/libs/pouchdb/pouchdb.authentication.min.js',
                    'assets/libs/pouchdb/pouchdb.upsert.js',
                    'assets/libs/pouchdb/pouchdb.load.js',
                    'assets/libs/pouchdb/crypto-js-rollups-sha1.js'
                ]
            },
            'PlantsApp': {
                dest: 'couchjson/PlantsApp.json',
                src: [
                    'assets/js/app.min.js',
                    'assets/css/index.css',
                    'couchjson/body.html'
                ]
            }
        },
        // Compile entire app into a single couchapp json file
        'copy': {
            app: {
                files: [{
                    expand: true,
                    dest: 'couchapp-bootstrap/_attachments/',
                    src: [
                        '*.png',
                        'manifest.json',
                        'application.appcache'
                    ]
                }]
            }
        },
        'couch-compile': {
            bootstrap:  { files: { 'couchapp-bootstrap.json': 'couchapp-bootstrap'} },
            ionic:      { files: { 'couchapp-ionic.json': 'couchjson/ionic.json'} },
            pouchdb:    { files: { 'couchapp-pouchdb.json': 'couchjson/pouchdb.json'} },
            app:        { files: { 'couchapp.json': 'couchjson/PlantsApp.json'} }
        },
        'couch-push': {
            bootstrap:  { files: { 'https://<%= grunt.option("user") %>.cloudant.com/app': 'couchapp-bootstrap.json' } },
            ionic:      { files: { 'https://<%= grunt.option("user") %>.cloudant.com/app': 'couchapp-ionic.json' } },
            pouchdb:    { files: { 'https://<%= grunt.option("user") %>.cloudant.com/app': 'couchapp-pouchdb.json' } },
            app:        { files: { 'https://<%= grunt.option("user") %>.cloudant.com/app': 'couchapp.json' } }
        }
    });

    // Load plugins
    grunt.loadNpmTasks('grunt-string-replace');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-angular-templates');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-couch');

    // couch-push is not a default task
    // grunt couch-push --user=USER --pass=PASS

    // Default task(s).
    grunt.registerTask('default', ['string-replace', 'ngtemplates', 'uglify', 'copy', 'couchJson', 'couch-compile']);
};