const socket = io();
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let room = '', player = 0, isHost = false;
let leftPaddle = { x: 10, y: 200 }, rightPaddle = { x: 780, y: 200 };
let ball = { x: 400, y: 250, vx: 5, vy: 3 };
let ballTarget = { x: 400, y: 250 };
let score = { p1: 0, p2: 0 }, keys = {}, gameRunning = false;
let countdown = 3;
let countdownActive = false;
let countdownInterval;

const interpolationFactor = 0.2;

function createRoom() {
  room = document.getElementById('roomName').value;
  if (room) socket.emit('createRoom', room);
}

function joinRoom() {
  room = document.getElementById('roomName').value;
  if (room) socket.emit('joinRoom', room);
}

function hostStartGame() {
  if (isHost) socket.emit('startCountdown', room);
}

function restartGame() {
  if (isHost) {
    socket.emit('restartGame', room); 
  }
  document.getElementById('gameOver').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
}


function resetGameState() {
  leftPaddle.y = 200;
  rightPaddle.y = 200;
  ball = { x: 400, y: 250, vx: 5, vy: 3 };
  ballTarget = { x: 400, y: 250 };
  score = { p1: 0, p2: 0 };
}

function checkGameOver() {
  if (score.p1 >= 5 || score.p2 >= 5) {
    gameRunning = false;
    const winner = score.p1 >= 5 ? 1 : 2; 
    socket.emit('gameOver', { roomName: room, winner }); 
  }
}

function update() {
  if (!gameRunning) return;

  if (player === 1 && keys['w'] && leftPaddle.y > 0) leftPaddle.y -= 5;
  if (player === 1 && keys['s'] && leftPaddle.y < 400) leftPaddle.y += 5;
  if (player === 2 && keys['ArrowUp'] && rightPaddle.y > 0) rightPaddle.y -= 5;
  if (player === 2 && keys['ArrowDown'] && rightPaddle.y < 400) rightPaddle.y += 5;

  socket.emit('paddleMove', { roomName: room, y: player === 1 ? leftPaddle.y : rightPaddle.y });

  if (isHost) {
    // Ya no hace nada, el servidor se encarga de mover la pelota
  }  
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (countdownActive) {
    drawCountdown(ctx); // Dibujar el contador gigante en el centro
    return; // Mientras el contador esté activo, no seguimos dibujando el juego
  }

  ctx.fillStyle = "white";
  ctx.fillRect(leftPaddle.x, leftPaddle.y, 10, 100);
  ctx.fillRect(rightPaddle.x, rightPaddle.y, 10, 100);
  ctx.fillRect(ball.x, ball.y, 10, 10);
  
  ctx.font = "20px sans-serif";
  ctx.fillText(`Jugador 1: ${score.p1}`, 100, 30);
  ctx.fillText(`Jugador 2: ${score.p2}`, 600, 30);
}


function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function startCountdown() {
  countdown = 3;
  countdownActive = true;

  countdownInterval = setInterval(() => {
      countdown--;
      if (countdown === 0) {
          clearInterval(countdownInterval);
          countdownActive = false;
          socket.emit('countdownFinished', room); // 🔥 PASAR el nombre de la sala acá
      }
  }, 1000);
}


function drawCountdown(ctx) {
  ctx.fillStyle = 'white';
  ctx.font = '80px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(countdown > 0 ? countdown : 'GO!', canvas.width / 2, canvas.height / 2);
}
// SOCKETS

socket.on('roomCreated', ({ roomName, player: p }) => {
  player = p;
  isHost = player === 1;
  document.getElementById('menu').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';

  // Mostrar controles laterales
  document.querySelectorAll('.controles-lateral').forEach(el => {
    el.style.display = 'block';
  });

  socket.emit('playerReady', roomName);
});

socket.on('roomReady', () => {
  socket.emit('playerReady', room);
});

socket.on('canStartGame', () => {
  if (isHost) document.getElementById('startBtn').style.display = 'inline';
});

socket.on('startGame', (initialBall) => {
  ball = initialBall;
  ballTarget = initialBall;
  gameRunning = true;
  document.getElementById('startBtn').style.display = 'none';
});

socket.on('opponentMove', (y) => {
  if (player === 1) rightPaddle.y = y;
  else leftPaddle.y = y;
});

socket.on('ballUpdate', ({ ball: b }) => {
  ballTarget = b;
});

socket.on('scoreUpdate', (s) => {
  score = s;
});

socket.on('resetGame', ({ ball: initialBall, score: initialScore }) => {
  resetGameState();
  ball = initialBall;
  ballTarget = initialBall;
  score = initialScore; 
  gameRunning = false;
  document.getElementById('gameOver').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
});

socket.on('playerLeft', () => {
  alert('El otro jugador salió de la sala.');
  location.reload();
});

socket.on('showGameOver', (winner) => {
  gameRunning = false;
  document.getElementById('gameCanvas').style.display = 'none';
  document.getElementById('gameOver').style.display = 'block';
  const winnerText = winner === 1 ? "¡Jugador 1 gana!" : "¡Jugador 2 gana!";
  document.getElementById('winnerText').innerText = winnerText;
  if (isHost) {
    document.getElementById('startBtn').style.display = 'none';
    document.querySelector('#gameOver button').style.display = 'inline';
  } else {
    document.querySelector('#gameOver button').style.display = 'none';
  }
  document.querySelectorAll('.controles-lateral').forEach(el => {
    el.style.display = 'none';
  });  
});

socket.on('startCountdown', () => {
  startCountdown();
});

socket.on('startGame', () => {
  // Cambias el estado de juego a "playing"
  gameState = "playing"; 
  // Aquí podés también reiniciar posiciones, puntuaciones, etc, si hace falta
});
socket.on('countdownFinished', () => {
  gameRunning = true;
});


document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

loop();


