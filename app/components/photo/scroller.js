(function() {
    angular.module('PlantsApp')
        .controller('ScrollerCtrl', ['$scope', '$ionicModal', ScrollerCtrl]);
    function ScrollerCtrl($scope, $ionicModal) {
        var modal;
        var modalIsConstructed = false;
        $ionicModal.fromTemplateUrl('app/components/photo/scrollerPopover.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function(result) {
            modal = result;
        });
        $scope.showImage = function(index) {
            if (modal) {
                // $scope.slide = index throws an error (later) if modal.show() has never been called
                // Delay changing the slide until after the modal has been shown at least once
                if (modalIsConstructed)
                    $scope.slide = index;
                modal.show().then(function() {
                    $scope.slide = index;
                    modalIsConstructed = true;
                });
            }
        };
        $scope.hideModal = function() {
            if (modal)
                modal.hide();
        };
        $scope.$on('$destroy', function() {
            if (modal)
                modal.remove();
        });
    }
})();
