/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

FourSquareModule.factory('FourSquarePhotos', ['FourSquareClient', 'VenuesAPI', '$q', '$resource', '$rootScope', '$timeout', function(FourSquareClient, VenuesAPI, $q, $resource, $rootScope, $timeout) {
        'use strict';

        var api = {},
            isUserLogin = false;

        var Photo = $resource('https://api.foursquare.com/v2/photos/:photoId' +
            '?client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate, {
                clientId: FourSquareClient.CLIENT_ID,
                clientSecret: FourSquareClient.CLIENT_SECRET
            });


        api.getPhotoUrlById = function(venueId, photoId, width, height) {
            var photo = VenuesAPI.getPhotoById(photoId);
            if (photo) {
                return $q.when(concat4SQImg(photo, width, height));
            }

            if (isUserLogin) {
                return Photo.get({
                    photoId: id
                }).$promise.then(function(resource) {
                    return concat4SQImg(resource.response.photo, width, height);
                }, function(error) {
                    console.log('error', error);
                });
            } else {
                return VenuesAPI.getPhotosByVenueId(venueId).then(function(result) {
                    for(var i = 0, count = result.length; i < count; i++) {
                        var photo = result[i];
                        if (photo.id === photoId) {
                            return concat4SQImg(photo, width, height);
                        }
                    }

                    return null;
                });
            }
        };

        function concat4SQImg(icon, width, height) {
            if (!icon || !icon.prefix || !icon.suffix) {
                return '';
            }
            var prefix = icon.prefix.substr(0, icon.prefix.length - 1),
                middle = '',
                suffix = icon.suffix;

            if (width && height) {
                middle = '/' + width + 'x' + height;
            } else {
                middle = '/original';
            }

            return prefix + middle + suffix;
        }

        return api;
    }]);