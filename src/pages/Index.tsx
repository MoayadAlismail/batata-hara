import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { bomb, Timer, Users, Trophy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Confetti from '@/components/Confetti';
import '../styles/animations.css';

interface Player {
  id: number;
  name: string;
  lives: number;
  isEliminated: boolean;
}

const ARABIC_WORDS = [
  'كتاب', 'بيت', 'مدرسة', 'طعام', 'ماء', 'شمس', 'قمر', 'نجم', 'أرض', 'سماء',
  'بحر', 'جبل', 'شجرة', 'وردة', 'طفل', 'أم', 'أب', 'أخ', 'أخت', 'جد',
  'جدة', 'عم', 'عمة', 'خال', 'خالة', 'صديق', 'مدرس', 'طبيب', 'مهندس', 'فنان',
  'كاتب', 'طالب', 'عامل', 'تاجر', 'سائق', 'طباخ', 'خباز', 'بائع', 'موظف', 'رجل',
  'امرأة', 'ولد', 'بنت', 'حديقة', 'مكتبة', 'مستشفى', 'دكان', 'سوق', 'شارع', 'طريق',
  'سيارة', 'باص', 'قطار', 'طائرة', 'سفينة', 'دراجة', 'حصان', 'كلب', 'قطة', 'أسد',
  'فيل', 'زرافة', 'طائر', 'سمك', 'فراشة', 'نحلة', 'عنكبوت', 'ثعبان', 'ضفدع', 'أرنب',
  'خروف', 'بقرة', 'جمل', 'حمار', 'ديك', 'دجاجة', 'بطة', 'إوزة', 'تفاح', 'موز',
  'برتقال', 'عنب', 'فراولة', 'أناناس', 'مانجو', 'خوخ', 'كمثرى', 'بطيخ', 'شمام', 'جزر',
  'بصل', 'ثوم', 'طماطم', 'خيار', 'خس', 'ملفوف', 'فلفل', 'باذنجان', 'بطاطس', 'ذرة'
];

const TWO_LETTER_COMBINATIONS = [
  'بر', 'تر', 'در', 'كر', 'مر', 'نر', 'هر', 'ير', 'لر', 'سر',
  'بل', 'تل', 'دل', 'كل', 'مل', 'نل', 'هل', 'يل', 'لل', 'سل',
  'بت', 'تت', 'دت', 'كت', 'مت', 'نت', 'هت', 'يت', 'لت', 'ست',
  'بن', 'تن', 'دن', 'كن', 'من', 'نن', 'هن', 'ين', 'لن', 'سن',
  'بم', 'تم', 'دم', 'كم', 'مم', 'نم', 'هم', 'يم', 'لم', 'سم'
];

const Index = () => {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentCombination, setCurrentCombination] = useState('');
  const [timeLeft, setTimeLeft] = useState(10);
  const [currentWord, setCurrentWord] = useState('');
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [wordFeedback, setWordFeedback] = useState<'success' | 'error' | null>(null);
  const [eliminatedPlayerId, setEliminatedPlayerId] = useState<number | null>(null);

  const generateNewCombination = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * TWO_LETTER_COMBINATIONS.length);
    return TWO_LETTER_COMBINATIONS[randomIndex];
  }, []);

  const isValidWord = useCallback((word: string, combination: string) => {
    if (word.length < 3) return false;
    if (usedWords.has(word)) return false;
    if (!word.includes(combination)) return false;
    return ARABIC_WORDS.includes(word);
  }, [usedWords]);

  const addPlayer = () => {
    if (newPlayerName.trim() && players.length < 8) {
      const newPlayer: Player = {
        id: Date.now(),
        name: newPlayerName.trim(),
        lives: 3,
        isEliminated: false
      };
      setPlayers([...players, newPlayer]);
      setNewPlayerName('');
      toast({
        title: "تم إضافة اللاعب!",
        description: `${newPlayerName} انضم للعبة`,
      });
    }
  };

  const startGame = () => {
    if (players.length >= 2) {
      setGameState('playing');
      setCurrentCombination(generateNewCombination());
      setTimeLeft(10);
      toast({
        title: "بدأت اللعبة!",
        description: "حظ موفق لجميع اللاعبين!",
      });
    }
  };

  const handleWordSubmit = () => {
    const word = currentWord.trim();
    const currentPlayer = players[currentPlayerIndex];
    
    if (isValidWord(word, currentCombination)) {
      setUsedWords(prev => new Set([...prev, word]));
      setWordFeedback('success');
      toast({
        title: "كلمة صحيحة!",
        description: `${currentPlayer.name} كتب: ${word}`,
      });
      nextTurn();
      
      // Clear feedback after animation
      setTimeout(() => setWordFeedback(null), 600);
    } else {
      setWordFeedback('error');
      loseLife();
      toast({
        title: "كلمة خاطئة!",
        description: `${word} غير صحيحة أو مستخدمة من قبل`,
        variant: "destructive",
      });
      
      // Clear feedback after animation
      setTimeout(() => setWordFeedback(null), 500);
    }
    setCurrentWord('');
  };

  const loseLife = () => {
    setPlayers(prev => prev.map((player, index) => {
      if (index === currentPlayerIndex) {
        const newLives = player.lives - 1;
        if (newLives <= 0) {
          setEliminatedPlayerId(player.id);
          toast({
            title: "تم إقصاء اللاعب!",
            description: `${player.name} خرج من اللعبة`,
            variant: "destructive",
          });
          
          // Clear elimination animation after it completes
          setTimeout(() => setEliminatedPlayerId(null), 800);
          
          return { ...player, lives: 0, isEliminated: true };
        }
        return { ...player, lives: newLives };
      }
      return player;
    }));
    nextTurn();
  };

  const nextTurn = () => {
    const activePlayers = players.filter(p => !p.isEliminated);
    if (activePlayers.length <= 1) {
      setGameState('finished');
      setShowConfetti(true);
      return;
    }
    
    let nextIndex = (currentPlayerIndex + 1) % players.length;
    while (players[nextIndex].isEliminated) {
      nextIndex = (nextIndex + 1) % players.length;
    }
    
    setCurrentPlayerIndex(nextIndex);
    setCurrentCombination(generateNewCombination());
    setTimeLeft(Math.max(5, 10 - Math.floor(usedWords.size / 5)));
  };

  // Timer effect
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && timeLeft === 0) {
      loseLife();
    }
  }, [timeLeft, gameState]);

  const resetGame = () => {
    setGameState('setup');
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setCurrentCombination('');
    setTimeLeft(10);
    setCurrentWord('');
    setUsedWords(new Set());
    setShowConfetti(false);
    setWordFeedback(null);
    setEliminatedPlayerId(null);
  };

  const winner = players.find(p => !p.isEliminated);
  const activePlayers = players.filter(p => !p.isEliminated);

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4 font-handjet">
        <Card className="w-full max-w-md bg-gray-900/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-3xl">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-black text-white flex items-center justify-center gap-3 drop-shadow-lg">
              <bomb className="text-fallguys-orange animate-bounce" size={48} />
              بطاطا حارة
            </CardTitle>
            <p className="text-white/90 text-lg font-semibold">أضف من ١ إلى ٨ لاعبين للبدء</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-3">
              <Input
                placeholder="اسم اللاعب"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                className="bg-gray-800/80 border-fallguys-purple/50 border-2 text-white placeholder:text-white/70 text-lg font-bold rounded-xl"
              />
              <Button 
                onClick={addPlayer} 
                disabled={players.length >= 8}
                className="bg-fallguys-green hover:bg-fallguys-green/80 text-white font-bold text-lg px-6 rounded-xl border-2 border-white/30"
              >
                إضافة
              </Button>
            </div>
            
            <div className="space-y-3">
              {players.map((player) => (
                <div key={player.id} className="flex items-center justify-between bg-gray-800/80 p-4 rounded-xl border-2 border-fallguys-blue/30">
                  <span className="text-white font-bold text-lg">{player.name}</span>
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-4 h-4 rounded-full bg-fallguys-red border-2 border-white/50"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <Button 
              onClick={startGame} 
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-fallguys-orange to-fallguys-red hover:from-fallguys-orange/80 hover:to-fallguys-red/80 text-white font-black text-xl py-6 rounded-xl border-4 border-white/30"
            >
              <Users className="ml-3 h-6 w-6" />
              ابدأ اللعبة ({players.length}/8)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <>
        <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
        <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4 font-handjet">
          <Card className="w-full max-w-md bg-gray-900/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-3xl text-center">
            <CardHeader>
              <CardTitle className="text-4xl font-black text-white flex items-center justify-center gap-3 drop-shadow-lg">
                <Trophy className="text-fallguys-yellow animate-bounce" size={48} />
                انتهت اللعبة!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {winner && (
                <div className="text-3xl font-black text-fallguys-yellow drop-shadow-lg">
                  🎉 {winner.name} الفائز! 🎉
                </div>
              )}
              <div className="space-y-3">
                <h3 className="text-white font-bold text-xl">النتائج النهائية:</h3>
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between bg-gray-800/80 p-3 rounded-xl border-2 border-fallguys-blue/30">
                    <span className={`font-bold text-lg ${player.isEliminated ? 'text-fallguys-red' : 'text-fallguys-green'}`}>
                      {player.name}
                    </span>
                    <span className="text-white font-bold">
                      {player.isEliminated ? 'مقصى' : `${player.lives} أرواح`}
                    </span>
                  </div>
                ))}
              </div>
              <Button 
                onClick={resetGame} 
                className="w-full bg-fallguys-green hover:bg-fallguys-green/80 text-white font-bold text-xl py-4 rounded-xl border-2 border-white/30"
              >
                العب مرة أخرى
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const currentPlayer = players[currentPlayerIndex];

  return (
    <div className="min-h-screen bg-gray-800 p-4 font-handjet">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-black text-white mb-4 flex items-center justify-center gap-3 drop-shadow-lg">
            <bomb className={`text-fallguys-orange ${timeLeft <= 3 ? 'bomb-tick-intense' : timeLeft <= 5 ? 'bomb-tick' : 'animate-bounce'}`} size={56} />
            بطاطا حارة
          </h1>
          <div className="text-white/90 text-xl font-bold">
            ابحث عن كلمة تحتوي على: <span className="font-black text-fallguys-yellow text-3xl bg-gray-900/80 px-4 py-2 rounded-xl border-2 border-white/30">{currentCombination}</span>
          </div>
        </div>

        {/* Timer */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-full text-3xl font-black border-4 border-white/30 ${
            timeLeft <= 3 ? 'bg-fallguys-red animate-pulse' : 'bg-fallguys-orange'
          }`}>
            <Timer className="h-8 w-8" />
            {timeLeft}ث
          </div>
        </div>

        {/* Current Player */}
        <Card className="bg-gray-900/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-3xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white font-black">
              دور {currentPlayer.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder={`اكتب كلمة تحتوي على "${currentCombination}"`}
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleWordSubmit()}
                className={`bg-gray-800/80 border-fallguys-blue/50 border-2 text-white placeholder:text-white/70 text-xl font-bold rounded-xl ${
                  wordFeedback === 'success' ? 'word-success' : wordFeedback === 'error' ? 'word-error' : ''
                }`}
                autoFocus
              />
              <Button 
                onClick={handleWordSubmit} 
                className="bg-fallguys-green hover:bg-fallguys-green/80 text-white font-bold text-lg px-8 rounded-xl border-2 border-white/30"
              >
                إرسال
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Players Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {players.map((player, index) => (
            <Card key={player.id} className={`bg-gray-900/90 backdrop-blur-lg border-4 rounded-2xl ${
              index === currentPlayerIndex ? 'border-fallguys-yellow shadow-lg shadow-fallguys-yellow/50' : 'border-fallguys-purple/30'
            } ${player.isEliminated ? 'opacity-50' : ''} ${
              eliminatedPlayerId === player.id ? 'player-eliminate' : ''
            }`}>
              <CardContent className="p-4 text-center">
                <div className="text-white font-bold mb-3 text-lg">{player.name}</div>
                <div className="flex justify-center gap-2 mb-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 border-white/50 transition-all duration-300 ${
                        i < player.lives ? 'bg-fallguys-red scale-100' : 'bg-gray-600 scale-75'
                      }`}
                    ></div>
                  ))}
                </div>
                {player.isEliminated && (
                  <div className="text-fallguys-red text-sm font-bold">مقصى</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Game Stats */}
        <Card className="bg-gray-900/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-2xl">
          <CardContent className="p-4">
            <div className="text-center text-white font-bold">
              <div className="text-lg">الكلمات المستخدمة: {usedWords.size}</div>
              <div className="text-lg">اللاعبون النشطون: {activePlayers.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
