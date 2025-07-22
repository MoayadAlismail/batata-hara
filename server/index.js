import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:8080", "http://localhost:8081"],
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
      loseLife(pin, currentPlayer);
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

// Game logic functions
const TWO_LETTER_COMBINATIONS = [
  'بر', 'تر', 'در', 'كر', 'مر', 'نر', 'هر', 'ير', 'لر', 'سر',
  'بل', 'تل', 'دل', 'كل', 'مل', 'نل', 'هل', 'يل', 'لل', 'سل',
  'بت', 'تت', 'دت', 'كت', 'مت', 'نت', 'هت', 'يت', 'لت', 'ست',
  'بن', 'تن', 'دن', 'كن', 'من', 'نن', 'هن', 'ين', 'لن', 'سن',
  'بم', 'تم', 'دم', 'كم', 'مم', 'نم', 'هم', 'يم', 'لم', 'سم'
];

// Comprehensive Arabic dictionary for server-side validation
const ARABIC_WORDS_SET = new Set([
  // Basic nouns - الأسماء الأساسية
  'كتاب', 'بيت', 'مدرسة', 'طعام', 'ماء', 'شمس', 'قمر', 'نجم', 'أرض', 'سماء',
  'بحر', 'جبل', 'شجرة', 'وردة', 'طفل', 'أم', 'أب', 'أخ', 'أخت', 'جد',
  'جدة', 'عم', 'عمة', 'خال', 'خالة', 'صديق', 'مدرس', 'طبيب', 'مهندس', 'فنان',
  'كاتب', 'طالب', 'عامل', 'تاجر', 'سائق', 'طباخ', 'خباز', 'بائع', 'موظف', 'رجل',
  'امرأة', 'ولد', 'بنت', 'حديقة', 'مكتبة', 'مستشفى', 'دكان', 'سوق', 'شارع', 'طريق',
  
  // Transportation - وسائل النقل
  'سيارة', 'باص', 'قطار', 'طائرة', 'سفينة', 'دراجة', 'حافلة', 'مترو', 'تاكسي', 'شاحنة',
  'مركبة', 'عربة', 'قارب', 'يخت', 'صاروخ', 'بالون', 'جسر', 'محطة', 'مطار', 'ميناء',
  
  // Animals - الحيوانات
  'حصان', 'كلب', 'قطة', 'أسد', 'فيل', 'زرافة', 'طائر', 'سمك', 'فراشة', 'نحلة',
  'عنكبوت', 'ثعبان', 'ضفدع', 'أرنب', 'خروف', 'بقرة', 'جمل', 'حمار', 'ديك', 'دجاجة',
  'بطة', 'إوزة', 'نسر', 'صقر', 'حمامة', 'عصفور', 'غراب', 'ببغاء', 'تمساح', 'سلحفاة',
  'فأر', 'قرد', 'دب', 'ذئب', 'ثعلب', 'غزال', 'نمر', 'فهد', 'وحيد', 'قرش',
  
  // Fruits - الفواكه
  'تفاح', 'موز', 'برتقال', 'عنب', 'فراولة', 'أناناس', 'مانجو', 'خوخ', 'كمثرى', 'بطيخ',
  'شمام', 'رمان', 'تين', 'مشمش', 'كرز', 'توت', 'جوز', 'لوز', 'بندق', 'تمر',
  'جوافة', 'كيوي', 'ليمون', 'برقوق', 'عنبر', 'يقطين', 'قرع', 'خيار', 'جزر', 'بصل',
  
  // Vegetables - الخضروات
  'طماطم', 'بطاطس', 'جزر', 'بصل', 'ثوم', 'خيار', 'خس', 'ملفوف', 'فلفل', 'باذنجان',
  'كوسا', 'فجل', 'سبانخ', 'بقدونس', 'كزبرة', 'نعناع', 'ريحان', 'زعتر', 'قرنبيط', 'بروكلي',
  'لفت', 'شمندر', 'فاصولياء', 'بازلاء', 'ذرة', 'فول', 'عدس', 'حمص', 'لوبيا', 'برغل',
  
  // Colors - الألوان
  'أحمر', 'أخضر', 'أزرق', 'أصفر', 'أبيض', 'أسود', 'بني', 'برتقالي', 'وردي', 'بنفسجي',
  'رمادي', 'ذهبي', 'فضي', 'زيتوني', 'تركوازي', 'بيج', 'كريمي', 'كستنائي', 'عاجي', 'قرمزي',
  
  // Common verbs - الأفعال الشائعة
  'كتب', 'قرأ', 'أكل', 'شرب', 'نام', 'استيقظ', 'مشى', 'جرى', 'قفز', 'طار',
  'سبح', 'غنى', 'رقص', 'لعب', 'عمل', 'درس', 'علم', 'تعلم', 'فهم', 'عرف',
  'رأى', 'سمع', 'لمس', 'شم', 'تذوق', 'تكلم', 'قال', 'سأل', 'أجاب', 'ضحك',
  'بكى', 'فرح', 'حزن', 'خاف', 'أحب', 'كره', 'أراد', 'احتاج', 'ساعد', 'شكر',
  
  // Common adjectives - الصفات الشائعة
  'كبير', 'صغير', 'طويل', 'قصير', 'واسع', 'ضيق', 'سميك', 'رقيق', 'ثقيل', 'خفيف',
  'قوي', 'ضعيف', 'سريع', 'بطيء', 'حار', 'بارد', 'جميل', 'قبيح', 'نظيف', 'قذر',
  'جديد', 'قديم', 'صحيح', 'خاطئ', 'سهل', 'صعب', 'مفيد', 'ضار', 'مفتوح', 'مغلق',
  'ممتلئ', 'فارغ', 'غني', 'فقير', 'سعيد', 'حزين', 'مريض', 'صحي', 'متزوج', 'أعزب',
  
  // Common words with letter combinations for the game
  'برج', 'برد', 'برك', 'برق', 'بري', 'بركة', 'برية', 'برتقال', 'برمجة', 'برنامج',
  'تراب', 'ترك', 'ترتيب', 'ترجمة', 'تركيب', 'تربية', 'تراث', 'تريح', 'تركي', 'تريد',
  'درب', 'درج', 'درس', 'درة', 'دراسة', 'دراما', 'درامي', 'دربك', 'درهم', 'درية',
  'كرة', 'كرم', 'كريم', 'كركم', 'كرش', 'كرسي', 'كراسة', 'كرامة', 'كريمة', 'كريه',
  'مرة', 'مرح', 'مرض', 'مرآة', 'مرحلة', 'مرسوم', 'مرتب', 'مرشد', 'مرغوب', 'مريض',
  'هرب', 'هرم', 'هرمون', 'هرمي', 'هرة', 'هرج', 'هرمز', 'هرتز', 'هرطقة', 'هرولة',
  'سرير', 'سرعة', 'سريع', 'سرور', 'سرد', 'سرداب', 'سرطان', 'سرحان', 'سرقة', 'سرية',
  
  // Words with بل combination
  'بلد', 'بلح', 'بلل', 'بلوز', 'بلور', 'بلاط', 'بلاغة', 'بلدية', 'بلدي', 'بلاد',
  'تلفزيون', 'تلفون', 'تلاميذ', 'تلة', 'تلك', 'تلوين', 'تلقي', 'تلقائي', 'تلعب', 'تلبس',
  'دلو', 'دليل', 'دلال', 'دلتا', 'دلع', 'دلالة', 'دلائل', 'دلف', 'دلق', 'دلك',
  'كلب', 'كلام', 'كلمة', 'كلية', 'كلاسيكي', 'كلف', 'كلس', 'كلم', 'كلور', 'كلى',
  'ملك', 'ملح', 'ملف', 'ملعب', 'ملابس', 'ملاك', 'ملاحظة', 'ملعقة', 'ملكة', 'ملاءمة',
  'هلال', 'هلام', 'هلع', 'هلوسة', 'هلاك', 'هلاوس', 'هلل', 'هلق', 'هلك',
  'لعبة', 'لعب', 'لعنة', 'لعق', 'لعاب', 'لعبر', 'لعدم', 'لعرض', 'لعمل', 'لعيش',
  'سلطة', 'سلم', 'سلام', 'سلسلة', 'سلك', 'سلطان', 'سلوك', 'سلامة', 'سلالة', 'سلعة',
  
  // Words with بت combination
  'بتر', 'بتول', 'بتة', 'بتال', 'بتلة', 'بتك', 'بتات', 'بتع', 'بتي',
  'كتب', 'كتاب', 'كتابة', 'كتيب', 'كتلة', 'كتان', 'كتم', 'كتف', 'كتاكيت', 'كتائب',
  'متر', 'مترو', 'متاع', 'متأخر', 'متقدم', 'متوسط', 'متين', 'متحف', 'متجر', 'متعة',
  'نتائج', 'نتيجة', 'نتاج', 'نتف', 'نتن', 'نتوء', 'نتر', 'نتع', 'نتق', 'نتك',
  'ستائر', 'ستار', 'ستة', 'ستين', 'ستيريو', 'ستوديو', 'ستراتيجية', 'ستاتيكي',
  
  // Words with بن combination
  'بنت', 'بني', 'بناء', 'بنان', 'بنك', 'بنود', 'بنية', 'بنفسج', 'بنطال', 'بنزين',
  'تنور', 'تنين', 'تنس', 'تنمية', 'تنظيم', 'تنفس', 'تنظيف', 'تنوع', 'تنشيط', 'تنزيل',
  'دنيا', 'دنو', 'دنيء', 'دنس', 'دنق', 'دنكم', 'دنان', 'دنيل', 'دنير', 'دنوب',
  'كنز', 'كنيسة', 'كنب', 'كنتور', 'كنار', 'كنعان', 'كنف', 'كنه', 'كنود', 'كنغر',
  'منزل', 'منطقة', 'منتج', 'منحة', 'منذر', 'منع', 'منطق', 'منجم', 'منشور', 'منقذ',
  'هناك', 'هنا', 'هند', 'هنادي', 'هناء', 'هنري', 'هنغاري', 'هنيئا', 'هنية', 'هنيدة',
  'سنة', 'سنام', 'سناء', 'سنتيمتر', 'سنجاب', 'سنار', 'سنابل', 'سنوات', 'سنور', 'سنادن',
  
  // Words with بم combination
  'تمر', 'تمثال', 'تمثيل', 'تمرين', 'تمام', 'تمديد', 'تمويل', 'تمهيد', 'تمكين', 'تمنية',
  'دمية', 'دمج', 'دمعة', 'دماغ', 'دمار', 'دمشق', 'دمث', 'دمق', 'دمك', 'دمل',
  'كمان', 'كمية', 'كمبيوتر', 'كمثرى', 'كمادة', 'كمامة', 'كمال', 'كمين', 'كمأة', 'كمح',
  'مما', 'ممتاز', 'ممر', 'ممثل', 'ممارسة', 'ممكن', 'ممتع', 'ممنوع', 'ممطر', 'ممسحة',
  'نمر', 'نمل', 'نمو', 'نموذج', 'نمط', 'نمارق', 'نمش', 'نمير', 'نمق', 'نمص',
  'همس', 'همة', 'همجي', 'همز', 'همباته', 'همسة', 'هموم', 'همجية', 'همزة', 'همسات',
  'سمك', 'سماء', 'سمع', 'سمسم', 'سمير', 'سمراء', 'سمعة', 'سمات', 'سمج', 'سمل',
  
  // Additional common words
  'عائلة', 'أسرة', 'أهل', 'والد', 'والدة', 'ابن', 'ابنة', 'حفيد', 'حفيدة',
  'زوج', 'زوجة', 'خطيب', 'خطيبة', 'عريس', 'عروس', 'قريب', 'بعيد', 'غريب',
  'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'مائة', 'ألف', 'مليون', 'مليار',
  'سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'أسبوع', 'شهر',
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر',
  'أكتوبر', 'نوفمبر', 'ديسمبر', 'ربيع', 'صيف', 'خريف', 'شتاء', 'موسم', 'فصل',
  'حب', 'كره', 'فرح', 'حزن', 'خوف', 'شجاعة', 'أمل', 'يأس', 'غضب', 'هدوء',
  'قلق', 'اطمئنان', 'حماس', 'ملل', 'دهشة', 'إعجاب', 'إحباط', 'تفاؤل', 'تشاؤم',
  'ذهب', 'جاء', 'رجع', 'عاد', 'وصل', 'غادر', 'خرج', 'دخل', 'صعد', 'نزل',
  'وقف', 'جلس', 'استلقى', 'انحنى', 'اقترب', 'ابتعد', 'توقف', 'استمر', 'بدأ', 'انتهى',
  'فتح', 'أغلق', 'أشعل', 'أطفأ', 'رفع', 'خفض', 'دفع', 'سحب', 'حمل', 'وضع',
  'أخذ', 'أعطى', 'أخفى', 'أظهر', 'باع', 'اشترى', 'دفع', 'استلم', 'أرسل', 'استقبل',
  'مدينة', 'قرية', 'بلد', 'دولة', 'قارة', 'عالم', 'مكان', 'موقع', 'منطقة',
  'منزل', 'غرفة', 'مطبخ', 'حمام', 'صالة', 'مكتب', 'محل', 'مول',
  'جامعة', 'كلية', 'روضة', 'متحف', 'مسرح', 'سينما', 'مقهى', 'مطعم',
  'فندق', 'صيدلية', 'بنك', 'مصرف', 'بريد', 'شرطة', 'مطافئ', 'مسجد', 'كنيسة',
  'حاسوب', 'كمبيوتر', 'هاتف', 'تلفون', 'جوال', 'محمول', 'راديو', 'إنترنت', 'موقع',
  'برنامج', 'تطبيق', 'شاشة', 'لوحة', 'فأرة', 'كاميرا', 'تسجيل', 'صوت', 'صورة', 'فيديو',
  'ملف', 'مجلد', 'رسالة', 'بريد', 'إيميل', 'شبكة', 'اتصال', 'خدمة', 'نظام',
  'علم', 'تعلم', 'تعليم', 'صف', 'فصل', 'أستاذ', 'معلم', 'دكتور', 'امتحان', 'اختبار',
  'واجب', 'مشروع', 'بحث', 'دراسة', 'تجربة', 'دفتر', 'قلم', 'ممحاة', 'مسطرة', 'حقيبة',
  'لوح', 'سبورة', 'طاولة', 'كرسي', 'رقم', 'حرف', 'جملة', 'فقرة', 'صفحة', 'موضوع',
  'درس', 'وحدة', 'باب', 'قدم', 'سلة', 'طائرة', 'تنس', 'سباحة', 'جري', 'قفز',
  'رماية', 'ملاكمة', 'مصارعة', 'جودو', 'كراتيه', 'تايكوندو', 'جمباز', 'رقص', 'يوغا',
  'تمرين', 'لياقة', 'صحة', 'ملعب', 'مضرب', 'شبكة', 'هدف', 'نقطة', 'فوز', 'خسارة',
  'تعادل', 'بطولة', 'كأس', 'أكل', 'شراب', 'عصير', 'حليب', 'شاي', 'قهوة', 'سكر',
  'ملح', 'خبز', 'أرز', 'لحم', 'دجاج', 'بيض', 'جبن', 'زبدة', 'زيت', 'خل',
  'عسل', 'مربى', 'حلوى', 'كعك', 'بسكوت', 'شوكولاتة', 'آيس', 'كريم', 'طبق', 'كأس',
  'ملعقة', 'شوكة', 'سكين', 'طبخ', 'قلي', 'شوي', 'سلق', 'خبز', 'تحضير', 'وجبة'
]);

console.log(`Arabic dictionary loaded with ${ARABIC_WORDS_SET.size} words`);

function generateCombination() {
  const randomIndex = Math.floor(Math.random() * TWO_LETTER_COMBINATIONS.length);
  return TWO_LETTER_COMBINATIONS[randomIndex];
}

function isValidWord(word, combination, usedWords) {
  if (word.length < 3) return false;
  //if (usedWords.has(word)) return false;
  if (!word.includes(combination)) return false;
  return ARABIC_WORDS_SET.has(word);
}

function getWordRejectionReason(word, combination, usedWords) {
  if (word.length < 3) return 'Word too short (minimum 3 letters)';
  //if (usedWords.has(word)) return 'Word already used';
  if (!word.includes(combination)) return `Word must contain "${combination}"`;
  if (!ARABIC_WORDS_SET.has(word)) return 'Word not in dictionary';
  return 'Invalid word';
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 