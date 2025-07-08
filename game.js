document.addEventListener('DOMContentLoaded', () => {
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 40;
const ROWS = 15;
const COLS = 15;

const COLORS = {
  wall: "#444",
  path: "#eee",
  exit: "#0f0",
  player: "#00f",
  ai1: "#f00",
  ai2: "#ff0"
};

let arena;
let player, ai1, ai2, characters;
let gameState = 'start'; // 'start', 'playing', 'end'
let winner = null;
let loop = null;
let playAgainHover = false;

// Load images for players using actual filenames
const images = {
  player: new Image(),
  ai1: new Image(),
  ai2: new Image(),
  ai3: new Image(),
  ai4: new Image(),
  ai5: new Image()
};
images.player.src = 'assets/succint_advaith.png';
images.ai1.src = 'assets/succint_crashout.png';
images.ai2.src = 'assets/succint_crlaze.png';
images.ai3.src = 'assets/succint_oluseyi.png';
images.ai4.src = 'assets/succint_pix.png';
images.ai5.src = 'assets/succint_zksybil.png';

// Add key image
const keyImg = new Image();
keyImg.src = 'assets/key.jpg'; // Use the jpg file for the key

// Add exit image
const exitImg = new Image();
exitImg.src = 'assets/succinct-logo2.png';

// Wait for all images to load before rendering
let imagesLoaded = 0;
const totalImages = Object.keys(images).length;
for (let key in images) {
  images[key].onload = () => {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
      render();
    }
  };
}

// Map image keys to display names
const imageNames = {
  player: 'advaith',
  ai1: 'crashout',
  ai2: 'crlaze',
  ai3: 'oluseyi',
  ai4: 'pix',
  ai5: 'zksybil'
};

function generateMaze(rows, cols) {
  // Initialize all walls
  let maze = Array.from({length: rows}, () => Array(cols).fill(0));
  // Carve out maze using randomized DFS
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function carve(x, y) {
    maze[y][x] = 1;
    const dirs = shuffle([[0,1],[0,-1],[1,0],[-1,0]]);
    for (const [dx, dy] of dirs) {
      const nx = x + dx*2, ny = y + dy*2;
      if (nx >= 1 && nx < cols-1 && ny >= 1 && ny < rows-1 && maze[ny][nx] === 0) {
        maze[y+dy][x+dx] = 1;
        carve(nx, ny);
      }
    }
  }
  // Start carving from (1,1)
  carve(1,1);
  // Ensure start is open and not surrounded by walls
  maze[1][1] = 1;
  if (maze[1][2] === 0) maze[1][2] = 1;
  if (maze[2][1] === 0) maze[2][1] = 1;
  // Find all edge path cells (not at start)
  let edgePaths = [];
  for (let x = 1; x < cols-1; x++) {
    if (maze[0][x] === 1) edgePaths.push([x,0]);
    if (maze[rows-1][x] === 1) edgePaths.push([x,rows-1]);
  }
  for (let y = 1; y < rows-1; y++) {
    if (maze[y][0] === 1) edgePaths.push([0,y]);
    if (maze[y][cols-1] === 1) edgePaths.push([cols-1,y]);
  }
  if (edgePaths.length === 0) {
    // Forcibly carve a path to a random edge
    let edges = [];
    for (let x = 1; x < cols-1; x++) {
      edges.push([x,0]);
      edges.push([x,rows-1]);
    }
    for (let y = 1; y < rows-1; y++) {
      edges.push([0,y]);
      edges.push([cols-1,y]);
    }
    let [ex, ey] = edges[Math.floor(Math.random()*edges.length)];
    // Carve a straight path from (1,1) to (ex,ey)
    let cx = 1, cy = 1;
    while (cx !== ex || cy !== ey) {
      if (cx < ex) cx++;
      else if (cx > ex) cx--;
      else if (cy < ey) cy++;
      else if (cy > ey) cy--;
      maze[cy][cx] = 1;
    }
    maze[ey][ex] = 2;
  } else {
    // Pick a random edge path for exit, not at (1,1)
    let [ex, ey] = edgePaths[Math.floor(Math.random()*edgePaths.length)];
    maze[ey][ex] = 2;
  }
  return maze;
}

let keyPos = null;

function resetCharacters() {
  // Generate a new maze every time
  arena = generateMaze(ROWS, COLS);
  // Place the key at a random path tile (not player, AIs, or exit)
  let pathTiles = [];
  for (let y = 1; y < ROWS-1; y++) {
    for (let x = 1; x < COLS-1; x++) {
      if (arena[y][x] === 1 && !(x === 1 && y === 1)) pathTiles.push([x, y]);
    }
  }
  // Remove exit position from possible key positions
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (arena[y][x] === 2) {
        pathTiles = pathTiles.filter(([px, py]) => !(px === x && py === y));
      }
    }
  }
  // Remove AI positions from possible key positions
  let aiKeys = ['ai1', 'ai2', 'ai3'];
  let ais = [];
  for (let i = 0; i < aiKeys.length; i++) {
    let idx = Math.floor(Math.random()*pathTiles.length);
    let [aix, aiy] = pathTiles[idx];
    pathTiles.splice(idx,1);
    ais.push(new Character(aix, aiy, aiKeys[i], imageNames[aiKeys[i]]));
  }
  // Now pick a random tile for the key
  let keyIdx = Math.floor(Math.random()*pathTiles.length);
  keyPos = pathTiles[keyIdx];
  arena[keyPos[1]][keyPos[0]] = 4; // 4 = key
  // Place player
  player = new Character(1, 1, 'player', imageNames['player']);
  player.hasKey = false;
  characters = [player, ...ais];
}

