angular.module('SmartIP', [])
    .factory('SmartIP', ['$http', '$q', '$resource', '$rootScope', '$timeout', function($http, $q, $resource, $rootScope, $timeout) {
        'use strict';

        var api = {},
            userSmartIP = false;

        api.getUserInfo = function() {
            return $http.jsonp('http://smart-ip.net/geoip-json/?callback=JSON_CALLBACK').then(function(responce, status, headers, config) {
                // this callback will be called asynchronously
                // when the response is available
                return responce.data;
            });
        };

        /**
         * request user IP
         * @returns {*}
         */
        api.getUserIP = function() {
            return $http.jsonp('http://jsonip.appspot.com/?callback=JSON_CALLBACK')
                .then(function(responce, status, headers, config) {
                    return responce.data;
                });
        };

        /**
         * get location info by ip
         * @param ip
         */
        api.getLocationInfoByIP = function(ip) {
            return $http.jsonp('http://www.geoplugin.net/json.gp?ip=' + ip + '&jsoncallback=JSON_CALLBACK')
                .then(function(responce, status, headers, config) {
                    return responce.data;
                });
        };

        /**
         * get user location object {lat, lng}
         *
         * @returns {Promise}
         */
        api.getUserLocation = function() {
            if (userSmartIP) {
                return api.getUserInfo().then(function(info) {
                    return {
                        lat: Number(info.latitude),
                        lng: Number(info.longitude)
                    }
                });
            } else {
                return api.getUserIP()
                    .then(function(response) {
                        return api.getLocationInfoByIP(response.ip);
                    }).then(function(response) {
                        return {
                            lat: Number(response.geoplugin_latitude),
                            lng: Number(response.geoplugin_longitude)
                        }
                    });
            }
        };

        return api;
    }]);