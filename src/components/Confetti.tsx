
import React, { useEffect, useState } from 'react';

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

const Confetti: React.FC<ConfettiProps> = ({ active, onComplete }) => {
  const [pieces, setPieces] = useState<Array<{ id: number; left: number; color: string; delay: number }>>([]);

  useEffect(() => {
    if (active) {
      const colors = ['#FF6B9D', '#4ECDC4', '#FFE66D', '#9B59B6', '#FF8C42', '#3498DB', '#2ECC71', '#E74C3C'];
      const newPieces = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 2
      }));
      
      setPieces(newPieces);
      
      // Clean up after animation
      const timer = setTimeout(() => {
        setPieces([]);
        onComplete?.();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  if (!active || pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`
          }}
        />
      ))}
    </div>
  );
};

export default Confetti;
