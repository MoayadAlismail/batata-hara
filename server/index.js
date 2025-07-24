import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';


// Import JSON dictionary using fs.readFileSync for compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ARABIC_WORDS_ARRAY = JSON.parse(
  readFileSync(join(__dirname, 'arabic_dictionary.json'), 'utf8')
);

// Create Set from imported JSON array for O(1) lookup performance
const ARABIC_WORDS_SET = new Set(ARABIC_WORDS_ARRAY);

const app = express();
const server = createServer(app);

// Serve static files from dist folder in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  
  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://batatahara.com", "https://www.batatahara.com"]
      : ["http://localhost:5173", "http://localhost:8080", "http://localhost:8081"],
    methods: ["GET", "POST"]
  }
});

app.use(cors());

// Game state management
const gameRooms = new Map();
const playerSockets = new Map();

// Generate a 6-digit PIN code
function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create a new game room
function createGameRoom(hostSocketId) {
  const pin = generatePIN();
  const gameRoom = {
    pin,
    hostSocketId,
    players: new Map(),
    gameState: 'setup',
    currentPlayerIndex: 0,
    currentCombination: '',
    timeLeft: 10,
    usedWords: new Set(),
    gameSettings: {
      maxPlayers: 8,
      initialLives: 3,
      initialTimer: 10
    },
    createdAt: new Date()
  };
  
  gameRooms.set(pin, gameRoom);
  return gameRoom;
}

// Add player to room
function addPlayerToRoom(pin, socketId, playerName) {
  const room = gameRooms.get(pin);
  if (!room) return null;
  
  if (room.players.size >= room.gameSettings.maxPlayers) {
    return { error: 'Room is full' };
  }
  
  if (Array.from(room.players.values()).some(p => p.name === playerName)) {
    return { error: 'Player name already exists' };
  }
  
  const player = {
    id: Date.now() + Math.random(),
    name: playerName,
    lives: room.gameSettings.initialLives,
    isEliminated: false,
    socketId,
    joinedAt: new Date()
  };
  
  room.players.set(socketId, player);
  playerSockets.set(socketId, pin);
  
  return { player, room };
}

// Remove player from room
function removePlayerFromRoom(socketId) {
  const pin = playerSockets.get(socketId);
  if (!pin) return null;
  
  const room = gameRooms.get(pin);
  if (!room) return null;
  
  room.players.delete(socketId);
  playerSockets.delete(socketId);
  
  // If room is empty, delete it
  if (room.players.size === 0) {
    gameRooms.delete(pin);
    return { roomDeleted: true };
  }
  
  // If host left, assign new host
  if (room.hostSocketId === socketId && room.players.size > 0) {
    const newHost = room.players.keys().next().value;
    room.hostSocketId = newHost;
    return { room, newHost };
  }
  
  return { room };
}

// Get room players as array
function getRoomPlayers(room) {
  return Array.from(room.players.values());
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Create new game room
  socket.on('create-room', (callback) => {
    const gameRoom = createGameRoom(socket.id);
    socket.join(gameRoom.pin);
    
    console.log(`Room created: ${gameRoom.pin} by ${socket.id}`);
    
    callback({
      success: true,
      pin: gameRoom.pin,
      isHost: true
    });
  });
  
  // Join existing game room
  socket.on('join-room', ({ pin, playerName }, callback) => {
    const result = addPlayerToRoom(pin, socket.id, playerName);
    
    if (!result || result.error) {
      callback({
        success: false,
        error: result?.error || 'Room not found'
      });
      return;
    }
    
    socket.join(pin);
    
    // Notify all players in the room
    const players = getRoomPlayers(result.room);
    io.to(pin).emit('players-updated', players);
    io.to(pin).emit('player-joined', {
      player: result.player,
      message: `${playerName} joined the game`
    });
    
    console.log(`${playerName} joined room ${pin}`);
    
    callback({
      success: true,
      player: result.player,
      players: players,
      isHost: result.room.hostSocketId === socket.id,
      gameState: result.room.gameState
    });
  });
  
  // Start game
  socket.on('start-game', ({ pin }, callback) => {
    const room = gameRooms.get(pin);
    if (!room || room.hostSocketId !== socket.id) {
      callback({ success: false, error: 'Not authorized or room not found' });
      return;
    }
    
    if (room.players.size < 2) {
      callback({ success: false, error: 'Need at least 2 players' });
      return;
    }
    
    room.gameState = 'playing';
    room.currentPlayerIndex = 0;
    room.currentCombination = generateCombination();
    room.timeLeft = room.gameSettings.initialTimer;
    room.usedWords.clear();
    
    const players = getRoomPlayers(room);
    const currentPlayer = players[room.currentPlayerIndex];
    
    io.to(pin).emit('game-started', {
      gameState: room.gameState,
      currentPlayer,
      currentCombination: room.currentCombination,
      timeLeft: room.timeLeft,
      players
    });
    
    // Start timer
    startGameTimer(pin);
    
    callback({ success: true });
  });
  
  // Submit word
  socket.on('submit-word', ({ pin, word }, callback) => {
    const room = gameRooms.get(pin);
    if (!room || room.gameState !== 'playing') {
      callback({ success: false, error: 'Game not in playing state' });
      return;
    }
    
    const players = getRoomPlayers(room);
    const currentPlayer = players[room.currentPlayerIndex];
    
    if (currentPlayer.socketId !== socket.id) {
      callback({ success: false, error: 'Not your turn' });
      return;
    }
    
    const isValid = isValidWord(word, room.currentCombination, room.usedWords);
    
    if (isValid) {
      room.usedWords.add(word);
      io.to(pin).emit('word-accepted', {
        word,
        player: currentPlayer,
        usedWords: Array.from(room.usedWords)
      });
      nextTurn(pin);
    } else {
      //loseLife(pin, currentPlayer);
      io.to(pin).emit('word-rejected', {
        word,
        player: currentPlayer,
        reason: getWordRejectionReason(word, room.currentCombination, room.usedWords)
      });
    }
    
    callback({ success: true, isValid });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const result = removePlayerFromRoom(socket.id);
    if (result && !result.roomDeleted) {
      const pin = playerSockets.get(socket.id) || Array.from(gameRooms.keys()).find(p => 
        gameRooms.get(p).players.has(socket.id)
      );
      
      if (pin) {
        const players = getRoomPlayers(result.room);
        io.to(pin).emit('players-updated', players);
        io.to(pin).emit('player-left', {
          socketId: socket.id,
          message: 'A player left the game'
        });
        
        if (result.newHost) {
          io.to(result.newHost).emit('host-changed', { isHost: true });
        }
      }
    }
  });
});