class Character {
  constructor(x, y, imgKey, name) {
    this.x = x;
    this.y = y;
    this.imgKey = imgKey;
    this.name = name;
    this.hasKey = false;
  }

  move(dx, dy) {
    const newX = this.x + dx;
    const newY = this.y + dy;
    if (newX >= 0 && newX < COLS && newY >= 0 && newY < ROWS) {
      if (arena[newY][newX] !== 0) {
        this.x = newX;
        this.y = newY;
        // If player and on key, collect it
        if (this === player && arena[newY][newX] === 4) {
          this.hasKey = true;
          arena[newY][newX] = 1;
        }
      }
    }
  }

  draw() {
    ctx.drawImage(images[this.imgKey], this.x * TILE_SIZE, this.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }
}

function drawPinkGridBG() {
  // Draw a grid of alternating pink shades
  const shades = ['#ffb6d5', '#ff69b4', '#ff8fcf', '#ff4fa3'];
  const gridSize = 40; // match TILE_SIZE
  for (let y = 0; y < canvas.height; y += gridSize) {
    for (let x = 0; x < canvas.width; x += gridSize) {
      let idx = ((x/gridSize) + (y/gridSize)) % shades.length;
      ctx.fillStyle = shades[idx];
      ctx.fillRect(x, y, gridSize, gridSize);
    }
  }
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function drawEndScreen() {
  if (dpad) dpad.style.display = 'none';
  // Draw a vibrant gradient background
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#0a0847'); // dark blue
  grad.addColorStop(0.3, '#ff69b4'); // pink
  grad.addColorStop(0.6, '#a0005a'); // dark pink
  grad.addColorStop(1, '#ff3576'); // pink/red
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Confetti effect (simple colored circles)
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(Math.random()*canvas.width, Math.random()*canvas.height/2, 6+Math.random()*8, 0, 2*Math.PI);
    ctx.fillStyle = `hsl(${Math.random()*360},90%,70%)`;
    ctx.globalAlpha = 0.5 + Math.random()*0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Centering calculations
  const centerY = canvas.height / 2;
  const imgY = centerY - 110;
  const textY = imgY + 110;
  const btnY = textY + 40;
  const btnH = 70;
  const btnX = canvas.width/2-110, btnW = 220, radius = 30;

  // Winner's pfp
  let winnerChar = characters.find(c => c.name === winner);
  let winnerImg = winnerChar ? images[winnerChar.imgKey] : null;
  if (winnerImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width/2, imgY + 48, 48, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(winnerImg, canvas.width/2-48, imgY, 96, 96);
    ctx.restore();
  }

  // Winner name
  ctx.font = 'bold 36px Arial Black, Arial, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 10;
  ctx.fillText(`${capitalizeFirst(winner)} wins!`, canvas.width/2, textY);
  ctx.shadowBlur = 0;

  // Stylish Play Again Button
  // Animate scale and glow on hover
  let btnScale = playAgainHover ? 1.12 : 1;
  let btnGlow = playAgainHover ? 40 : 20;
  ctx.save();
  ctx.translate(canvas.width/2, btnY+btnH/2);
  ctx.scale(btnScale, btnScale);
  ctx.translate(-canvas.width/2, -(btnY+btnH/2));
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX+btnW, btnY+btnH);
  btnGrad.addColorStop(0, '#ff69b4');
  btnGrad.addColorStop(0.5, '#00bfff');
  btnGrad.addColorStop(1, '#00ff7f');
  ctx.beginPath();
  ctx.moveTo(btnX+radius, btnY);
  ctx.lineTo(btnX+btnW-radius, btnY);
  ctx.quadraticCurveTo(btnX+btnW, btnY, btnX+btnW, btnY+radius);
  ctx.lineTo(btnX+btnW, btnY+btnH-radius);
  ctx.quadraticCurveTo(btnX+btnW, btnY+btnH, btnX+btnW-radius, btnY+btnH);
  ctx.lineTo(btnX+radius, btnY+btnH);
  ctx.quadraticCurveTo(btnX, btnY+btnH, btnX, btnY+btnH-radius);
  ctx.lineTo(btnX, btnY+radius);
  ctx.quadraticCurveTo(btnX, btnY, btnX+radius, btnY);
  ctx.closePath();
  ctx.fillStyle = btnGrad;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = btnGlow;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // Button text
  ctx.save();
  ctx.font = 'bold 32px Arial Black, Arial, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 10;
  ctx.fillText('PLAY AGAIN', canvas.width/2, btnY+btnH/2+12);
  ctx.restore();
}

function drawArena() {
  drawPinkGridBG();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = arena[y][x];
      let color = COLORS.path;
      if (tile === 0) color = COLORS.wall;
      ctx.fillStyle = color;    
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      // Draw exit image
      if (tile === 2) {
        ctx.drawImage(exitImg, x * TILE_SIZE + 4, y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      }
      // Draw key
      if (tile === 4) {
        ctx.drawImage(keyImg, x * TILE_SIZE + 8, y * TILE_SIZE + 8, TILE_SIZE - 16, TILE_SIZE - 16);
      }
      // Draw outline for clarity
      ctx.strokeStyle = '#000';
      ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

function findExit() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (arena[y][x] === 2) return {x, y};
    }
  }
  return null;
}

