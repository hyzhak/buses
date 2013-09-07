/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

var digiletme = angular.module('digiletme', [
        'ngRoute',
        'ApiService',
        'leaflet-directive',
        'FourSquare',
        'Carousel',
        'SmartIP',
        'hmTouchevents',
        'Location'
    ]);

digiletme
    .config(['$locationProvider', '$routeProvider', 'LocationProvider', function($locationProvider, $routeProvider, Location) {
        'use strict';

        $locationProvider.hashPrefix('!');

        $routeProvider
            .when('/location/:zoom?/:lat?/:lng?/:venueId?', {
                action: 'location',
                template: ''
            })
            .when('/venue/:venueId?', {
                action: 'venue',
                template: '',
                resolve: {
                    'Location': 'Location'
                }
                /*,
                redirectTo: function(pathParams) {
                    return Location.getLocation().then(function(location) {
                        return 'location/' + location.zoom + '/' + location.lat + '/' + location.lng + '/' + pathParams.venueId;
                    });
                }*/
            })
            .when('/photos/:venueId/:photoId', {
                action: 'photo',
                templateUrl: 'partials/photoPartial.html',
                controller: 'PhotoCtrl'
            })
            .otherwise({
                redirectTo: 'location/'
            });
    }])
    .constant('')
    .run(['FourSquareClient', function(FourSquareClient) {
        FourSquareClient.CLIENT_ID = '2WYFEWX521WPPTCQ3MKLLEGAHOW3EHPGLF1H4KXDB5OCQYT5';
        FourSquareClient.CLIENT_SECRET = 'TJ0ORRJ4VPQFZHQ3USFLV2TVBYJRQ1O30ZY5RCNXL5SM23IF';
    }]);

digiletme.controller('PhotosPreviewCarouselCtrl', ['$scope', function() {

}]);

digiletme.controller('RoutingCtrl', ['$scope', '$rootScope', 'VenuesAPI', 'Location', '$http', '$resource', '$q', '$location', '$timeout', '$window', function($scope, $rootScope, VenuesAPI, Location, $http, $resource, $q, $location, $timeout, $window) {
    'use strict';

    var storedScrollY = 0;

    $rootScope.$on('$routeChangeStart', function(event, next, current) {
        document.body.style.overflowY = 'auto';
        if (storedScrollY) {
            $window.scrollTo(0, storedScrollY);
            storedScrollY = 0;
            $timeout(function() {
            }, 100);
        }

        if (!next) {
            return;
        }

        switch(next.action) {
            case 'venue':
                Location.getLocation().then(function(location) {
                    $location.path('location/' + location.zoom + '/' + location.lat + '/' + location.lng + '/' + next.params.venueId);
                });
                break;
            case 'photo':
                $rootScope.$broadcast('selectPhoto', next.params.photoId);
                document.body.style.overflowY = 'hidden';
                storedScrollY = $window.scrollY;
                break;
            case 'location':
                if (next.params.hasOwnProperty('lat') &&
                    next.params.hasOwnProperty('lng') &&
                    next.params.hasOwnProperty('zoom')) {
                    Location.setLocation(Number(next.params.lat), Number(next.params.lng), Number(next.params.zoom));
                }

                if (next.params.venueId) {
                    $rootScope.$broadcast('selectVenue', next.params.venueId);
                }
                break;
            default:
                break;
        }
    });
}]);

