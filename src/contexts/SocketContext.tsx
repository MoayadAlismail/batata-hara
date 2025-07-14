import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Player {
  id: number;
  name: string;
  lives: number;
  isEliminated: boolean;
  socketId: string;
}

interface GameState {
  pin: string | null;
  isHost: boolean;
  players: Player[];
  gameState: 'setup' | 'playing' | 'finished';
  currentPlayer: Player | null;
  currentCombination: string;
  timeLeft: number;
  usedWords: string[];
  winner: Player | null;
  connected: boolean;
}

interface SocketContextType {
  socket: Socket | null;
  gameState: GameState;
  createRoom: () => Promise<{ success: boolean; pin?: string; error?: string }>;
  joinRoom: (pin: string, playerName: string) => Promise<{ success: boolean; error?: string }>;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  submitWord: (word: string) => Promise<{ success: boolean; isValid?: boolean; error?: string }>;
  leaveRoom: () => void;
  resetGame: () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    pin: null,
    isHost: false,
    players: [],
    gameState: 'setup',
    currentPlayer: null,
    currentCombination: '',
    timeLeft: 10,
    usedWords: [],
    winner: null,
    connected: false
  });

  useEffect(() => {
    // Initialize socket connection only once
    if (!socketRef.current) {
      console.log('Initializing socket connection...');
      const socket = io('http://localhost:3001', {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Connected to server:', socket.id);
        setGameState(prev => ({ ...prev, connected: true }));
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        setGameState(prev => ({ ...prev, connected: false }));
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setGameState(prev => ({ ...prev, connected: false }));
      });

      // Game event listeners
      socket.on('players-updated', (players: Player[]) => {
        console.log('Players updated:', players);
        setGameState(prev => ({ ...prev, players }));
      });

      socket.on('player-joined', ({ player, message }: { player: Player; message: string }) => {
        console.log('Player joined:', message);
      });

      socket.on('player-left', ({ message }: { message: string }) => {
        console.log('Player left:', message);
      });

      socket.on('host-changed', ({ isHost }: { isHost: boolean }) => {
        console.log('Host changed:', isHost);
        setGameState(prev => ({ ...prev, isHost }));
      });

      socket.on('game-started', ({ gameState: newGameState, currentPlayer, currentCombination, timeLeft, players }: {
        gameState: string;
        currentPlayer: Player;
        currentCombination: string;
        timeLeft: number;
        players: Player[];
      }) => {
        console.log('Game started:', newGameState);
        setGameState(prev => ({
          ...prev,
          gameState: newGameState as 'playing',
          currentPlayer,
          currentCombination,
          timeLeft,
          players,
          usedWords: []
        }));
      });

      socket.on('timer-update', ({ timeLeft }: { timeLeft: number }) => {
        setGameState(prev => ({ ...prev, timeLeft }));
      });

      socket.on('word-accepted', ({ word, player, usedWords }: {
        word: string;
        player: Player;
        usedWords: string[];
      }) => {
        console.log(`Word "${word}" accepted for ${player.name}`);
        setGameState(prev => ({ ...prev, usedWords }));
      });

      socket.on('word-rejected', ({ word, player, reason }: {
        word: string;
        player: Player;
        reason: string;
      }) => {
        console.log(`Word "${word}" rejected for ${player.name}: ${reason}`);
      });

      socket.on('turn-changed', ({ currentPlayer, currentCombination, timeLeft, players }: {
        currentPlayer: Player;
        currentCombination: string;
        timeLeft: number;
        players: Player[];
      }) => {
        console.log('Turn changed to:', currentPlayer.name);
        setGameState(prev => ({
          ...prev,
          currentPlayer,
          currentCombination,
          timeLeft,
          players
        }));
      });

      socket.on('player-eliminated', ({ player }: { player: Player }) => {
        console.log(`${player.name} has been eliminated`);
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(p => 
            p.id === player.id ? { ...p, lives: 0, isEliminated: true } : p
          )
        }));
      });

      socket.on('game-ended', ({ winner, players, gameState: newGameState }: {
        winner: Player | null;
        players: Player[];
        gameState: string;
      }) => {
        console.log('Game ended, winner:', winner?.name);
        setGameState(prev => ({
          ...prev,
          winner,
          players,
          gameState: newGameState as 'finished'
        }));
      });
    }

    // Cleanup only when the entire app unmounts
    return () => {
      if (socketRef.current) {
        console.log('Cleaning up socket connection...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const createRoom = (): Promise<{ success: boolean; pin?: string; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current || !gameState.connected) {
        resolve({ success: false, error: 'Socket not connected' });
        return;
      }

      console.log('Creating room...');
      socketRef.current.emit('create-room', (response: { success: boolean; pin?: string; isHost?: boolean; error?: string }) => {
        console.log('Create room response:', response);
        if (response.success && response.pin) {
          setGameState(prev => ({
            ...prev,
            pin: response.pin!,
            isHost: response.isHost || false,
            gameState: 'setup',
            players: [],
            currentPlayer: null,
            winner: null,
            usedWords: []
          }));
        }
        resolve(response);
      });
    });
  };

  const joinRoom = (pin: string, playerName: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current || !gameState.connected) {
        resolve({ success: false, error: 'Socket not connected' });
        return;
      }

      console.log('Joining room:', pin, 'as', playerName);
      socketRef.current.emit('join-room', { pin, playerName }, (response: {
        success: boolean;
        player?: Player;
        players?: Player[];
        isHost?: boolean;
        gameState?: string;
        error?: string;
      }) => {
        console.log('Join room response:', response);
        if (response.success) {
          setGameState(prev => ({
            ...prev,
            pin,
            isHost: response.isHost || false,
            players: response.players || [],
            gameState: (response.gameState as 'setup' | 'playing' | 'finished') || 'setup'
          }));
        }
        resolve(response);
      });
    });
  };

  const startGame = (): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current || !gameState.pin || !gameState.connected) {
        resolve({ success: false, error: 'Socket not connected or no room' });
        return;
      }

      console.log('Starting game...');
      socketRef.current.emit('start-game', { pin: gameState.pin }, (response: { success: boolean; error?: string }) => {
        console.log('Start game response:', response);
        resolve(response);
      });
    });
  };

  const submitWord = (word: string): Promise<{ success: boolean; isValid?: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current || !gameState.pin || !gameState.connected) {
        resolve({ success: false, error: 'Socket not connected or no room' });
        return;
      }

      console.log('Submitting word:', word);
      socketRef.current.emit('submit-word', { pin: gameState.pin, word }, (response: {
        success: boolean;
        isValid?: boolean;
        error?: string;
      }) => {
        console.log('Submit word response:', response);
        resolve(response);
      });
    });
  };

  const leaveRoom = () => {
    console.log('Leaving room...');
    if (socketRef.current) {
      // Don't disconnect the socket, just reset the game state
      setGameState({
        pin: null,
        isHost: false,
        players: [],
        gameState: 'setup',
        currentPlayer: null,
        currentCombination: '',
        timeLeft: 10,
        usedWords: [],
        winner: null,
        connected: socketRef.current.connected
      });
    }
  };

  const resetGame = () => {
    console.log('Resetting game...');
    setGameState(prev => ({
      ...prev,
      gameState: 'setup',
      currentPlayer: null,
      currentCombination: '',
      timeLeft: 10,
      usedWords: [],
      winner: null,
      players: prev.players.map(p => ({ ...p, lives: 3, isEliminated: false }))
    }));
  };

  const value: SocketContextType = {
    socket: socketRef.current,
    gameState,
    createRoom,
    joinRoom,
    startGame,
    submitWord,
    leaveRoom,
    resetGame
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 