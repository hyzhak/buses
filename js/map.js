/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

digiletme.controller('MapCtrl', ['VenuesAPI', 'Location', '$scope', '$rootScope', '$timeout', '$q', function(VenuesAPI, LocationService, $scope, $rootScope, $timeout, $q) {
    'use strict';

    $scope.center = {};

    $scope.markers = {};

    var needInitialize = false;

    $scope.events = {
        dblclick: function(e){
            console.log(e);
        },
        click: function(e) {
            console.log(e);
        },
        zoomend: function(e) {
            lazyUpdateBounds(e.target.getBounds().getSouthWest(), e.target.getBounds().getNorthEast());
            LocationService.setLocation($scope.center.lat, $scope.center.lng, $scope.center.zoom);
        },
        dragend: function(e) {
            lazyUpdateBounds(e.target.getBounds().getSouthWest(), e.target.getBounds().getNorthEast());
            LocationService.setLocation($scope.center.lat, $scope.center.lng, $scope.center.zoom);
        },
        moveend: function(e) {
            if (needInitialize) {
                var sw = e.target.getBounds().getSouthWest(),
                    ne = e.target.getBounds().getNorthEast();
                lazyUpdateBounds(sw, ne);
                LocationService.setLocation(0.5 * (sw.lat + ne.lat), 0.5 * (sw.lng + ne.lng), $scope.center.zoom);

                needInitialize = false;
            }
        }
    };

    $scope.$on('leafletDirectiveMarkersClick', function(e, id) {
        var marker = $scope.markers[id];
        $rootScope.$broadcast('selectMarkerOnMap', id);
        beforeFocusOnMarker(marker);
        afterFocusOnMarker(marker);
    });

    var previousFocusedMarker = null;

    function beforeFocusOnMarker(marker) {
        if (previousFocusedMarker === marker) {
            return false;
        }

        if (!previousFocusedMarker) {
            return true;
        }

        previousFocusedMarker.focus = false;
        return true;
    }

    function afterFocusOnMarker(marker) {
        previousFocusedMarker = marker;
    }

    $rootScope.$on('selectVenue', function(e, id) {
        var marker = $scope.markers[id];
        if(!marker || !beforeFocusOnMarker(marker)) {
            return;
        }
        marker.focus = true;
        previousFocusedMarker = marker;
        afterFocusOnMarker(marker);
    });

    $rootScope.$on('updateBounds', function (e, value) {
        requestVenues();
    });

    $rootScope.$on('showVenue', function(e, venue) {
        if ($scope.markers[venue.id]) {
            return;
        }

        $scope.markers[venue.id] = {
            lat: venue.location.lat,
            lng: venue.location.lng,
            message: venue.name
        };
    });

    $rootScope.$on('hideVenue', function(e, venue) {
        if (!$scope.markers[venue.id]) {
            return;
        }

        //TODO: can't use more optimal sentence $scope.markers[venue.id] = null;
        //because of bug in leaflet ng directive
        delete $scope.markers[venue.id];
    });

    /**
     * lazy update bounds. Update only after 2 seconds of lack of other updates
     *
     * @private
     * @param sw
     * @param ne
     */
    var lazyUpdateBounds = (function() {
        var storedSW,
            storedNE,
            timeoutId;

        return function (sw, ne) {
            storedSW = sw;
            storedNE = ne;

            if (timeoutId) {
                $timeout.cancel(timeoutId);
            }

            timeoutId = $timeout(function() {
                VenuesAPI.updateBounds(storedSW, storedNE);
                timeoutId = null;
            }, 2 * 1000)
        }
    })();

    var running = true;

    var destroyHandler = $scope.$on('$destroy', function() {
        console.log('destroy');
        running = false;
    });

    /**
     * @private
     */
    function placeToCurrentPosition() {
       return LocationService.getLocation().then(function(loc) {
           $scope.center.lat = loc.lat;
           $scope.center.lng = loc.lng;
           return loc;
        });
    }

    function requestNeighborhood(venue) {
        VenuesAPI.getNextVenuesByVenueId(venue.id).then(function(result) {
            console.log('>');
            console.log('venue.name: ' + venue.name);
            console.log('venue.id: ' + venue.id);
            console.log('adjacency: ', VenuesAPI.getAdjacencyGraphOfVenues(venue.id));
            console.log('next: ', result);
        });
    }

    /**
     * @private
     */
    function requestVenues() {
        $scope.waitForVenuesWithPhotos = true;
        VenuesAPI.getVenuesWithPhotos();
    }

    //setup custom controls
    $scope.myCustomControls = [];

    var MyControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function (map) {
            var className = 'leaflet-control-my-location',
                container = L.DomUtil.create('div', className + ' leaflet-bar');

            this._map = map;

            this._zoomInButton = this._createButton(
                '&gt;', 'My Location',  className,  container, this._findLocation,  this);

            /*
             map.on('zoomend', this._updateDisabled, this);*/

            return container;
        },

        _findLocation: function(e) {
            LocationService.requestMyLocation().then(function(loc) {
                $scope.center.lat = loc.lat;
                $scope.center.lng = loc.lng;
                $scope.center.zoom = loc.zoom;
            });
        },

        _createButton: function (html, title, className, container, fn, context) {
            var link = L.DomUtil.create('a', className, container);
            link.innerHTML = html;
            link.href = '#';
            link.title = title;

            var stop = L.DomEvent.stopPropagation;

            L.DomEvent
                .on(link, 'click', stop)
                .on(link, 'mousedown', stop)
                .on(link, 'dblclick', stop)
                .on(link, 'click', L.DomEvent.preventDefault)
                .on(link, 'click', fn, context);

            return link;
        },

        _updateDisabled: function () {
            var map = this._map,
                className = 'leaflet-control-zoom-disabled';

            L.DomUtil.removeClass(this._zoomInButton, className);
            L.DomUtil.removeClass(this._zoomOutButton, className);

            if (map._zoom === map.getMinZoom()) {
                L.DomUtil.addClass(this._zoomOutButton, className);
            }
            if (map._zoom === map.getMaxZoom()) {
                L.DomUtil.addClass(this._zoomInButton, className);
            }
        }
    });

    $scope.myCustomControls.push(MyControl);


    function init() {
        placeToCurrentPosition().then(function(loc) {
            needInitialize = true;
            //just use the hack with zomming to trigger zoomend event
            /*$scope.center.zoom = loc.zoom - 1;
            $timeout(function() {
                $scope.center.zoom++;
            });*/
        });
        requestVenues();
    }

    //give sometime for router to get url and transfer it to location
    $timeout(init, 500);
}]);