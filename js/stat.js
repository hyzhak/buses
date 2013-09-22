digiletme.controller('StatisticsCtrl', ['VenuesAPI', '$scope', '$rootScope', function(VenuesAPI, $scope, $rootScope) {
    'use strict';
    $rootScope.$on('changeNumOfRequest', function(e, numOfRequest) {
        $scope.numOfRequest = numOfRequest;
    })
}]);

