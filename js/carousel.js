/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

angular.module('Carousel', []).directive('carousel', ['$window', '$timeout',
    function ($window, $timeout) {
        'use strict';

        var scrolledLeft = [],
            scrolledRight = [],
            scrollSpeed = 8;

        function startScrollLeft(elm) {
            if (scrolledLeft.indexOf(elm) >= 0) {
                return;
            }
            scrolledLeft.push(elm);
        }

        function stopScrollLeft(elm) {
            var index = scrolledLeft.indexOf(elm);
            scrolledLeft.splice(index, 1);
        }

        function startScrollRight(elm) {
            if (scrolledRight.indexOf(elm) >= 0) {
                return;
            }
            scrolledRight.push(elm);
        }

        function stopScrollRight(elm) {
            var index = scrolledRight.indexOf(elm);
            scrolledRight.splice(index, 1);
        }

        (function updateScroll() {
            var i, count;

            for(i = 0, count = scrolledLeft.length; i < count; i++) {
                scrolledLeft[i].scrollLeft -= scrollSpeed;
            }

            for(i = 0, count = scrolledRight.length; i < count; i++) {
                scrolledRight[i].scrollLeft += scrollSpeed;
            }

            requestAnimFrame(updateScroll);
        })();

        return {
            replace: true,
            restrict: 'E',
            template:       '<div style="position: relative">'+
                            '<a href ng-mousedown="startGoLeft()" ng-mouseup="stopGoLeft()"><div class="carousel-left-arrow" ng-show="useScrollButtons">' +
                                '<span class="glyphicon glyphicon-chevron-left"></span>' +
                            '</div></a>' +
                            '<div class="photos-preview-carousel">' +
                                '<div class="photos-preview-carousel-collection" ng-controller="PhotosPreviewCarouselCtrl">' +
                                    '<div ng-repeat="venueImage in images" class="photo-border">' +
                                        '<div ng-style="getDivStyleFor4SQImg(venueImage, 100, 100)" class="photo-small-preview">' +
                                            '<div class="actions">' +
//                                                '<a href="#!" class="btn btn-primary btn-small"> <span class="glyphicon glyphicon-star"></span></a>' +
                                                '<a href="#!/photos/{{ venue.id }}/{{ venueImage.id }}" class="btn btn-primary btn-small"> <span class="glyphicon glyphicon-zoom-in"></span></a>' +
                                            '</div>'+
                                        '</div>'+
                                    '</div>'+
                                '</div>'+
                            '</div>'+
                            '<a href ng-mousedown="startGoRight()" ng-mouseup="stopGoRight()"><div class="carousel-right-arrow" ng-show="useScrollButtons">' +
                                '<span class="glyphicon glyphicon-chevron-right"></span>' +
                            '</div></a>'+
                            '</div>'
            ,
            link: function (scope, elm, attrs) {
                scope.venue = scope.$eval(attrs.venue);
                var photos = scope.$eval(attrs.data);
                photos.then(function(result) {
                    //FIXME: result is undefined ?
                    scope.useScrollButtons = false;
                    scope.images = result;//scope.$eval(attrs.data);
                    scope.elementWidth = 0;

                    $timeout(function() {
                        if (scope.images.length <= 0) {
                            return;
                        }

                        var container = elm[0].children[1].children[0],
                            childElement = elm[0].children[1].children[0].children[0];

                        var availableWidth = elm[0].children[1].clientWidth,
                            marginWidth = 3,//TODO: calc margin width!
                            elementWidth = childElement.clientWidth + 2 * marginWidth,
                            needWidth = scope.images.length * elementWidth;

                        if (needWidth > availableWidth) {
                            //need scroll buttons
                            scope.useScrollButtons = true;
                        } else {
                            //don't need scroll buttons
                            scope.useScrollButtons = false;
                        }

                        container.style.width = needWidth + 'px';

                        scope.elementWidth = elementWidth;
                        scope.scrollContainer = elm[0].children[1];
                    }, 0);

                    scope.startGoLeft = function() {
                        startScrollLeft(scope.scrollContainer);
                    };

                    scope.stopGoLeft = function() {
                        stopScrollLeft(scope.scrollContainer);
                    };

                    scope.startGoRight = function() {
                        startScrollRight(scope.scrollContainer);
                    };

                    scope.stopGoRight = function() {
                        stopScrollRight(scope.scrollContainer);
                    };
                });
            }
        }
    }]);