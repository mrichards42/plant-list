module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        // Add manifest to
        'string-replace': {
            PlantsApp: {
                src:      'index_nocache.html',
                dest:     'index.html',
                options: {
                    replacements: [{
                        pattern: '<html',
                        replacement: '<html manifest="application.appcache"'
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
                        removeRedundantAttributes:      true,
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
        }
    });

    // Load plugins
    grunt.loadNpmTasks('grunt-string-replace');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-angular-templates');

    // Default task(s).
    grunt.registerTask('default', ['string-replace', 'ngtemplates', 'uglify']);
};