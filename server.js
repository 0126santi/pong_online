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
      score: { p1: 0, p2: 0 },
      leftPaddleY: 200,
      rightPaddleY: 200
    };
    socket.join(roomName);
    socket.roomName = roomName;
    socket.emit('roomCreated', { roomName, player: 1 });
  });

  socket.on('joinRoom', (roomName) => {
    if (!rooms[roomName] || rooms[roomName].players.length >= 2) return;
    rooms[roomName].players.push(socket.id);
    socket.join(roomName);
    socket.roomName = roomName;
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
    const isHost = socket.id === room.host;
    if (isHost) room.leftPaddleY = y;
    else room.rightPaddleY = y;

    room.players.forEach(pid => {
      if (pid !== socket.id) io.to(pid).emit('opponentMove', y);
    });
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
    io.to(roomName).emit('startCountdown');
  });

  socket.on('countdownFinished', (roomName) => {
    const room = rooms[roomName];
    if (!room) return;
    room.gameStarted = true;
    io.to(roomName).emit('startGame', room.ball);
  });
});

// 🔁 Movimiento de la pelota desde el servidor (tick de física)
setInterval(() => {
  for (const roomName in rooms) {
    const room = rooms[roomName];
    if (!room.gameStarted) continue;

    let ball = room.ball;
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y <= 0 || ball.y >= 490) ball.vy *= -1;

    const leftY = room.leftPaddleY;
    const rightY = room.rightPaddleY;

    if (ball.x <= 20 && ball.y >= leftY && ball.y <= leftY + 100) ball.vx *= -1.05;
    if (ball.x >= 770 && ball.y >= rightY && ball.y <= rightY + 100) ball.vx *= -1.05;

    if (ball.x <= 0) {
      room.score.p2++;
      room.ball = { x: 400, y: 250, vx: 5, vy: 3 };
    }

    if (ball.x >= 800) {
      room.score.p1++;
      room.ball = { x: 400, y: 250, vx: -5, vy: 3 };
    }

    io.to(roomName).emit('ballUpdate', { ball: room.ball });
    io.to(roomName).emit('scoreUpdate', room.score);

    if (room.score.p1 >= 5 || room.score.p2 >= 5) {
      const winner = room.score.p1 >= 5 ? 1 : 2;
      room.gameStarted = false;
      io.to(roomName).emit('showGameOver', winner);
    }
  }
}, 1000 / 60); // 60 fps