function bfs(start, goal) {
  const queue = [[start]];
  const visited = Array.from({length: ROWS}, () => Array(COLS).fill(false));
  visited[start.y][start.x] = true;
  const dirs = [ [0,1], [0,-1], [1,0], [-1,0] ];
  while (queue.length > 0) {
    const path = queue.shift();
    const {x, y} = path[path.length-1];
    if (x === goal.x && y === goal.y) return path;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !visited[ny][nx] && arena[ny][nx] !== 0) {
        visited[ny][nx] = true;
        queue.push([...path, {x: nx, y: ny}]);
      }
    }
  }
  return null;
}

function aiMove(ai) {
  // 95% chance to make a random move
  if (Math.random() < 0.95) {
    const directions = [ [0,1], [0,-1], [1,0], [-1,0] ];
    for (let i = 0; i < 4; i++) {
      const [dx, dy] = directions[Math.floor(Math.random() * directions.length)];
      const newX = ai.x + dx;
      const newY = ai.y + dy;
      if (newX >= 0 && newX < COLS && newY >= 0 && newY < ROWS && arena[newY][newX] !== 0) {
        ai.x = newX;
        ai.y = newY;
        return;
      }
    }
  }
  // Otherwise, use pathfinding
  const exit = findExit();
  if (!exit) return;
  const path = bfs({x: ai.x, y: ai.y}, exit);
  if (path && path.length > 1) {
    // Move one step along the path
    const next = path[1];
    ai.x = next.x;
    ai.y = next.y;
    return;
  }
}

function checkWin() {
  for (const c of characters) {
    if (arena[c.y][c.x] === 2) {
      if (c === player) {
        if (player.hasKey) return c.name;
      } else {
        return c.name;
      }
    }
  }
  return null;
}

