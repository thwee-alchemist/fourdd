#!/usr/bin/env node

const express = require('express');

const app = express();
const yargs = require('yargs')
const bodyParser = require('body-parser')
const favicon = require('serve-favicon')
const path = require('path')

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

const argv = yargs
  .option('host', {
    description: 'specifies the host to bind to',
    type: 'string'
  })
  .option('port', {
    alias: 'p',
    description: 'specifies to port to listen on',
    type: 'number'
  })
  .option('catchup', {
    alias: 'c',
    description: 'whether to catch connecting clients up on missed history.',
    type: 'boolean',
    default: true
  })
  .help()
  .alias('help', 'h')
  .argv;

var host = argv.host;
var port = argv.port;

app.set('view engine', 'ejs');

app.use('/', express.static('public'));

app.use(bodyParser.urlencoded({extended: false}))

const server = app.listen(port, host, function(){
  var port = server.address().port;
  var host = server.address().host;
  console.log(`Listening on ${host}:${port}`);
})

const io = require('socket.io')(server);

class FunctionCall {
  constructor(fn, inverse, ...args){
    this.fn = fn,
    this.args = args;
    this.inverse = inverse;
  }

  async execute(socket, replay=false){
    this.result = await this.fn(socket, replay, ...this.args);
    return this.result;
  }

  /*
  undo(history){
    history.unshift(new FunctionalCall(this.inverse, this.fn, ...this.result));
    return this.history[0].execute();
  }
  */
}


let add_vertex = async function(socket, replay, options, g){
  socket.emit('add vertex', replay, options);
  return g.vertexId++;
}

let add_edge = async function(socket, replay, a, b, options, g){
  socket.emit('add edge', replay, a, b, options);
  let id = g.edgeId++;
  return id;
}

let remove_vertex = async function(socket, replay, id, g){
  socket.emit('remove vertex', replay, id);
  return id;
}

let remove_edge = async function(socket, replay, id, g){
  socket.emit('remove edge', replay, id);
  return id;
}

let select = async function(socket, replay, id, options, g){
  socket.emit('select', replay, id, options);
  g.edgeId++
  return g.vertexId++;
}

let unselect = async function(socket, replay, id, g){
  socket.emit('remove vertex', replay, id)
  return false;
}

let message = async function(socket, replay, msg, g){
  socket.emit('message', replay, msg);
  return true;
}

let camera_vertex = async function(socket, replay, g){
  socket.emit('camera vertex', replay);
  return g.vertexId++;
}

let look_at = async function(socket, replay, id, g){
  socket.emit('look at', replay, id)
  return id;
}

class Recorder {
  constructor(io){
    this.io = io;
    this.history = [];
    this.vertexId = 0;
    this.edgeId = 0;
  }

  async add_vertex(replay, options){
    this.history.unshift(new FunctionCall(add_vertex, remove_vertex, options, this));
    return await this.history[0].execute(this.io, replay);
  }

  async add_edge(replay, a, b, options){
    this.history.unshift(new FunctionCall(add_edge, remove_edge, a, b, options, this));
    return await this.history[0].execute(this.io, replay);
  }

  async remove_vertex(replay, id){
    var inverse = this.history.find(fnc => fnc.fn == add_vertex && fnc.result == id);
    this.history.unshift(new FunctionCall(remove_vertex, inverse, id, this));
    return await this.history[0].execute(this.io, replay);
  }

  async remove_edge(replay, id){
    var inverse = this.history.find(fnc => fnc.fn == add_edge && fnc.result == id);
    this.history.unshift(new FunctionCall(remove_edge, inverse, id, this));
    return await this.history[0].execute(this.io, replay);
  }

  clear(){
    this.io.emit('clear');
    delete this.history;
    this.history = [];
    this.edgeId = 0;
    this.vertexId = 0;

  }

  // next: room.of(...)

  async camera_vertex(socket, replay){
    this.history.unshift(new FunctionCall(camera_vertex, null, this));
    return await this.history[0].execute(this.io, replay)
  }