digiletme.controller('SearchResultCtrl', ['$scope', '$rootScope', 'VenuesAPI', 'Location', '$http', '$resource', '$q', '$location', '$timeout', '$window', function($scope, $rootScope, VenuesAPI, Location, $http, $resource, $q, $location, $timeout, $window) {
    'use strict';

    $scope.hasVenuesWithoutPhotos = false;
    $scope.venuesWithoutPhotos = {};
    $scope.venues = {};
    $scope.waitForVenuesWithPhotos = true;
    VenuesAPI.getLocalVenues().then(function(resource) {
        $scope.waitForVenuesWithPhotos = false;
    });

    $rootScope.$on('showVenue', function(e, venue) {
        if ($scope.venues[venue.id]) {
            return;
        }

        $scope.venues[venue.id] = venue;
    });

    $rootScope.$on('hideVenue', function(e, venue) {
        if (!$scope.venues[venue.id]) {
            return;
        }

        $scope.venues[venue.id] = null;
    });

    $rootScope.$on('showVenueWithoutPhoto', function(e, venue) {
        if ($scope.venuesWithoutPhotos[venue.id]) {
            return;
        }

        $scope.venuesWithoutPhotos[venue.id] = venue;
        $scope.hasVenuesWithoutPhotos = true;
    });

    $rootScope.$on('hideVenueWithoutPhoto', function(e, venue) {
        if (!$scope.venuesWithoutPhotos[venue.id]) {
            return;
        }

        $scope.venuesWithoutPhotos[venue.id] = null;
//        $scope.hasVenuesWithoutPhotos = true;
    });
/*
    $rootScope.$on('newVenueWithoutPhotos', function(e, venue) {
        if ($scope.venuesWithoutPhotos[venue.id]) {
            return;
        }

        $scope.venuesWithoutPhotos[venue.id] = venue;
        $scope.hasVenuesWithoutPhotos = true;
    });*/


    $scope.concat4SQImg = function(icon, width, height) {
        if (!icon.prefix || !icon.suffix) {
            return '';
        }
        var prefix = icon.prefix.substr(0, icon.prefix.length - 1),
            middle = '',
            suffix = icon.suffix;

        if (width && height) {
            middle = '/' + width + 'x' + height;
        }

        return prefix + middle + suffix;
    };

    $scope.getDivStyleFor4SQImg = function(icon, width, height) {
        return {
            backgroundImage: 'url(\'' + $scope.concat4SQImg(icon, width, height) + '\')'
        };
    };

    $scope.getPhotosOfVenue = (function() {
        var cachedRequest = {},
            cachedValue = {};
        return function(venue) {
            if (cachedValue[venue.id]) {
                var photos = cachedValue[venue.id];
                venue.visible = photos.length > 0;
                return $q.when(photos);
            }

            if (!cachedRequest[venue.id]) {
                cachedRequest[venue.id] = VenuesAPI.getPhotosByVenueId(venue.id)
                    .then(function(result) {
                        cachedRequest[venue.id] = null;
                        cachedValue[venue.id] = result;
                        var hasPhotos = result.length > 0;
                        venue.visible = hasPhotos;
                        /*if (!hasPhotos) {
                            $scope.venuesWithoutPhotos.push(venue);
                        }*/

                        return result;
                    });
            }

            return cachedRequest[venue.id];
        };
    })();

    var GoogleReverseGeocoding = $resource(
        'http://maps.googleapis.com/maps/api/geocode/json' +
            '?latlng=:pos' +
            '&language=en' +
            '&sensor=false'
    , {

    });


    $scope.getAddressOfVenue =(function() {
        var cachedValue = {};
        return function(venue) {
            if (!cachedValue[venue.id]) {
                if (venue.location.city) {
                    cachedValue[venue.id] = (venue.location.address?(venue.location.address + ', '):'') +
                        (venue.location.city?(venue.location.city + ', '):'') +
                        (venue.location.country?venue.location.country:'');
                } else {
                    cachedValue[venue.id] = GoogleReverseGeocoding.get({pos: venue.location.lat + ',' + venue.location.lng})
                        .$promise.then(function(resource) {
                            if (resource.results.length <= 0) {
                                return 'unknown';
                            }

                            cachedValue[venue.id] = resource.results[0].formatted_address;
                            return cachedValue[venue.id];
                        });
                }
            }
            return cachedValue[venue.id];
        };
    })();

    $scope.$on('selectVenue', function(e, id) {
        //$location.hash(id);
        var elm = document.querySelector('#' + 'venue-' + id),
            box = elm.getBoundingClientRect(),
            pos = box.top + window.scrollY - 250;
        //window.scrollTo(0, pos);
        scrollToAnimation(pos);
    });

    var previousScroll = {};

    function scrollToAnimation(pos) {
        var scrollIteration = buildScrollIteration(pos);
        requestAnimFrame(scrollIteration);
        previousScroll.inProgress = false;
        previousScroll = scrollIteration;
    }

    window.addEventListener('scroll', function() {
        if (lastSetScrollY !== window.scrollY) {
            previousScroll.inProgress = false;
        }
    });

    var lastSetScrollY;

    function buildScrollIteration(pos) {
        if (pos < 0) {
            pos = 0;
        }
        var iteration = function() {
            var delta = window.scrollY - pos,
                step = 10;

            if (-step < delta && delta < step || !iteration.inProgress) {
                lastSetScrollY = Math.round(pos);
            } else {
                lastSetScrollY = Math.round(window.scrollY - delta/step);
                requestAnimFrame(iteration);
            }
            window.scrollTo(0, lastSetScrollY);
        };

        iteration.inProgress = true;

        return iteration;
    }

    $scope.$on('selectMarkerOnMap', function(e, id) {
        var path = 'venue/' + id;
        $location.path(path);
    });
}]);

//Hammer.plugins.fakeMultitouch();
Hammer.plugins.showTouches();