'use client';

import { useState, useEffect } from 'react';

interface Card {
  id: number;
  value: number;
  isFlipped: boolean;
  isMatched: boolean;
}

export default function CardGame() {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);

  // Initialize game
  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const values = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6];
    const shuffledCards = values
      .sort(() => Math.random() - 0.5)
      .map((value, index) => ({
        id: index,
        value,
        isFlipped: false,
        isMatched: false,
      }));
    setCards(shuffledCards);
    setFlippedCards([]);
    setMoves(0);
    setGameWon(false);
  };

  const handleCardClick = (clickedId: number) => {
    if (flippedCards.length === 2) return;
    if (cards[clickedId].isMatched) return;
    if (flippedCards.includes(clickedId)) return;

    const newFlippedCards = [...flippedCards, clickedId];
    setFlippedCards(newFlippedCards);

    const newCards = cards.map(card =>
      card.id === clickedId ? { ...card, isFlipped: true } : card
    );
    setCards(newCards);

    if (newFlippedCards.length === 2) {
      setMoves(moves + 1);
      const [first, second] = newFlippedCards;
      if (cards[first].value === cards[second].value) {
        setTimeout(() => {
          const updatedCards = newCards.map(card =>
            card.id === first || card.id === second
              ? { ...card, isMatched: true }
              : card
          );
          setCards(updatedCards);
          setFlippedCards([]);
          
          if (updatedCards.every(card => card.isMatched)) {
            setGameWon(true);
          }
        }, 500);
      } else {
        setTimeout(() => {
          const updatedCards = newCards.map(card =>
            card.id === first || card.id === second
              ? { ...card, isFlipped: false }
              : card
          );
          setCards(updatedCards);
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Memory Card Game</h1>
          <p className="text-xl text-gray-600">Moves: {moves}</p>
          {gameWon && (
            <div className="mt-4 p-4 bg-green-100 text-green-700 rounded-lg">
              Congratulations! You won in {moves} moves!
            </div>
          )}
          <button
            onClick={initializeGame}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            New Game
          </button>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className={`aspect-square cursor-pointer transition-transform duration-300 transform ${
                card.isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              <div
                className={`w-full h-full rounded-lg shadow-lg flex items-center justify-center text-2xl font-bold ${
                  card.isFlipped || card.isMatched
                    ? 'bg-white text-blue-600'
                    : 'bg-blue-500 text-white'
                }`}
              >
                {card.isFlipped || card.isMatched ? card.value : '?'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 