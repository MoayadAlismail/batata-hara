import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bomb, Timer, Trophy, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import Confetti from '@/components/Confetti';
import '../styles/animations.css';
// Note: In React/Vite, you can import images like this:
import PotatoImg from './potato.png';

interface Player {
  id: number;
  name: string;
  lives: number;
  isEliminated: boolean;
}

const Index = () => {
  const navigate = useNavigate();
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

  // Remove generateNewCombination and isValidWord functions - server handles this now

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
      // Remove client-side combination generation - server will provide this
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
    
    // Remove client-side validation - let server handle everything
    // For now, just clear the input and show feedback
    // In a real multiplayer setup, this would send to server via WebSocket
    setCurrentWord('');
    
    // Placeholder logic - in real implementation, server would respond
    // This is just to maintain the current single-player functionality
    toast({
      title: "كلمة مرسلة",
      description: `${currentPlayer.name} كتب: ${word}`,
    });
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
    // Remove client-side combination generation - server should provide this
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-arabic">
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-3xl">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-black text-gray-900 flex items-center justify-center gap-3 drop-shadow-lg">
              <Bomb className="text-fallguys-orange animate-bounce" size={48} />
              بطاطا حارة
            </CardTitle>
            <p className="text-gray-700 text-lg font-semibold">أضف من ١ إلى ٨ لاعبين للبدء</p>
            <div className="mt-4">
              <Button 
                onClick={() => navigate('/')}
                variant="ghost"
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              >
                <ArrowLeft className="ml-2 h-4 w-4" />
                عودة للقائمة الرئيسية
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-3">
              <Input
                placeholder="اسم اللاعب"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                className="bg-gray-50 border-fallguys-purple/50 border-2 text-gray-900 placeholder:text-gray-500 text-lg font-bold rounded-xl"
              />
              <Button 
                onClick={addPlayer} 
                disabled={players.length >= 8}
                className="bg-fallguys-green hover:bg-fallguys-green/80 text-white font-bold text-lg px-6 rounded-xl border-2 border-gray-300"
              >
                إضافة
              </Button>
            </div>
            
            <div className="space-y-3">
              {players.map((player) => (
                <div key={player.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border-2 border-fallguys-blue/30">
                  <span className="text-gray-900 font-bold text-lg">{player.name}</span>
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-4 h-4 rounded-full bg-fallguys-red border-2 border-gray-300"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <Button 
              onClick={startGame} 
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-fallguys-orange to-fallguys-red hover:from-fallguys-orange/80 hover:to-fallguys-red/80 text-white font-black text-xl py-6 rounded-xl border-4 border-gray-300"
            >
              <img src={PotatoImg} alt="Potato" className="ml-3 h-12 w-12" />
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
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-arabic">
          <Card className="w-full max-w-md bg-white/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-3xl text-center">
            <CardHeader>
              <CardTitle className="text-4xl font-black text-gray-900 flex items-center justify-center gap-3 drop-shadow-lg">
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
                <h3 className="text-gray-900 font-bold text-xl">النتائج النهائية:</h3>
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border-2 border-fallguys-blue/30">
                    <span className={`font-bold text-lg ${player.isEliminated ? 'text-fallguys-red' : 'text-fallguys-green'}`}>
                      {player.name}
                    </span>
                    <span className="text-gray-900 font-bold">
                      {player.isEliminated ? 'مقصى' : `${player.lives} أرواح`}
                    </span>
                  </div>
                ))}
              </div>
              <Button 
                onClick={resetGame} 
                className="w-full bg-fallguys-green hover:bg-fallguys-green/80 text-white font-bold text-xl py-4 rounded-xl border-2 border-gray-300"
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
    <div className="min-h-screen bg-gray-100 p-4 font-arabic">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-black text-gray-900 mb-4 flex items-center justify-center gap-3 drop-shadow-lg">
            <Bomb className={`text-fallguys-orange ${timeLeft <= 3 ? 'bomb-tick-intense' : timeLeft <= 5 ? 'bomb-tick' : 'animate-bounce'}`} size={56} />
            بطاطا حارة
          </h1>
          <div className="text-gray-700 text-xl font-bold">
            ابحث عن كلمة تحتوي على: <span className="font-black text-fallguys-yellow text-3xl bg-white/80 px-4 py-2 rounded-xl border-2 border-gray-300">{currentCombination}</span>
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
        <Card className="bg-white/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-3xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-gray-900 font-black">
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
                className={`bg-gray-50 border-fallguys-blue/50 border-2 text-gray-900 placeholder:text-gray-500 text-xl font-bold rounded-xl ${
                  wordFeedback === 'success' ? 'word-success' : wordFeedback === 'error' ? 'word-error' : ''
                }`}
                autoFocus
              />
              <Button 
                onClick={handleWordSubmit} 
                className="bg-fallguys-green hover:bg-fallguys-green/80 text-white font-bold text-lg px-8 rounded-xl border-2 border-gray-300"
              >
                إرسال
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Players Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {players.map((player, index) => (
            <Card key={player.id} className={`bg-white/90 backdrop-blur-lg border-4 rounded-2xl ${
              index === currentPlayerIndex ? 'border-fallguys-yellow shadow-lg shadow-fallguys-yellow/50' : 'border-fallguys-purple/30'
            } ${player.isEliminated ? 'opacity-50' : ''} ${
              eliminatedPlayerId === player.id ? 'player-eliminate' : ''
            }`}>
              <CardContent className="p-4 text-center">
                <div className="text-gray-900 font-bold mb-3 text-lg">{player.name}</div>
                <div className="flex justify-center gap-2 mb-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 border-gray-300 transition-all duration-300 ${
                        i < player.lives ? 'bg-fallguys-red scale-100' : 'bg-gray-400 scale-75'
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
        <Card className="bg-white/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-2xl">
          <CardContent className="p-4">
            <div className="text-center text-gray-900 font-bold">
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
