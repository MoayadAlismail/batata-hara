import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bomb, Timer, Trophy, Copy, Crown, Wifi, WifiOff } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import Confetti from '@/components/Confetti';
import '../styles/animations.css';
import PotatoImg from './potato.png';

const MultiplayerGame = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { socket, gameState, startGame, submitWord, leaveRoom, resetGame } = useSocket();
  const [currentWord, setCurrentWord] = useState('');
  const [wordFeedback, setWordFeedback] = useState<'success' | 'error' | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [eliminatedPlayerId, setEliminatedPlayerId] = useState<number | null>(null);
  const navigate = useNavigate();

  // Redirect if not in a room
  useEffect(() => {
    if (!gameState.pin) {
      navigate('/');
    }
  }, [gameState.pin, navigate]);

  // Listen for game events via socket hook
  useEffect(() => {
    if (gameState.gameState === 'finished' && gameState.winner) {
      setShowConfetti(true);
    }
  }, [gameState.gameState, gameState.winner]);

  const handleStartGame = async () => {
    try {
      const result = await startGame();
      if (result.success) {
        toast({
          title: "بدأت اللعبة!",
          description: "حظ موفق لجميع اللاعبين!",
        });
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل في بدء اللعبة",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء بدء اللعبة",
        variant: "destructive",
      });
    }
  };

  const handleWordSubmit = async () => {
    if (!currentWord.trim()) return;
    const word = currentWord.trim();
    
    try {
      const result = await submitWord(word);
      if (result.success) {
        if (result.isValid) {
          setWordFeedback('success');
          toast({
            title: "كلمة صحيحة!",
            description: `تم قبول كلمة: ${word}`,
          });
        } else {
          setWordFeedback('error');
          inputRef.current?.focus();
          toast({
            title: "كلمة خاطئة!",
            description: `تم رفض كلمة: ${word}`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل في إرسال الكلمة",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إرسال الكلمة",
        variant: "destructive",
      });
    }
    
    setCurrentWord('');
    
    // Clear feedback after animation
    setTimeout(() => setWordFeedback(null), 600);
  };

  const handleCopyPin = () => {
    if (gameState.pin) {
      navigator.clipboard.writeText(gameState.pin);
      toast({
        title: "تم النسخ!",
        description: "تم نسخ رقم الغرفة إلى الحافظة",
      });
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    navigate('/');
  };

  const handleResetGame = () => {
    resetGame();
    toast({
      title: "تم إعادة تعيين اللعبة",
      description: "يمكن بدء لعبة جديدة الآن",
    });
  };

  if (!gameState.pin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-arabic">
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-lg border-fallguys-red/30 border-4 rounded-3xl">
          <CardContent className="p-8 text-center">
            <div className="text-gray-900 text-xl mb-4">لا توجد غرفة نشطة</div>
            <Button 
              onClick={() => navigate('/')}
              className="bg-fallguys-blue hover:bg-fallguys-blue/80 text-white font-bold"
            >
              العودة للرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Setup phase
  if (gameState.gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-arabic">
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-3xl">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-black text-gray-900 flex items-center justify-center gap-3 drop-shadow-lg">
            <img src={PotatoImg} alt="Potato" className="ml-3 h-12 w-12" />
              بطاطا حارة
            </CardTitle>
            <div className="flex items-center justify-center gap-2 mt-2">
              {gameState.connected ? (
                <>
                  <Wifi className="text-fallguys-green" size={16} />
                  <Badge variant="secondary" className="bg-fallguys-green/20 text-fallguys-green border-fallguys-green/50">
                    متصل
                  </Badge>
                </>
              ) : (
                <>
                  <WifiOff className="text-fallguys-red" size={16} />
                  <Badge variant="secondary" className="bg-fallguys-red/20 text-fallguys-red border-fallguys-red/50">
                    غير متصل
                  </Badge>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Room Info */}
            <div className="bg-gray-50 p-4 rounded-xl border-2 border-fallguys-blue/30 text-center">
              <p className="text-gray-600 text-sm mb-2">رقم الغرفة</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-fallguys-yellow font-black text-2xl tracking-wider">
                  {gameState.pin}
                </span>
                <Button 
                  onClick={handleCopyPin}
                  size="sm"
                  variant="ghost"
                  className="text-fallguys-blue hover:bg-fallguys-blue/20"
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            {/* Players List */}
            <div className="space-y-3">
              <h3 className="text-gray-900 font-bold text-lg text-center">
                اللاعبون ({gameState.players.length}/8)
              </h3>
              {gameState.players.map((player) => (
                <div key={player.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border-2 border-fallguys-blue/30">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-bold text-lg">{player.name}</span>
                    {gameState.isHost && player.socketId === socket?.id && (
                      <Crown className="text-fallguys-yellow" size={20} />
                    )}
                  </div>
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-4 h-4 rounded-full bg-fallguys-red border-2 border-gray-300"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Game Controls */}
            <div className="space-y-3">
              {gameState.isHost && (
                <Button 
                  onClick={handleStartGame}
                  disabled={gameState.players.length < 2}
                  className="w-full bg-gradient-to-r from-fallguys-orange to-fallguys-red hover:from-fallguys-orange/80 hover:to-fallguys-red/80 text-white font-black text-xl py-6 rounded-xl border-4 border-gray-300"
                >
                  ابدأ اللعبة ({gameState.players.length}/8)
                </Button>
              )}
              
              <Button 
                onClick={handleLeaveRoom}
                variant="outline"
                className="w-full bg-gray-200/50 border-fallguys-red/50 text-gray-900 hover:bg-fallguys-red/20 font-bold"
              >
                مغادرة الغرفة
              </Button>
            </div>

            {!gameState.isHost && (
              <div className="text-center text-gray-600 text-sm">
                في انتظار المضيف لبدء اللعبة...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Game finished phase
  if (gameState.gameState === 'finished') {
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
              {gameState.winner && (
                <div className="text-3xl font-black text-fallguys-yellow drop-shadow-lg">
                  🎉 {gameState.winner.name} الفائز! 🎉
                </div>
              )}
              
              <div className="space-y-3">
                <h3 className="text-gray-900 font-bold text-xl">النتائج النهائية:</h3>
                {gameState.players.map((player) => (
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
              
              <div className="space-y-3">
                {gameState.isHost && (
                  <Button 
                    onClick={handleResetGame}
                    className="w-full bg-fallguys-green hover:bg-fallguys-green/80 text-white font-bold text-xl py-4 rounded-xl border-2 border-gray-300"
                  >
                    العب مرة أخرى
                  </Button>
                )}
                
                <Button 
                  onClick={handleLeaveRoom}
                  variant="outline"
                  className="w-full bg-gray-200/50 border-fallguys-red/50 text-gray-900 hover:bg-fallguys-red/20 font-bold"
                >
                  مغادرة الغرفة
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Playing phase
  const currentPlayer = gameState.currentPlayer;
  const isMyTurn = currentPlayer?.socketId === socket?.id;

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-arabic">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-black text-gray-900 mb-4 flex items-center justify-center gap-3 drop-shadow-lg">
            <img
              src={PotatoImg}
              alt="Potato"
              className={`${gameState.timeLeft <= 3 ? 'bomb-tick-intense' : gameState.timeLeft <= 5 ? 'bomb-tick' : 'animate-bounce'} ml-2 h-14 w-14`}
              style={{ display: 'inline-block', verticalAlign: 'middle' }}
            />
            بطاطا حارة
          </h1>
          <div className="text-gray-700 text-xl font-bold">
            ابحث عن كلمة تحتوي على: <span className="font-black text-fallguys-yellow text-3xl bg-white/80 px-4 py-2 rounded-xl border-2 border-gray-300">{gameState.currentCombination}</span>
          </div>
        </div>

        {/* Room info */}
        <div className="text-center">
          <Badge variant="secondary" className="bg-gray-900/80 text-fallguys-yellow border-fallguys-yellow/50 font-bold text-lg px-4 py-2">
            غرفة: {gameState.pin}
          </Badge>
        </div>

        {/* Timer */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-full text-3xl font-black border-4 border-white/30 ${
            gameState.timeLeft <= 3 ? 'bg-fallguys-red animate-pulse' : 'bg-fallguys-orange'
          }`}>
            <Timer className="h-8 w-8" />
            {gameState.timeLeft}ث
          </div>
        </div>

        {/* Current Player */}
        <Card className="bg-white/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-3xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-gray-900 font-black">
              {isMyTurn ? 'دورك!' : `دور ${currentPlayer?.name}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                placeholder={`اكتب كلمة تحتوي على "${gameState.currentCombination}"`}
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && isMyTurn && handleWordSubmit()}
                className={`bg-gray-50 border-fallguys-blue/50 border-2 text-gray-900 placeholder:text-gray-500 text-xl font-bold rounded-xl ${
                  wordFeedback === 'success' ? 'word-success' : wordFeedback === 'error' ? 'word-error' : ''
                }`}
                disabled={!isMyTurn}
                autoFocus={isMyTurn}
              />
              <Button 
                onClick={handleWordSubmit}
                disabled={!isMyTurn || !currentWord.trim()}
                className="bg-fallguys-green hover:bg-fallguys-green/80 text-white font-bold text-lg px-8 rounded-xl border-2 border-gray-300"
              >
                إرسال
              </Button>
            </div>
            
            {!isMyTurn && (
              <div className="text-center text-gray-600 text-lg">
                في انتظار {currentPlayer?.name}...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Players Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {gameState.players.map((player) => (
            <Card key={player.id} className={`bg-white/90 backdrop-blur-lg border-4 rounded-2xl ${
              player.id === currentPlayer?.id ? 'border-fallguys-yellow shadow-lg shadow-fallguys-yellow/50' : 'border-fallguys-purple/30'
            } ${player.isEliminated ? 'opacity-50' : ''} ${
              eliminatedPlayerId === player.id ? 'player-eliminate' : ''
            }`}>
              <CardContent className="p-4 text-center">
                <div className="text-gray-900 font-bold mb-3 text-lg flex items-center justify-center gap-2">
                  {player.name}
                  {gameState.isHost && player.socketId === socket?.id && (
                    <Crown className="text-fallguys-yellow" size={16} />
                  )}
                </div>
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
              <div className="text-lg">الكلمات المستخدمة: {gameState.usedWords.length}</div>
              <div className="text-lg">اللاعبون النشطون: {gameState.players.filter(p => !p.isEliminated).length}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MultiplayerGame; 