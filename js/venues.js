FourSquareModule.factory('VenuesAPI', ['FourSquareClient', '$q', '$resource', '$rootScope', '$timeout', function(FourSquareClient, $q, $resource, $rootScope, $timeout) {
        'use strict';

        var api = {},
            bounds/* = {

                London
                sw: {
                    lat: 51.505 - 0.5,
                    lng: -0.09 - 0.5
                },
                ne: {
                    lat: 51.505 + 0.5,
                    lng: -0.09 + 0.5
                }
            }*/,
            numOfRequest = 0;

        /**
         * @private
         */
        function incNumOfRequest() {
            numOfRequest++;
            $rootScope.$emit('changeNumOfRequest', numOfRequest);
        }

        /**
         *
         * @param sw
         * @param ne
         */
        api.updateBounds = function(sw, ne) {
            var maxWidth = 2,
                maxHeight = 2;
            bounds = {
                sw: sw,
                ne: ne
            };

            localVenues = null;

            //TODO: Fix Bounding quadrangles with an area up to approximately 10,000 square kilometers are supported.
            if (ne.lat - sw.lat > maxWidth) {
                var latCenter = 0.5 * (ne.lat + sw.lat);
                sw.lat = latCenter - 0.5 * maxWidth;
                ne.lat = latCenter + 0.5 * maxWidth;
            }

            if (ne.lng - sw.lng > maxHeight) {
                var lngCenter = 0.5 * (ne.lng + sw.lng);
                sw.lng = lngCenter - 0.5 * maxHeight;
                ne.lng = lngCenter + 0.5 * maxHeight;
            }

            $rootScope.$emit('updateBounds', bounds);
        };

        function isOutsideTheBounds(point) {
            return point.lat < bounds.sw.lat || bounds.ne.lat < point.lat ||
                   point.lng < bounds.sw.lng || bounds.ne.lng < point.lng;
        }

        /**
         * get visible bounds
         *
         * @returns {*}
         */
        api.getBounds = (function() {
            var defer;
            return function() {
                if (defer) {
                    return defer.promise;
                }
                defer = $q.defer();
                if (bounds) {
                    //hack. it should work without timeout.
                    $timeout(function() {
                        defer.resolve(bounds);
                        defer = null;
                    }, 0);
                } else {
                    var unregisteredListenerFunction = $rootScope.$on('updateBounds', function (e, value) {
                        defer.resolve(value);
                        defer = null;
                        unregisteredListenerFunction();
                    });
                }

                return defer.promise;
            };
        })();

        var catetories = [
//        '4d4b7105d754a06379d81259', //(main) Путешествия и транспорт
//        '4bf58dd8d48988d1ed931735', //Аэропорт / Аэропорт
//        '4e4c9077bd41f78e849722f9', //Велопрокат / Велопрокат
            '4bf58dd8d48988d1fe931735', //Автовокзал / Автовокзал
//        '4e51a0c0bd41d3446defbb2e', //Паром / Паром
//        '4bf58dd8d48988d1f6931735', //Путешествия - Общее / Путешествия ?
//        '4bf58dd8d48988d1fc931735', //Легкорельсовая линия / Легкорельсовая линия
//        '4f2a23984b9023bd5841ed2c', //Подвижный объект / Подвижный объект
//        '4bf58dd8d48988d1ef941735', //Автопрокат / Автопрокат
//        '4bf58dd8d48988d1f9931735', //Дорога / Дорога
//        '4bf58dd8d48988d1fd931735', //Метро / Метро
//        '4bf58dd8d48988d130951735', //Такси / Такси
//        '4f4530164b9074f6e4fb00ff', //Справочный пункт / Справочный пункт
//        '4bf58dd8d48988d129951735', //Железнодорожный вокзал / Железнодорожный вокзал
        ];

        //key: venueId, value is object of venueId that connected
        var adjacencyGraphOfVenues = {};

        api.getAdjacencyGraphOfVenues = function(id) {
            return adjacencyGraphOfVenues[id];
        };

        function inCategories(venue) {
            for (var i = 0, count = venue.categories.length; i < count; i++) {
                if (catetories.indexOf(venue.categories[i]) >= 0) {
                    return true;
                }
            }

            return false;
        }

        var Venues = $resource(
            'https://api.foursquare.com/v2/venues/search' +
            '?ll=:pos' +
            '&intent=browse' +
            '&limit=:limit' +
            '&radius=:radius' +
            '&categoryId=:categories' +
            '&client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate, {
                limit: 50,
                radius: 100000,
                clientId: FourSquareClient.CLIENT_ID,
                clientSecret: FourSquareClient.CLIENT_SECRET
            }
        );

        var VenuesByQuadrangle = $resource(
            'https://api.foursquare.com/v2/venues/search' +
                '?sw=:sw' +
                '&ne=:ne' +
                '&intent=browse' +
                '&limit=:limit' +
                '&categoryId=:categories' +
                '&client_id=:clientId' +
                '&client_secret=:clientSecret' +
                '&v=' + FourSquareClient.currentAPIDate, {
                limit: 50,
                clientId: FourSquareClient.CLIENT_ID,
                clientSecret: FourSquareClient.CLIENT_SECRET
            }
        );

        var localVenues = null,
            venuesWithPhotos = {},
            venuesWithoutPhotos = {},
            visibleVenues = {},
            visibleVenuesWithoutPhotos = {};

        api.getLocalVenues = function() {
            if (!localVenues) {
                localVenues = api.getBounds()
                    .then(function(bounds) {
                        incNumOfRequest();
                        return VenuesByQuadrangle.get({
                            sw: bounds.sw.lat + ', ' + bounds.sw.lng,
                            ne: bounds.ne.lat + ', ' + bounds.ne.lng,
                            categories: catetories.join(','),
                            clientId: FourSquareClient.CLIENT_ID,
                            clientSecret: FourSquareClient.CLIENT_SECRET
                        }).$promise;
                    });
            }

            return localVenues;
        };

        /**
         * return venues that have photos
         *
         * @returns {Promise}
         */
        api.getVenuesWithPhotos = function() {
            return api.getLocalVenues().then(function(resource) {
                var venues = resource.response.venues;

                //FIXME: each time we get new venues with the same ids
                //so stored venues in lists (venuesWithPhotos, venuesWithoutPhotos,visibleVenues)
                //can be different

                hideInvisibleVenues(visibleVenues, hideVenue);
                hideInvisibleVenues(visibleVenuesWithoutPhotos, hideVenueWithoutPhoto);

                var chainOfRequests = $q.when({});

                for(var i = 0, count = venues.length; i < count; i++) {
                    var venue = venues[i];
                    chainOfRequests = chainOfRequests
                        .then(buildRequest(venue))
                        .then(buildHandler(venue));
                }

                function buildRequest(venue) {
                    return function() {
                        return getPhotosOfVenue(venue);
                    }
                }

                function buildHandler(venue) {
                    return function(photos) {
                        if (photos.length > 0) {
                            venuesWithPhotos[venue.id] = venue;
                            showVenue(venue);
                            $rootScope.$emit('newVenueWithPhotos', venue);
                        } else {
                            venuesWithoutPhotos[venue.id] = venue;
                            showVenueWithoutPhoto(venue);
                            $rootScope.$emit('newVenueWithoutPhotos', venue);
                        }

                        return venuesWithPhotos;
                    };
                }

                return chainOfRequests.then(function(venuesWithPhotos) {
                    /*hideInvisibleVenues(visibleVenues, hideVenue);
                    hideInvisibleVenues(visibleVenuesWithoutPhotos, hideVenueWithoutPhoto);*/
                    return venuesWithPhotos;
                });
            }, function(err) {
                switch(err.data.meta.errorType) {
                    case 'geocode_too_big':
                        //TODO : reduce bounds
                        /*api.updateBounds({

                        });*/
                        break;
                    default:
                        console.log('need to add handler to error', err);
                        break;
                }

                return [];
            });
        };

        /**
         * @private
         * @param venues
         */
        function hideInvisibleVenues(venues, hideCallback) {
            var ids = Object.keys(venues);
            ids.forEach(function(id) {
                var venue = venues[id];
                if (isVenueInvisible(venue)) {
                    hideCallback(venue)
                }
            });
        }

        /**
         * @private
         *
         * @param venue
         */
        function showVenue(venue) {
            if (visibleVenues[venue.id]) {
                return;
            }
            visibleVenues[venue.id] = venue;
            $rootScope.$emit('showVenue', venue);
        }

        /**
         * @private
         * @param venue
         */
        function hideVenue(venue) {
            if (!visibleVenues[venue.id]) {
                return;
            }
            visibleVenues[venue.id] = null;
            $rootScope.$emit('hideVenue', venue);
        }

        /**
         * @private
         * @param venue
         */
        function showVenueWithoutPhoto(venue) {
            if (visibleVenuesWithoutPhotos[venue.id]) {
                return;
            }
            visibleVenuesWithoutPhotos[venue.id] = venue;
            $rootScope.$emit('showVenueWithoutPhoto', venue);
        }

        /**
         * @private
         * @param venue
         */
        function hideVenueWithoutPhoto(venue) {
            if (!visibleVenuesWithoutPhotos[venue.id]) {
                return;
            }
            visibleVenuesWithoutPhotos[venue.id] = null;
            $rootScope.$emit('hideVenueWithoutPhoto', venue);
        }

        /**
         * @private
         * @param venue
         * @returns {*}
         */
        function isVenueInvisible(venue) {
            if (!venue) {
                return false;
            }

            return isOutsideTheBounds(venue.location);
        }

        /**
         * @private
         */
        var getPhotosOfVenue = (function() {
            var cachedRequest = {},
                cachedValue = {};
            return function(venue) {
                if (cachedValue[venue.id]) {
                    return $q.when(cachedValue[venue.id]);
                }

                if (!cachedRequest[venue.id]) {
                    cachedRequest[venue.id] = api.getPhotosByVenueId(venue.id)
                        .then(function(result) {
                            cachedRequest[venue.id] = null;
                            cachedValue[venue.id] = result;
                            return result;
                        });
                }

                return cachedRequest[venue.id];
            };
        })();

        var mapPhotoIdToInstance = {};

        var Venue = $resource('https://api.foursquare.com/v2/venues/:venueId' +
            '?client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate);

        /**
         * @private
         */
        var getVenueById = (function() {
            var cachedVenue = {};
            return function(id) {
                if (!cachedVenue[id]) {
                    incNumOfRequest();
                    cachedVenue[id] = Venue.get({
                        venueId: id,
                        clientId: FourSquareClient.CLIENT_ID,
                        clientSecret: FourSquareClient.CLIENT_SECRET
                    }).$promise;
                }

                return cachedVenue[id];
            };
        })();

        var Photos = $resource('https://api.foursquare.com/v2/venues/:venueId/photos' +
            '?client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate);

        api.getPhotosByVenueId = (function() {
            var cachedValues = {};
            return function(id) {
                if (!cachedValues[id]) {
                    incNumOfRequest();
                    cachedValues[id] = Photos.get({
                            venueId:id,
                            clientId: FourSquareClient.CLIENT_ID,
                            clientSecret: FourSquareClient.CLIENT_SECRET
                        })
                        .$promise.then(function(resource) {
                            var photos = [],
                                items = resource.response.photos.items;
                            for(var j = 0, jCount = items.length; j < jCount; j++) {
                                var item = items[j];
                                photos.push(item);
                                mapPhotoIdToInstance[item.id] = item;
                            }
                            return photos;
                        });
                }

                return cachedValues[id];
            }
        })();

        var NextVenues = $resource('https://api.foursquare.com/v2/venues/:venueId/nextvenues' +
            '?client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate);

        api.getNextVenuesByVenueId = (function() {
            var cachedValues = {};

            return function(id) {
                if (!cachedValues[id]) {
                    adjacencyGraphOfVenues[id] = {
                        neighborhood: {}
                    };

                    var iterator = buildNextVenueIterator(id, []);
                    return iterator(id, 8, iterator);
                }

                return cachedValues[id];
            };

            function buildNextVenueIterator(rootId, neighborhood) {
                var cachedValues = {};
                return function(currentId, depth, iterator) {
                    if (!cachedValues[currentId]) {
                        incNumOfRequest();
                        cachedValues[currentId] = NextVenues.get({
                            venueId: currentId,
                            clientId: FourSquareClient.CLIENT_ID,
                            clientSecret: FourSquareClient.CLIENT_SECRET
                        })
                        .$promise.then(function(nextVenues) {
                            var items = nextVenues.data.response.nextVenues.items,
                                result = $q.when(neighborhood);

                            for(var i = 0, count = items.length; i < count; i++) {
                                var item = items[i];
                                if (inCategories(item)) {
                                    result = result.then(function() {
                                        neighborhood.push(item);
                                        adjacencyGraphOfVenues[rootId][item.id] = {
                                            item: item
                                        };
                                        return neighborhood;
                                    });
                                } else {
                                    if (depth > 0 && !adjacencyGraphOfVenues[rootId].neighborhood[item.id]) {
                                        adjacencyGraphOfVenues[rootId].neighborhood[item.id] = {
                                            item: item,
                                            depth: depth
                                        };
                                        result = result.then(function() {
                                            return iterator(item.id, depth - 1, iterator);
                                        });
                                    }
                                }
                            }

                            return result;
                        });
                    }

                    return cachedValues[currentId];
                }
            }
        })();

        api.getPhotoById = function(id) {
            return mapPhotoIdToInstance[id];
        };


        return api;
    }]);