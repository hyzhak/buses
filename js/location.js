angular.module('Location', []).factory('Location', ['SmartIP', '$q', '$rootScope', '$location', function(SmartIP, $q, $rootScope, $location) {
   'use strict';
    var api = {},
        loc;

    /**
     * get current user geolocation
     *
     * @returns {Promise}
     */
    api.getLocation = function() {
        if (loc) {
            return $q.when(loc);
        } else {
            return api.requestMyLocation();
        }
    };

    /**
     * request my location by smartip and fallback to location by GPS
     *
     * @returns {Promise}
     */
    api.requestMyLocation = function() {
        return SmartIP.getUserLocation().then(function(loc) {
            api.setLocation(loc.lat, loc.lng);
            return loc;
        }, function(error) {
            console.log(error);
            return api.requestLocationFromGPS().then(function(pos) {
                var c = pos.coords;

                return {
                    lat: c.latitude,
                    lng: c.longitude
                };
            });
        });
    };

    /**
     * request location through GPS
     *
     * @return {*}
     */
    api.requestLocationFromGPS = (function() {
        return function () {
            var defer = $q.defer();

            navigator.geolocation.getCurrentPosition(function (pos) {
                var c = pos.coords;

                api.setLocation(c.latitude, c.longitude);
                defer.resolve(pos);
                $rootScope.$digest();
            }, function(error) {
                console.log(error);
                defer.reject(error);
            });

            return defer.promise;
        }
    })();

    /**
     * update current user geolocation
     *
     * @param {number} lat
     * @param {number} lng
     * @param {number} [zoom]
     */
    api.setLocation = function(lat, lng, zoom) {
        loc = loc || {};
        zoom = Number(zoom || loc.zoom || 10);

        if (loc.lat === lat
            && loc.lng === lng
            && loc.zoom === zoom) {
            return;
        }

        loc.lat = Number(lat);
        loc.lng = Number(lng);

        loc.zoom = zoom;

        $rootScope.$emit('updateUserLocation', loc);

        $location.path('location/' + zoom + '/' + lat + '/' + lng);
        $location.replace();
    };

    return api;
}]);