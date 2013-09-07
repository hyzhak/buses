/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

digiletme.controller('PhotoCtrl', ['VenuesAPI', 'FourSquarePhotos', '$scope', '$routeParams', '$location', '$timeout', function(VenuesAPI, FourSquarePhotos, $scope, $routeParams, $location, $timeout) {
    'use strict';
    var x = 0,
        y = 0,
        startX = 0,
        startY = 0,
        newX = 0,
        newY = 0,
        scale = 1,
        deltaX = 0,
        deltaY = 0,
        imageCenterX = 0,
        imageCenterY = 0,
        image = new Image(),
        backgroundColor = '#222';

    //$scope.url = VenuesAPI.getPhotoUrlById($routeParams.photoId);
    FourSquarePhotos.getPhotoUrlById($routeParams.venueId, $routeParams.photoId).then(function(url) {

        $scope.url = url;

        if ($scope.url === '') {
            $location.path('');
        }

        $scope.close = function() {
            $location.path('');
        };

        $scope.onTapImage = function(e) {
            $scope.close();
        };

        $scope.onDragImageStart = function(e) {
            e.gesture.preventDefault();
            startX = x;
            newX = x;
            startY = y;
            newY = y;
        };

        $scope.onDragImage = function(e) {
            e.gesture.preventDefault();

            if (window.innerWidth < image.width * scale) {
                newX = clamp(startX + e.gesture.deltaX, window.innerWidth - image.width - (imageCenterX - image.width) *  (1 - scale), (imageCenterX - image.width) *  (1 - scale));
            }

            if (window.innerHeight < image.height * scale) {
                newY = clamp(startY + e.gesture.deltaY, window.innerHeight - image.height - (imageCenterY - image.height) *  (1 - scale), (imageCenterY - image.height) *  (1 - scale));
            }

            setPosition(newX, newY, scale);
        };

        $scope.onDragImageEnd = function(e) {
            e.gesture.preventDefault();
            x = newX;
            y = newY;
        };

        $scope.onTransformStart = function(e) {
            deltaX = imageCenterX - e.gesture.center.pageX + x;
            deltaY = imageCenterY - e.gesture.center.pageY + y;
        };

        $scope.onTransform = function(e) {
            var localScale = scale * e.gesture.scale,
                deltaScale = e.gesture.scale - 1;
            setPosition(x + deltaX * deltaScale, y + deltaY * deltaScale, localScale);
            e.gesture.preventDefault();
        };

        $scope.onTransformEnd = function(e) {
            var localScale = scale * e.gesture.scale,
                deltaScale = e.gesture.scale - 1;
            scale = localScale;
            x = x + deltaX * deltaScale;
            y = y + deltaY * deltaScale;
            setPosition(x, y, scale);
        };

        $scope.onMouseDown = function($event) {
            $event.preventDefault();
            return false;
        };

        //http://loadinfo.net/
        $scope.imageBgStyle = {
            width: '100%',
            height: '100%',
            background: backgroundColor + ' url("img/loading.gif") no-repeat',
            backgroundPosition: 'center center'
        };

        image.src = $scope.url;
        image.onload = function() {
            imageCenterX = 0.5 * image.width;
            imageCenterY = 0.5 * image.height;
            x = 0.5 * (window.innerWidth - image.width);
            y = 0.5 * (window.innerHeight - image.height);
            $scope.$apply(function() {
                $scope.imageBgStyle = {
                    cursor: 'move',
                    width: '100%',
                    height: '100%',
                    background: backgroundColor + ' no-repeat'
                    //background: backgroundColor + ' url("' + $scope.url + '") no-repeat'
                    //backgroundPosition: 'center center'
                };

                $scope.imageSrc = $scope.url;

                setPosition(x, y, scale);
            });
        };

        var getImageView = (function() {
            var imageView = document.querySelector('#imageView');
            return function() {
                if (imageView) {
                    return imageView;
                }
                imageView = document.querySelector('#imageView');
                return imageView;
            }
        })();

        function setPosition(x, y, scale) {
            /*$scope.imageStyle = {
                left: x + 'px',
                top: y + 'px'
            };*/


            if (getImageView()) {
                var transform = 'rotateZ(0) translateX(' + ~~x + 'px) translateY(' + ~~y + 'px) scale(' + scale + ')';
                getImageView().style.webkitTransform = transform;
            }
        }

        /*function updatePosition() {
            var t = 0.001 * Date.now();
            setPosition(100*Math.cos(t), 100*Math.sin(t))
            $timeout(updatePosition, 1000/60);
        }

        updatePosition();*/

        function clamp(value, min, max) {
            if (value < min) {
                return min;
            } else if (value > max) {
                return max;
            } else {
                return value;
            }
        }
    });
}]);