  async look_at(socket, replay, id){
    this.history.unshift(new FunctionCall(lookAt, null, id));
    return await this.history[0].execute(this.io, replay);
  }
}

const graphs = new Map();

// handle incoming connections from clients
io.on('connection', function(socket) {
  socket.emit('sheetId?');

  // once a client has connected, we expect to get a ping from them saying what room they want to join
  socket.on('sheetId', sheetId => {
    socket.join(`${sheetId}`);

    if(!graphs.has(sheetId)){
      var room = io.to(`${sheetId}`);
      socket.join(sheetId);
      graphs.set(sheetId, new Recorder(room));
    }else{
      if(argv.catchup){
        var caretaker = graphs.get(sheetId);
        caretaker.history.slice(0).reverse().forEach(command => {
          command.execute(socket)
        });
      }
    }
  });
});

app.post('/graph/add_vertex', async (req, res) => {

  console.log('add_vertex', req.body)
  let options = {
    cube: {
      size: req.body.cube_size ? parseInt(req.body.cube_size) : null,
      texture: req.body.cube_texture ? req.body.cube_texture : null,
      color: req.body.cube_color ? req.body.cube_color : null
    },
    label: {
      size: req.body.label_size ? parseInt(req.body.label_size) : null,
      text: req.body.label_text ? req.body.label_text : null,
      offset: req.body.label_offset ? parseInt(req.body.label_offset) : null,
      color: req.body.label_color ? req.body.label_color : null
    }
  }

  if(!options.cube.texture){
    delete options.cube.texture
  }

  if(options.cube.size == 0 || (options.cube.color === undefined && !options.cube.texture)){
    delete options.cube;
  }

  if(!options.label.size || !options.label.text){
    delete options.label;
  }

  let replay = false;
  try{
    var caretaker = graphs.get(req.body.sheetId);
    let id = await caretaker.add_vertex(replay, options);
    res.json(id);
  }catch(e){
    res.json("Please open the graph, first")
  }
})

app.post('/graph/add_edge', async (req, res) => {
  let replay = false;

  let a = parseInt(req.body.a);
  let b = parseInt(req.body.b);
  let arrow = req.body.arrow;
  let color = req.body.color;
  let opacity = req.body.opacity;
  
  let options = null;
  options = {
    'arrow': arrow,
    'color': color,
    'opacity': opacity
  }

  try{
    var caretaker = graphs.get(req.body.sheetId);
    let id = await caretaker.add_edge(replay, a, b, options);
    res.json(id);
  }catch(e){
    res.json("Please open the graph first")
  }
})

app.post('/graph/remove_edge', async (req, res) => {
  let replay = false;
  let id = parseInt(req.body.id);

  try{
    var caretaker = graphs.get(req.body.sheetId);
    var _ = await caretaker.remove_edge(replay, id);
    res.json(id)
  }catch(e){
    res.json("Please open the graph first");
  }
})

app.post('/graph/remove_vertex', async (req, res) => {
  let replay = false;
  let id = parseInt(req.body.id);

  try{
    var caretaker = graphs.get(req.body.sheetId);
    var _ = await caretaker.remove_vertex(replay, id);
    res.json(id)
  }catch(e){
    res.json("Please open the graph first")
  }
})

app.post('/graph/clear', (req, res) => {
  try{
    var caretaker = graphs.get(req.body.sheetId);
    caretaker.clear();

    res.json(true)
  }catch(e){
    res.json("Please open the graph first");
  }
})

app.post('/save', (req, res) => {
/*
  saving the graph would be iterating over the list and checking which
  add vertex functions don't have a remove vertex, then using that 
  function call's return value id.
*/
})



/*
app.post('/look_at', async(req, res) => {
  let replay = false;
  let targetId = req.body.id;
  let id = await caretaker.look_at(io, replay, targetId);
  res.json(id);
})

*/

module.exports = server;
