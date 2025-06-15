
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bomb, Timer, Users, Trophy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Player {
  id: number;
  name: string;
  lives: number;
  isEliminated: boolean;
}

const WORD_LIST = [
  'about', 'after', 'again', 'against', 'almost', 'alone', 'along', 'already', 'also', 'although',
  'always', 'among', 'another', 'answer', 'around', 'back', 'became', 'because', 'become', 'before',
  'being', 'between', 'both', 'came', 'come', 'could', 'did', 'different', 'does', 'don\'t',
  'during', 'each', 'early', 'even', 'ever', 'every', 'example', 'family', 'far', 'find',
  'first', 'found', 'from', 'get', 'give', 'good', 'great', 'group', 'hand', 'hard',
  'have', 'help', 'here', 'high', 'home', 'house', 'how', 'however', 'important', 'into',
  'know', 'large', 'last', 'later', 'learn', 'left', 'let', 'life', 'line', 'little',
  'long', 'look', 'made', 'make', 'man', 'many', 'may', 'might', 'most', 'move',
  'much', 'must', 'name', 'need', 'never', 'new', 'next', 'night', 'now', 'number',
  'often', 'old', 'only', 'open', 'other', 'our', 'over', 'own', 'part', 'people',
  'place', 'point', 'problem', 'program', 'public', 'put', 'question', 'right', 'said', 'same',
  'saw', 'say', 'see', 'seem', 'several', 'she', 'should', 'show', 'small', 'some',
  'something', 'state', 'still', 'such', 'system', 'take', 'than', 'that', 'the', 'their',
  'them', 'then', 'there', 'these', 'they', 'thing', 'think', 'this', 'those', 'though',
  'three', 'through', 'time', 'today', 'together', 'too', 'turn', 'under', 'until', 'use',
  'used', 'using', 'very', 'want', 'water', 'way', 'well', 'went', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'why', 'will', 'with', 'within', 'without',
  'work', 'world', 'would', 'write', 'year', 'years', 'young', 'your', 'party', 'heart',
  'start', 'smart', 'chart', 'earth', 'third', 'shirt', 'short', 'north', 'worth', 'birth'
];

const TWO_LETTER_COMBINATIONS = [
  'ar', 'th', 'in', 'er', 'an', 'ed', 'nd', 'ou', 'en', 'ng',
  'al', 'at', 'es', 'or', 'it', 'on', 'as', 'he', 'is', 'hi',
  'ti', 're', 'te', 'to', 'st', 'le', 've', 'me', 'be', 'we'
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

  const generateNewCombination = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * TWO_LETTER_COMBINATIONS.length);
    return TWO_LETTER_COMBINATIONS[randomIndex];
  }, []);

  const isValidWord = useCallback((word: string, combination: string) => {
    if (word.length < 3) return false;
    if (usedWords.has(word.toLowerCase())) return false;
    if (!word.toLowerCase().includes(combination.toLowerCase())) return false;
    return WORD_LIST.includes(word.toLowerCase());
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
        title: "Player Added!",
        description: `${newPlayerName} joined the game`,
      });
    }
  };

  const startGame = () => {
    if (players.length >= 2) {
      setGameState('playing');
      setCurrentCombination(generateNewCombination());
      setTimeLeft(10);
      toast({
        title: "Game Started!",
        description: "Good luck to all players!",
      });
    }
  };

  const handleWordSubmit = () => {
    const word = currentWord.trim();
    const currentPlayer = players[currentPlayerIndex];
    
    if (isValidWord(word, currentCombination)) {
      setUsedWords(prev => new Set([...prev, word.toLowerCase()]));
      toast({
        title: "Valid Word!",
        description: `${currentPlayer.name} submitted: ${word}`,
      });
      nextTurn();
    } else {
      loseLife();
      toast({
        title: "Invalid Word!",
        description: `${word} is not valid or already used`,
        variant: "destructive",
      });
    }
    setCurrentWord('');
  };

  const loseLife = () => {
    setPlayers(prev => prev.map((player, index) => {
      if (index === currentPlayerIndex) {
        const newLives = player.lives - 1;
        if (newLives <= 0) {
          toast({
            title: "Player Eliminated!",
            description: `${player.name} is out of the game`,
            variant: "destructive",
          });
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
  };

  const winner = players.find(p => !p.isEliminated);
  const activePlayers = players.filter(p => !p.isEliminated);

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-white flex items-center justify-center gap-2">
              <Bomb className="text-orange-400" />
              Word Bomb
            </CardTitle>
            <p className="text-white/80">Add 2-8 players to start</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter player name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
              />
              <Button onClick={addPlayer} disabled={players.length >= 8}>
                Add
              </Button>
            </div>
            
            <div className="space-y-2">
              {players.map((player) => (
                <div key={player.id} className="flex items-center justify-between bg-white/20 p-2 rounded">
                  <span className="text-white font-medium">{player.name}</span>
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-red-400"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <Button 
              onClick={startGame} 
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              <Users className="mr-2 h-4 w-4" />
              Start Game ({players.length}/8)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-lg border-white/20 text-center">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-white flex items-center justify-center gap-2">
              <Trophy className="text-yellow-400" />
              Game Over!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {winner && (
              <div className="text-2xl font-bold text-yellow-400">
                🎉 {winner.name} Wins! 🎉
              </div>
            )}
            <div className="space-y-2">
              <h3 className="text-white font-semibold">Final Standings:</h3>
              {players.map((player) => (
                <div key={player.id} className="flex items-center justify-between bg-white/20 p-2 rounded">
                  <span className={`font-medium ${player.isEliminated ? 'text-red-400' : 'text-green-400'}`}>
                    {player.name}
                  </span>
                  <span className="text-white">
                    {player.isEliminated ? 'Eliminated' : `${player.lives} lives`}
                  </span>
                </div>
              ))}
            </div>
            <Button onClick={resetGame} className="w-full">
              Play Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPlayer = players[currentPlayerIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Bomb className="text-orange-400" />
            Word Bomb
          </h1>
          <div className="text-white/80">
            Find a word containing: <span className="font-bold text-yellow-400 text-2xl">{currentCombination.toUpperCase()}</span>
          </div>
        </div>

        {/* Timer */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-2xl font-bold ${
            timeLeft <= 3 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
          }`}>
            <Timer className="h-6 w-6" />
            {timeLeft}s
          </div>
        </div>

        {/* Current Player */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">
              {currentPlayer.name}'s Turn
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={`Enter a word containing "${currentCombination}"`}
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleWordSubmit()}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 text-lg"
                autoFocus
              />
              <Button onClick={handleWordSubmit} className="bg-green-600 hover:bg-green-700">
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Players Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {players.map((player, index) => (
            <Card key={player.id} className={`bg-white/10 backdrop-blur-lg border-white/20 ${
              index === currentPlayerIndex ? 'ring-2 ring-yellow-400' : ''
            } ${player.isEliminated ? 'opacity-50' : ''}`}>
              <CardContent className="p-4 text-center">
                <div className="text-white font-semibold mb-2">{player.name}</div>
                <div className="flex justify-center gap-1 mb-2">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full ${
                        i < player.lives ? 'bg-red-400' : 'bg-gray-600'
                      }`}
                    ></div>
                  ))}
                </div>
                {player.isEliminated && (
                  <div className="text-red-400 text-sm font-medium">Eliminated</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Game Stats */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="p-4">
            <div className="text-center text-white">
              <div className="text-sm opacity-80">Words Used: {usedWords.size}</div>
              <div className="text-sm opacity-80">Active Players: {activePlayers.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
