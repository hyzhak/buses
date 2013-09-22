var FourSquareModule = angular.module('FourSquare', []);

FourSquareModule.factory('FourSquareClient', function() {
    function dateToYMD(date) {
        var d = date.getDate();
        var m = date.getMonth() + 1;
        var y = date.getFullYear();
        return '' + y + (m<=9 ? '0' + m : m) + (d <= 9 ? '0' + d : d);
    }

    return {
        currentAPIDate: dateToYMD(new Date()),
        CLIENT_ID: null,
        CLIENT_SECRET: null
    }
});