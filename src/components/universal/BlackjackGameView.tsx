import { useState } from "react";
import { BackButton } from "@/components/BackButton";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";

interface BlackjackGameViewProps {
  onBack: () => void;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "text-red-600",
  diamonds: "text-red-600",
  clubs: "text-slate-900",
  spades: "text-slate-900",
};

const RANK_LABELS: Record<string, string> = {
  ace: "A",
  king: "K",
  queen: "Q",
  jack: "J",
  "10": "10",
  "9": "9",
  "8": "8",
  "7": "7",
  "6": "6",
  "5": "5",
  "4": "4",
  "3": "3",
  "2": "2",
};

function CardDisplay({ card, hidden = false }: { card: any; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="h-32 w-24 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg border-2 border-blue-400 flex items-center justify-center">
        <div className="text-3xl text-white font-bold">?</div>
      </div>
    );
  }

  return (
    <div className="h-32 w-24 rounded-lg bg-white shadow-lg border-2 border-slate-300 flex flex-col items-center justify-center">
      <div className={`text-3xl font-bold ${SUIT_COLORS[card.suit]}`}>
        {RANK_LABELS[card.rank]}
      </div>
      <div className={`text-4xl ${SUIT_COLORS[card.suit]}`}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
    </div>
  );
}

function calculateHandValue(cards: any[]) {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === "ace") {
      aces += 1;
      value += 11;
    } else if (["king", "queen", "jack"].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank, 10);
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
}

export function BlackjackGameView({ onBack }: BlackjackGameViewProps) {
  const [gameState, setGameState] = useState(() =>
    UniversalGameFactory.createGame("card_blackjack", 2)
  );
  const [isGameOver, setIsGameOver] = useState(false);

  const engine = UniversalGameFactory.createEngine("card_blackjack");
  const validMoves = engine.getValidMoves(gameState);

  const playerHand = gameState.hands?.[0] || [];
  const dealerHand = gameState.hands?.[1] || [];
  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  const handleHit = () => {
    const hitMove = validMoves.find((m: any) => m.action === "hit");
    if (hitMove) {
      const newState = engine.applyMove(gameState, hitMove);
      setGameState(newState);

      const newPlayerHand = newState.hands?.[0] || [];
      const newPlayerValue = calculateHandValue(newPlayerHand);

      if (newPlayerValue > 21) {
        setIsGameOver(true);
      }
    }
  };

  const handleStand = () => {
    const standMove = validMoves.find((m: any) => m.action === "stand");
    if (standMove) {
      const newState = engine.applyMove(gameState, standMove);
      setGameState(newState);
      setIsGameOver(true);
    }
  };

  const handleNewGame = () => {
    setGameState(UniversalGameFactory.createGame("card_blackjack", 2));
    setIsGameOver(false);
  };

  const determineWinner = () => {
    if (playerValue > 21) return "Dealer venceu!";
    if (dealerValue > 21) return "Você venceu!";
    if (playerValue > dealerValue) return "Você venceu!";
    if (dealerValue > playerValue) return "Dealer venceu!";
    return "Empate!";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 p-4">
      <BackButton onClick={onBack} />
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Blackjack</h1>

        <div className="space-y-6">
          {/* Dealer */}
          <div className="rounded-lg bg-green-950/50 p-6">
            <h2 className="mb-4 text-xl font-bold text-white">Dealer</h2>
            <div className="flex gap-3 flex-wrap">
              {dealerHand.map((card: any, index: number) => (
                <CardDisplay
                  key={index}
                  card={card}
                  hidden={!isGameOver && index === 1}
                />
              ))}
            </div>
            {isGameOver && (
              <p className="mt-2 text-lg font-bold text-white">
                Total: {dealerValue}
              </p>
            )}
          </div>

          {/* Player */}
          <div className="rounded-lg bg-green-950/50 p-6">
            <h2 className="mb-4 text-xl font-bold text-white">Você</h2>
            <div className="flex gap-3 flex-wrap">
              {playerHand.map((card: any, index: number) => (
                <CardDisplay key={index} card={card} />
              ))}
            </div>
            <p className="mt-2 text-lg font-bold text-white">
              Total: {playerValue}
            </p>
          </div>

          {/* Game Status */}
          {isGameOver && (
            <div className="rounded-lg bg-slate-800 p-6 text-center">
              <p className="text-2xl font-bold text-yellow-400">
                {determineWinner()}
              </p>
            </div>
          )}

          {/* Controls */}
          {!isGameOver && (
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleHit}
                className="rounded-lg bg-blue-600 px-8 py-3 font-bold text-white transition hover:bg-blue-700"
              >
                Pedir Carta
              </button>
              <button
                onClick={handleStand}
                className="rounded-lg bg-red-600 px-8 py-3 font-bold text-white transition hover:bg-red-700"
              >
                Parar
              </button>
            </div>
          )}

          {isGameOver && (
            <div className="text-center">
              <button
                onClick={handleNewGame}
                className="rounded-lg bg-green-600 px-8 py-3 font-bold text-white transition hover:bg-green-700"
              >
                Novo Jogo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
