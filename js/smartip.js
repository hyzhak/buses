angular.module('SmartIP', [])
    .factory('SmartIP', ['$http', '$q', '$resource', '$rootScope', '$timeout', function($http, $q, $resource, $rootScope, $timeout) {
        'use strict';

        var api = {};

        api.getUserInfo = function() {
            return $http.jsonp('http://smart-ip.net/geoip-json/?callback=JSON_CALLBACK').then(function(responce, status, headers, config) {
                // this callback will be called asynchronously
                // when the response is available
                return responce.data;
            })
        };

        api.getUserLocation = function() {
            return api.getUserInfo().then(function(info) {
                return {
                    lat: Number(info.latitude),
                    lng: Number(info.longitude)
                }
            });
        };

        return api;
    }]);