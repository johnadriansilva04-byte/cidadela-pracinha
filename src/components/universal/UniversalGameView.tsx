import { BackButton } from "@/components/BackButton";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import { MCTS } from "@/lib/ai/MCTS";
import { useState } from "react";

type UniversalGameType = "xadrez" | "dama" | "blackjack" | "domino" | "yahtzee";

interface UniversalGameViewProps {
  gameType: UniversalGameType;
  onBack: () => void;
}

export function UniversalGameView({ gameType, onBack }: UniversalGameViewProps) {
  const [gameState, setGameState] = useState(() => {
    const gameId = gameType === "xadrez" ? "board_chess" :
                   gameType === "dama" ? "board_checkers" :
                   gameType === "blackjack" ? "card_blackjack" :
                   gameType === "domino" ? "tile_domino" :
                   "dice_yahtzee";
    return UniversalGameFactory.createGame(gameId, 2);
  });

  const engine = UniversalGameFactory.createEngine(gameType === "xadrez" ? "board_chess" :
                                                       gameType === "dama" ? "board_checkers" :
                                                       gameType === "blackjack" ? "card_blackjack" :
                                                       gameType === "domino" ? "tile_domino" :
                                                       "dice_yahtzee");

  const validMoves = engine.getValidMoves(gameState);
  const isGameOver = engine.isGameOver(gameState);
  const winner = isGameOver ? engine.getWinner(gameState) : null;

  const handleMove = (moveIndex: number) => {
    const move = validMoves[moveIndex];
    const newState = engine.applyMove(gameState, move);
    setGameState(newState);
  };

  const handleAIMove = () => {
    const mcts = new MCTS(engine, { maxIterations: 5000, timeBudgetMs: 2000 });
    const result = mcts.computeMove(gameState, gameState.currentPlayer);
    const newState = engine.applyMove(gameState, result.move);
    setGameState(newState);
  };

  const gameName = gameType === "xadrez" ? "Xadrez" :
                   gameType === "dama" ? "Dama" :
                   gameType === "blackjack" ? "Blackjack" :
                   gameType === "domino" ? "Dominó" :
                   "Yahtzee";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <BackButton onClick={onBack} />
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">{gameName}</h1>

        <div className="mb-4 rounded-lg bg-slate-800 p-4 text-white">
          <p className="text-sm text-slate-300">Turno do Jogador: {gameState.currentPlayer + 1}</p>
          {isGameOver && (
            <p className="mt-2 text-lg font-bold text-green-400">
              {winner === null ? "Empate!" : `Jogador ${winner + 1} venceu!`}
            </p>
          )}
        </div>

        <div className="mb-4 rounded-lg bg-slate-700 p-4">
          <h2 className="mb-2 text-lg font-semibold text-white">Estado do Jogo</h2>
          <pre className="overflow-auto text-xs text-slate-300">
            {JSON.stringify(gameState, null, 2)}
          </pre>
        </div>

        {!isGameOver && (
          <>
            <div className="mb-4">
              <h2 className="mb-2 text-lg font-semibold text-white">Jogadas Disponíveis ({validMoves.length})</h2>
              <div className="grid max-h-64 grid-cols-1 gap-2 overflow-auto md:grid-cols-2">
                {validMoves.map((move, index) => (
                  <button
                    key={index}
                    onClick={() => handleMove(index)}
                    className="rounded bg-slate-700 p-3 text-left text-sm text-white transition hover:bg-slate-600"
                  >
                    {JSON.stringify(move)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAIMove}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-700"
            >
              Jogar com IA (MCTS)
            </button>
          </>
        )}

        {isGameOver && (
          <button
            onClick={() => {
              const gameId = gameType === "xadrez" ? "board_chess" :
                             gameType === "dama" ? "board_checkers" :
                             gameType === "blackjack" ? "card_blackjack" :
                             gameType === "domino" ? "tile_domino" :
                             "dice_yahtzee";
              setGameState(UniversalGameFactory.createGame(gameId, 2));
            }}
            className="w-full rounded-lg bg-green-600 px-4 py-3 font-bold text-white transition hover:bg-green-700"
          >
            Novo Jogo
          </button>
        )}
      </div>
    </div>
  );
}