// Game timer management
const gameTimers = new Map();

function startGameTimer(pin) {
  // Clear existing timer
  if (gameTimers.has(pin)) {
    clearInterval(gameTimers.get(pin));
  }
  
  const timer = setInterval(() => {
    const room = gameRooms.get(pin);
    if (!room || room.gameState !== 'playing') {
      clearInterval(timer);
      gameTimers.delete(pin);
      return;
    }
    
    room.timeLeft--;
    
    if (room.timeLeft <= 0) {
      const players = getRoomPlayers(room);
      const currentPlayer = players[room.currentPlayerIndex];
      loseLife(pin, currentPlayer);
    } else {
      io.to(pin).emit('timer-update', { timeLeft: room.timeLeft });
    }
  }, 1000);
  
  gameTimers.set(pin, timer);
}

function loseLife(pin, player) {
  const room = gameRooms.get(pin);
  if (!room) return;
  
  player.lives--;
  if (player.lives <= 0) {
    player.isEliminated = true;
    io.to(pin).emit('player-eliminated', { player });
  }
  
  const players = getRoomPlayers(room);
  const activePlayers = players.filter(p => !p.isEliminated);
  
  if (activePlayers.length <= 1) {
    endGame(pin);
  } else {
    nextTurn(pin);
  }
}

function nextTurn(pin) {
  const room = gameRooms.get(pin);
  if (!room) return;
  
  const players = getRoomPlayers(room);
  
  // Find next active player
  let nextIndex = (room.currentPlayerIndex + 1) % players.length;
  while (players[nextIndex].isEliminated) {
    nextIndex = (nextIndex + 1) % players.length;
  }
  
  room.currentPlayerIndex = nextIndex;
  room.currentCombination = generateCombination();
  room.timeLeft = Math.max(5, room.gameSettings.initialTimer - Math.floor(room.usedWords.size / 5));
  
  const currentPlayer = players[room.currentPlayerIndex];
  
  io.to(pin).emit('turn-changed', {
    currentPlayer,
    currentCombination: room.currentCombination,
    timeLeft: room.timeLeft,
    players
  });
}

function endGame(pin) {
  const room = gameRooms.get(pin);
  if (!room) return;
  
  room.gameState = 'finished';
  
  // Clear timer
  if (gameTimers.has(pin)) {
    clearInterval(gameTimers.get(pin));
    gameTimers.delete(pin);
  }
  
  const players = getRoomPlayers(room);
  const winner = players.find(p => !p.isEliminated);
  
  io.to(pin).emit('game-ended', {
    winner,
    players,
    gameState: room.gameState
  });
}

const TWO_LETTER_COMBINATIONS = [
  'بر', 'تر', 'در', 'كر', 'مر', 'نر', 'هر', 'ير', 'لر', 'سر',
  'بل', 'تل', 'دل', 'كل', 'مل', 'نل', 'هل', 'يل', 'لل', 'سل',
  'بت', 'تت', 'دت', 'كت', 'مت', 'نت', 'هت', 'يت', 'لت', 'ست',
  'بن', 'تن', 'دن', 'كن', 'من', 'نن', 'هن', 'ين', 'لن', 'سن',
  'بم', 'تم', 'دم', 'كم', 'مم', 'نم', 'هم', 'يم', 'لم', 'سم'
];

function generateCombination() {
  const randomIndex = Math.floor(Math.random() * TWO_LETTER_COMBINATIONS.length);
  return TWO_LETTER_COMBINATIONS[randomIndex];
}

function isValidWord(word, combination, usedWords) {
  if (usedWords.has(word)) return false;
  if (!word.includes(combination)) return false;
  return ARABIC_WORDS_SET.has(word);
}

function getWordRejectionReason(word, combination, usedWords) {
  if (usedWords.has(word)) return 'Word already used';
  if (!word.includes(combination)) return `Word must contain "${combination}"`;
  if (!ARABIC_WORDS_SET.has(word)) return 'Word not in dictionary';
  return 'Invalid word';
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 