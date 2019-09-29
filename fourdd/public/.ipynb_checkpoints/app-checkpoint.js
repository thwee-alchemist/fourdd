const fourddApp = angular.module('fourddApp', ['ngSanitize']);

fourddApp.controller('fourddCtrl', ['$scope', function($scope){
  

  var fourd = document.querySelector('#graph');
  console.log(fourd);
  $scope.socket = null
  
  setTimeout(() => {
    $scope.socket = io();

    $scope.socket.on('message', message => {
      $scope.socket.emit('message', message);
    });

    $scope.socket.on('clear', () => {
      fourd.clear();
    });

    $scope.socket.on('add vertex', (replay, options) => {
      console.log('add_vertex', replay, options)
      let id = fourd.add_vertex(options);
      if(!replay){
        $scope.socket.emit('add vertex response', id);
        console.log('add vertex response emitted')
      }
    });

    $scope.socket.on('add edge', (replay, a, b, options) => {
      console.log('add_edge', a, b, options);
      let id = fourd.add_edge(a, b, options)

      if(!replay){
        $scope.socket.emit('add edge response', id);
      }
    });

    $scope.socket.on('remove vertex', (replay, id) => {
      fourd.remove_vertex(id);
      if(!replay){
        $scope.socket.emit('remove vertex response', id);
      }
    });

    $scope.socket.on('remove edge', (replay, id) => {
      fourd.remove_edge(id);
      if(!replay){
        $scope.socket.emit('edge removed', id);
      }
    });

    $scope.socket.on('clear', () => {
      fourd.graph.clear();
      $scope.socket.emit('cleared');
    })

    $scope.socket.on('select', (replay, id, options) => {
      let newId = fourd.select(id, options);
      if(!replay){
        $scope.socket.emit('vertex selected', newId);
      }
    })

    $scope.socket.on('camera vertex', (targetId) => {
      let id = fourd.graph.add_camera_vertex(targetId);

      $scope.socket.emit('camera vertex response', id);
    })

  }, 500)

}])