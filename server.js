const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
  socket.on('createRoom', (roomName) => {
    if (rooms[roomName]) return;
    rooms[roomName] = {
      players: [socket.id],
      ready: 0,
      host: socket.id,
      gameStarted: false,
      ball: { x: 400, y: 250, vx: 5, vy: 3 },
      score: { p1: 0, p2: 0 }
    };
    socket.join(roomName);
    socket.roomName = roomName; // guardar el nombre de la sala
    socket.emit('roomCreated', { roomName, player: 1 });
});

  socket.on('joinRoom', (roomName) => {
    if (!rooms[roomName] || rooms[roomName].players.length >= 2) return;
    rooms[roomName].players.push(socket.id);
    socket.join(roomName);
    socket.roomName = roomName; // guardar el nombre de la sala
    socket.emit('roomCreated', { roomName, player: 2 });
    io.to(roomName).emit('roomReady');
  });

  socket.on('playerReady', (roomName) => {
    const room = rooms[roomName];
    if (!room) return;
    room.ready++;
    if (room.ready === 2 && !room.gameStarted) {
      io.to(room.host).emit('canStartGame');
    }
  });

  socket.on('startGame', (roomName) => {
    const room = rooms[roomName];
    if (!room || socket.id !== room.host || room.gameStarted) return;
    room.gameStarted = true;
    io.to(roomName).emit('startGame', room.ball);
  });

  socket.on('paddleMove', ({ roomName, y }) => {
    const room = rooms[roomName];
    if (!room) return;
    room.players.forEach(pid => {
      if (pid !== socket.id) io.to(pid).emit('opponentMove', y);
    });
  });

  socket.on('ballUpdate', ({ roomName, ball }) => {
    const room = rooms[roomName];
    if (!room || socket.id !== room.host) return;
    room.ball = ball;
    io.to(roomName).emit('ballUpdate', { ball });
  });


  socket.on('goalScored', ({ roomName, scorer }) => {
    const room = rooms[roomName];
    if (!room) return;

    room.score[scorer]++; // Actualiza el score en el servidor
    io.to(roomName).emit('scoreUpdate', room.score); // Manda a todos
});


  socket.on('restartGame', (roomName) => {
    const room = rooms[roomName];
    if (!room || socket.id !== room.host) return;
    room.gameStarted = false;
    room.ball = { x: 400, y: 250, vx: 5, vy: 3 };
    room.score = { p1: 0, p2: 0 };
    io.to(roomName).emit('resetGame', { ball: room.ball, score: room.score }); 
    io.to(roomName).emit('startCountdown');
  });

  socket.on('disconnect', () => {
    for (const roomName in rooms) {
      const room = rooms[roomName];
      const index = room.players.indexOf(socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomName).emit('playerLeft');
        delete rooms[roomName];
        break;
      }
    }
  });

  socket.on('gameOver', ({ roomName, winner }) => {
    const room = rooms[roomName];
    if (!room) return;
    room.gameStarted = false;
    io.to(roomName).emit('showGameOver', winner); 
  });
  

  socket.on('startCountdown', (roomName) => {
    // Enviar a todos en la sala que arranque el contador
    io.to(roomName).emit('startCountdown');
  });
  
  socket.on('countdownFinished', (roomName) => {
    const room = rooms[roomName];
    if (!room) return;
    room.gameStarted = true;
    io.to(roomName).emit('startGame', room.ball); // Manda el estado inicial de la pelota
});


});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});




