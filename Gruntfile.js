module.exports = function(grunt) {
    'use strict';

    var githubPagesFolder = '../../buses-gh-pages';

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            dist: {
                src: [
                    'bower_components/hammerjs/dist/hammer.js',
                    'libs/angular-hammer.js',
                    'bower_components/angular-leaflet/src/angular-leaflet-directive.js',
                    'js/**/*.js',
                ],
                dest: 'build/js/<%= pkg.shortName %>.js'
            }
        },
        uglify: {
            build: {
                src: 'build/js/<%= pkg.shortName %>.js',
                dest: 'build/js/<%= pkg.shortName %>.min.js'
            }
        },
        preprocess : {
            options: {
                context : {
                    DEBUG: false
                }
            },
            html : {
                src : 'index.html',
                dest : 'build/index.html'
            }
        },
        clean: {
            docs: ['docs/']
        },
        copy: {
            main: {
                files: [{
                    expand: true, flatten: false,
                    src: [
                        'bower_components/**',
                        'css/**',
                        'fonts/**',
                        'img/**',
                        'libs/**',
                        'partials/**'
                    ], dest: githubPagesFolder
                }, {
                    expand: true, flatten: true,
                    src: ['build/js/**'],
                    dest: githubPagesFolder + '/js',
                    filter: 'isFile'
                }, {
                    expand: true, flatten: true,
                    src: ['build/index.html'],
                    dest: githubPagesFolder,
                    filter: 'isFile'
                }]
            }
        },
        git_deploy: {
            deploy: {
                options: {
                    url: 'git@bitbucket.org:hyzhak/digital-me.git',
                    message: grunt.option('m') || 'undefined'
                },
                src: '.'
            }
        },
        githubPages: {
            target: {
                options: {
                    // The default commit message for the gh-pages branch
                    commitMessage: grunt.option('m') || 'undefined'
                },
                // The folder where your gh-pages repo is
                src: githubPagesFolder
            }
        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-github-pages');
    grunt.loadNpmTasks('grunt-git-deploy');
    grunt.loadNpmTasks('grunt-preprocess');

    // Default task(s).
    grunt.registerTask('minify', ['concat', 'uglify', 'preprocess']);

    grunt.registerTask('default', ['minify']);
    grunt.registerTask('prepare-deploy', ['minify', 'copy']);
    grunt.registerTask('deploy', ['prepare-deploy', 'githubPages:target']);
};