function drawGame() {
  drawArena();
  for (const c of characters) c.draw();
}

function gameLoop() {
  if (gameState !== 'playing') return;
  drawGame();
  // Move all AIs (skip player at index 0)
  for (let i = 1; i < characters.length; i++) {
    aiMove(characters[i]);
  }
  winner = checkWin();
  if (winner) {
    gameState = 'end';
    clearInterval(loop);
    drawEndScreen();
  }
}

function render() {
  if (imagesLoaded < totalImages) return;
  if (gameState === 'start') {
    // Remove or comment out the old drawStartScreen and its references in render()
  } else if (gameState === 'playing') drawGame();
  else if (gameState === 'end') drawEndScreen();
}

function isMobileViewport() {
  return window.innerWidth <= 700;
}

// Update click and mousemove area for new button size and position
canvas.addEventListener('mousemove', function(e) {
  if (gameState !== 'end') return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const centerY = canvas.height / 2;
  const imgY = centerY - 110;
  const textY = imgY + 110;
  const btnY = textY + 40;
  const btnX = canvas.width/2-110, btnW = 220, btnH = 70;
  const inside = mx >= btnX && mx <= btnX+btnW && my >= btnY && my <= btnY+btnH;
  if (inside !== playAgainHover) {
    playAgainHover = inside;
    render();
  }
});
canvas.addEventListener('mouseleave', function(e) {
  if (gameState !== 'end') return;
  if (playAgainHover) {
    playAgainHover = false;
    render();
  }
});

// Play Again button click handler (inside DOMContentLoaded)
canvas.addEventListener('click', function(e) {
  if (gameState !== 'end') return;
  const rect = canvas.getBoundingClientRect();
  // Map mouse/touch coordinates to canvas coordinates
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const centerY = canvas.height / 2;
  const imgY = centerY - 110;
  const textY = imgY + 110;
  const btnY = textY + 40;
  const btnX = canvas.width/2-110, btnW = 220, btnH = 70;
  if (mx >= btnX && mx <= btnX+btnW && my >= btnY && my <= btnY+btnH) {
    startGame();
  }
});

const welcomeScreen = document.getElementById('welcome-screen');
const startBtn = document.getElementById('start-btn');
const dpad = document.getElementById('dpad-controls');
const body = document.body;

function startGame() {
  resetCharacters();
  gameState = 'playing';
  winner = null;
  if (loop) clearInterval(loop);
  loop = setInterval(gameLoop, 300);
  if (dpad) dpad.style.display = isMobileViewport() ? 'flex' : 'none';
  render();
}

// Hide D-pad on welcome screen
if (dpad) dpad.style.display = 'none';

// Restore Start Game button functionality
if (startBtn) {
  startBtn.onclick = () => {
    welcomeScreen.style.display = 'none';
    canvas.style.display = 'block';
    if (dpad) dpad.style.display = isMobileViewport() ? 'flex' : 'none';
    body.classList.add('pink-grid-bg');
    startGame();
  };
}

// D-pad controls for mobile
if (dpad) {
  dpad.addEventListener('click', function(e) {
    if (gameState !== 'playing') return;
    if (e.target.classList.contains('dpad-btn')) {
      const dir = e.target.getAttribute('data-direction');
      if (dir === 'up') player.move(0, -1);
      if (dir === 'down') player.move(0, 1);
      if (dir === 'left') player.move(-1, 0);
      if (dir === 'right') player.move(1, 0);
      render();
    }
  });
}

window.addEventListener("keydown", e => {
  if (gameState !== 'playing') return;
  if (e.key === "ArrowLeft") player.move(-1, 0);
  if (e.key === "ArrowRight") player.move(1, 0);
  if (e.key === "ArrowUp") player.move(0, -1);
  if (e.key === "ArrowDown") player.move(0, 1);
  render();
});

// Initial setup
resetCharacters();
render();
});

// Listen for window resize to show/hide dpad responsively
window.addEventListener('resize', () => {
  if (gameState === 'playing' && dpad) {
    dpad.style.display = isMobileViewport() ? 'flex' : 'none';
  }
});
