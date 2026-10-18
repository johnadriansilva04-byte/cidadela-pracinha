import { useState } from "react";
import { BackButton } from "@/components/BackButton";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import { MCTS } from "@/lib/ai/MCTS";

interface DominoGameViewProps {
  onBack: () => void;
}

function DominoTile({ left, right, onClick, clickable = false }: { left: number; right: number; onClick?: () => void; clickable?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      className={`
        h-20 w-10 rounded bg-white shadow-lg border-2 border-slate-300
        flex flex-col items-center justify-center gap-1
        ${clickable ? "hover:scale-105 transition-transform cursor-pointer" : ""}
      `}
    >
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: left }).map((_, i) => (
          <div key={`left-${i}`} className="h-1.5 w-1.5 rounded-full bg-slate-900" />
        ))}
      </div>
      <div className="h-px w-6 bg-slate-300" />
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: right }).map((_, i) => (
          <div key={`right-${i}`} className="h-1.5 w-1.5 rounded-full bg-slate-900" />
        ))}
      </div>
    </button>
  );
}

export function DominoGameView({ onBack }: DominoGameViewProps) {
  const [gameState, setGameState] = useState(() =>
    UniversalGameFactory.createGame("tile_domino", 2)
  );
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);

  const engine = UniversalGameFactory.createEngine("tile_domino");
  const validMoves = engine.getValidMoves(gameState);
  const isGameOver = engine.isGameOver(gameState);
  const winner = isGameOver ? engine.getWinner(gameState) : null;

  const board = gameState.board as Array<{ left: number; right: number }> || [];
  const hands = gameState.hands as Array<Array<{ left: number; right: number }>> || [];
  const playerHand = hands[0] || [];
  const aiHand = hands[1] || [];

  const handleTileClick = (tileIndex: number) => {
    if (isGameOver || isAIThinking || gameState.currentPlayer !== 0) return;

    if (selectedTile === tileIndex) {
      setSelectedTile(null);
    } else {
      setSelectedTile(tileIndex);
    }
  };

  const handleBoardEndClick = (end: "left" | "right") => {
    if (selectedTile === null || isGameOver || isAIThinking) return;

    const tile = playerHand[selectedTile];
    const validMove = validMoves.find((m: any) =>
      m.tileIndex === selectedTile && m.side === end
    );

    if (validMove) {
      const newState = engine.applyMove(gameState, validMove);
      setGameState(newState);
      setSelectedTile(null);

      // AI move
      if (!engine.isGameOver(newState)) {
        setIsAIThinking(true);
        setTimeout(() => {
          const mcts = new MCTS(engine, { maxIterations: 2000, timeBudgetMs: 1000 });
          const aiMove = mcts.computeMove(newState, 1);
          const finalState = engine.applyMove(newState, aiMove.move);
          setGameState(finalState);
          setIsAIThinking(false);
        }, 500);
      }
    }
  };

  const handlePass = () => {
    const passMove = validMoves.find((m: any) => m.action === "pass");
    if (passMove) {
      const newState = engine.applyMove(gameState, passMove);
      setGameState(newState);
      setSelectedTile(null);

      if (!engine.isGameOver(newState)) {
        setIsAIThinking(true);
        setTimeout(() => {
          const mcts = new MCTS(engine, { maxIterations: 2000, timeBudgetMs: 1000 });
          const aiMove = mcts.computeMove(newState, 1);
          const finalState = engine.applyMove(newState, aiMove.move);
          setGameState(finalState);
          setIsAIThinking(false);
        }, 500);
      }
    }
  };

  const handleNewGame = () => {
    setGameState(UniversalGameFactory.createGame("tile_domino", 2));
    setSelectedTile(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <BackButton onClick={onBack} />
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Dominó</h1>

        <div className="mb-4 rounded-lg bg-slate-800 p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">
              Turno: <span className="font-bold text-white">{gameState.currentPlayer === 0 ? "Você" : "IA"}</span>
            </p>
            <p className="text-sm text-slate-300">
              Peças restantes - Você: {playerHand.length} | IA: {aiHand.length}
            </p>
            {isAIThinking && (
              <p className="text-sm text-yellow-400">IA pensando...</p>
            )}
          </div>
          {isGameOver && (
            <p className="mt-2 text-lg font-bold text-green-400">
              {winner === null ? "Empate!" : winner === 0 ? "Você venceu!" : "IA venceu!"}
            </p>
          )}
        </div>

        {/* AI Hand (hidden) */}
        <div className="mb-6 rounded-lg bg-slate-800/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-400">Mão da IA ({aiHand.length} peças)</h3>
          <div className="flex gap-2 flex-wrap">
            {aiHand.map((_, index) => (
              <div key={index} className="h-20 w-10 rounded bg-slate-700 border-2 border-slate-600" />
            ))}
          </div>
        </div>

        {/* Board */}
        <div className="mb-6 rounded-lg bg-green-800 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Mesa</h3>
          {board.length === 0 ? (
            <p className="text-slate-400">Mesa vazia</p>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => handleBoardEndClick("left")}
                disabled={selectedTile === null || isGameOver || isAIThinking}
                className="h-20 w-10 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white font-bold"
              >
                ←
              </button>
              {board.map((tile, index) => (
                <DominoTile key={index} left={tile.left} right={tile.right} />
              ))}
              <button
                onClick={() => handleBoardEndClick("right")}
                disabled={selectedTile === null || isGameOver || isAIThinking}
                className="h-20 w-10 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white font-bold"
              >
                →
              </button>
            </div>
          )}
        </div>

        {/* Player Hand */}
        <div className="mb-6 rounded-lg bg-slate-800 p-4">
          <h3 className="mb-3 text-lg font-semibold text-white">Sua Mão</h3>
          <div className="flex gap-3 flex-wrap">
            {playerHand.map((tile, index) => (
              <DominoTile
                key={index}
                left={tile.left}
                right={tile.right}
                onClick={() => handleTileClick(index)}
                clickable={gameState.currentPlayer === 0 && !isGameOver && !isAIThinking}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        {!isGameOver && gameState.currentPlayer === 0 && (
          <div className="flex gap-4 justify-center">
            {validMoves.some((m: any) => m.action === "pass") && (
              <button
                onClick={handlePass}
                className="rounded-lg bg-yellow-600 px-8 py-3 font-bold text-white transition hover:bg-yellow-700"
              >
                Passar
              </button>
            )}
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
  );
}
