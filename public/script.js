const socket = io();
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let room = '', player = 0, isHost = false;
let leftPaddle = { x: 10, y: 200 }, rightPaddle = { x: 780, y: 200 };
let ball = { x: 400, y: 250, vx: 5, vy: 3 };
let score = { p1: 0, p2: 0 }, keys = {}, gameRunning = false;
let lastUpdateTime = 0;
const updateInterval = 100; // Enviar datos cada 100 ms

// Interpolación de las palas
let leftPaddleInterp = { y: leftPaddle.y };
let rightPaddleInterp = { y: rightPaddle.y };

function createRoom() {
  room = document.getElementById('roomName').value;
  if (room) socket.emit('createRoom', room);
}

function joinRoom() {
  room = document.getElementById('roomName').value;
  if (room) socket.emit('joinRoom', room);
}

function hostStartGame() {
  socket.emit('startGame', room);
}

function restartGame() {
  if (isHost) socket.emit('restartGame', room);
  document.getElementById('gameOver').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
}

function resetGameState() {
  leftPaddle.y = 200;
  rightPaddle.y = 200;
  ball = { x: 400, y: 250, vx: 5, vy: 3 };
  score = { p1: 0, p2: 0 };
}

function checkGameOver() {
  if (score.p1 >= 5 || score.p2 >= 5) {
    gameRunning = false;
    const winner = score.p1 >= 5 ? 'Jugador 1' : 'Jugador 2';
    socket.emit('gameOver', { roomName: room, winner });
  }
}

function update() {
  const currentTime = Date.now();
  if (currentTime - lastUpdateTime >= updateInterval) {
    if (!gameRunning) return;

    // Lógica de movimiento de las palas
    if ((player === 1 && keys['w']) && leftPaddle.y > 0) leftPaddle.y -= 5;
    if ((player === 1 && keys['s']) && leftPaddle.y < 400) leftPaddle.y += 5;
    if ((player === 2 && keys['ArrowUp']) && rightPaddle.y > 0) rightPaddle.y -= 5;
    if ((player === 2 && keys['ArrowDown']) && rightPaddle.y < 400) rightPaddle.y += 5;

    // Interpolación de las palas
    leftPaddleInterp.y += (leftPaddle.y - leftPaddleInterp.y) * 0.1;
    rightPaddleInterp.y += (rightPaddle.y - rightPaddleInterp.y) * 0.1;

    socket.emit('paddleMove', { roomName: room, y: player === 1 ? leftPaddle.y : rightPaddle.y });
    lastUpdateTime = currentTime;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(leftPaddle.x, leftPaddleInterp.y, 10, 100); // Usar posición interpolada
  ctx.fillRect(rightPaddle.x, rightPaddleInterp.y, 10, 100); // Usar posición interpolada
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

socket.on('roomCreated', ({ roomName, player: p }) => {
  player = p;
  isHost = player === 1;
  document.getElementById('menu').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
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
  gameRunning = true;
  document.getElementById('startBtn').style.display = 'none';
});

socket.on('opponentMove', (y) => {
  if (player === 1) rightPaddle.y = y;
  else leftPaddle.y = y;
});

socket.on('ballUpdate', ({ ball: b, score: s }) => {
  ball = b;
  score = s;
});

socket.on('resetGame', (initialBall) => {
  resetGameState();
  ball = initialBall;
  gameRunning = true;

  // Ocultar pantalla de Game Over y mostrar canvas
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

  // Mostrar el botón de reiniciar solo si es host
  if (isHost) {
    document.getElementById('startBtn').style.display = 'none';
    document.querySelector('#gameOver button').style.display = 'inline';
  } else {
    document.querySelector('#gameOver button').style.display = 'none';
  }
});

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

loop();
