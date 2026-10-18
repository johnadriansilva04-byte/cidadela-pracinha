import { useState } from "react";
import { BackButton } from "@/components/BackButton";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";

interface YahtzeeGameViewProps {
  onBack: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  ones: "1s",
  twos: "2s",
  threes: "3s",
  fours: "4s",
  fives: "5s",
  sixes: "6s",
  three_of_kind: "Trinca",
  four_of_kind: "Quadra",
  full_house: "Full House",
  small_straight: "Seq. Pequena",
  large_straight: "Seq. Grande",
  yahtzee: "Yahtzee",
  chance: "Chance",
};

function Die({ value, onClick, held }: { value: number; onClick?: () => void; held?: boolean }) {
  const dots: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        h-16 w-16 rounded-lg bg-white shadow-lg border-2
        ${held ? "border-green-500 bg-green-50" : "border-slate-300"}
        ${onClick ? "hover:scale-105 transition-transform cursor-pointer" : ""}
        grid grid-cols-3 gap-1 p-2
      `}
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className={`
            rounded-full
            ${dots[value]?.includes(index) ? "bg-slate-900" : "bg-transparent"}
          `}
        />
      ))}
    </button>
  );
}

export function YahtzeeGameView({ onBack }: YahtzeeGameViewProps) {
  const [gameState, setGameState] = useState(() =>
    UniversalGameFactory.createGame("dice_yahtzee", 2)
  );

  const engine = UniversalGameFactory.createEngine("dice_yahtzee");
  const validMoves = engine.getValidMoves(gameState);
  const isGameOver = engine.isGameOver(gameState);
  const winner = isGameOver ? engine.getWinner(gameState) : null;

  const dice = gameState.dice as number[] || [];
  const held = gameState.held as boolean[] || [];
  const scores = gameState.scores as Record<string, number> || {};
  const rollsLeft = gameState.rollsLeft as number || 3;
  const currentPlayer = gameState.currentPlayer as number || 0;

  const handleRoll = () => {
    const rollMove = validMoves.find((m: any) => m.action === "roll");
    if (rollMove) {
      const newState = engine.applyMove(gameState, rollMove);
      setGameState(newState);
    }
  };

  const handleToggleHold = (index: number) => {
    const holdMove = validMoves.find((m: any) => m.action === "hold" && m.diceIndex === index);
    if (holdMove) {
      const newState = engine.applyMove(gameState, holdMove);
      setGameState(newState);
    }
  };

  const handleScoreCategory = (category: string) => {
    const scoreMove = validMoves.find((m: any) => m.action === "score" && m.category === category);
    if (scoreMove) {
      const newState = engine.applyMove(gameState, scoreMove);
      setGameState(newState);
    }
  };

  const handleNewGame = () => {
    setGameState(UniversalGameFactory.createGame("dice_yahtzee", 2));
  };

  const calculateTotal = (playerIndex: number) => {
    const playerScores = gameState[`player${playerIndex}Scores`] as Record<string, number> || {};
    return Object.values(playerScores).reduce((sum: number, val: number) => sum + (val || 0), 0);
  };

  const currentScores = gameState[`player${currentPlayer}Scores`] as Record<string, number> || {};
  const otherScores = gameState[`player${currentPlayer === 0 ? 1 : 0}Scores`] as Record<string, number> || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <BackButton onClick={onBack} />
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Yahtzee</h1>

        <div className="mb-4 rounded-lg bg-slate-800 p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">
              Jogador: <span className="font-bold text-white">{currentPlayer === 0 ? "Você" : "IA"}</span>
            </p>
            <p className="text-sm text-slate-300">
              Rolagens restantes: <span className="font-bold text-white">{rollsLeft}</span>
            </p>
          </div>
          {isGameOver && (
            <p className="mt-2 text-lg font-bold text-green-400">
              {winner === null ? "Empate!" : winner === 0 ? "Você venceu!" : "IA venceu!"}
            </p>
          )}
        </div>

        {/* Dice */}
        <div className="mb-6 rounded-lg bg-slate-800 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Dados</h3>
          <div className="flex gap-4 justify-center flex-wrap">
            {dice.map((value, index) => (
              <Die
                key={index}
                value={value}
                held={held[index]}
                onClick={rollsLeft > 0 && !isGameOver ? () => handleToggleHold(index) : undefined}
              />
            ))}
          </div>
          {rollsLeft > 0 && !isGameOver && currentPlayer === 0 && (
            <div className="mt-4 text-center">
              <button
                onClick={handleRoll}
                className="rounded-lg bg-blue-600 px-8 py-3 font-bold text-white transition hover:bg-blue-700"
              >
                Rolar Dados
              </button>
            </div>
          )}
        </div>

        {/* Scorecard */}
        <div className="mb-6 rounded-lg bg-slate-800 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Cartela de Pontuação</h3>
          <div className="space-y-2">
            {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
              const currentScore = currentScores[category];
              const otherScore = otherScores[category];
              const canScore = validMoves.some((m: any) => m.action === "score" && m.category === category && m.player === currentPlayer);

              return (
                <div
                  key={category}
                  className={`
                    flex items-center justify-between p-3 rounded-lg
                    ${canScore && currentPlayer === 0 && !isGameOver ? "bg-slate-700 hover:bg-slate-600 cursor-pointer" : "bg-slate-700/50"}
                  `}
                  onClick={() => canScore && currentPlayer === 0 && !isGameOver ? handleScoreCategory(category) : undefined}
                >
                  <span className="text-white font-medium">{label}</span>
                  <div className="flex gap-4">
                    <span className="text-slate-300">{currentScore !== undefined ? currentScore : "-"}</span>
                    <span className="text-slate-500">{otherScore !== undefined ? otherScore : "-"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals */}
        <div className="mb-6 rounded-lg bg-slate-800 p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-400">Seu Total</p>
              <p className="text-2xl font-bold text-white">{calculateTotal(0)}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400">Total da IA</p>
              <p className="text-2xl font-bold text-white">{calculateTotal(1)}</p>
            </div>
          </div>
        </div>

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
  );
}
