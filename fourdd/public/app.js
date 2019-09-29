const fourddApp = angular.module('fourddApp', ['ngSanitize']);

fourddApp.controller('fourddCtrl', ['$scope', '$location', function($scope, $location){
  var params = $location.search();
  $scope.sheetId = params.sheet_id;
  $scope.socket = io();

  $scope.socket.on('sheetId?', () => {
    $scope.socket.emit('sheetId', $scope.sheetId);
  })
  
  $scope.fourd = document.querySelector('#graph');

  $scope.socket.on('clear', () => {
    $scope.fourd.clear();
  });

  $scope.socket.on('add vertex', (replay, options) => {
    console.log('add_vertex', replay, options)
    let id = $scope.fourd.add_vertex(options);
    if(!replay){
      $scope.socket.emit('add vertex response', id);
      console.log('add vertex response emitted')
    }
  });

  $scope.socket.on('add edge', (replay, a, b, options) => {
    console.log('add_edge', a, b, options);
    let id = $scope.fourd.add_edge(a, b, options)

    if(!replay){
      $scope.socket.emit('add edge response', id);
    }
  });

  $scope.socket.on('remove vertex', (replay, id) => {
    $scope.fourd.remove_vertex(id);
    if(!replay){
      $scope.socket.emit('remove vertex response', id);
    }
  });

  $scope.socket.on('remove edge', (replay, id) => {
    $scope.fourd.remove_edge(id);
    if(!replay){
      $scope.socket.emit('edge removed', id);
    }
  });

  $scope.socket.on('clear', () => {
    $scope.fourd.graph.clear();
    $scope.socket.emit('cleared');
  })

  $scope.socket.on('look at', (replay, targetId) => {
    $scope.fourd.graph.look_at(targetId);
  })
}])

fourddApp.config(['$locationProvider', function($locationProvider) {
  $locationProvider.html5Mode(true);
}]);