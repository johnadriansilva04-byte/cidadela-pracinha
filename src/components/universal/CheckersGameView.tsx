import { useState } from "react";
import { BackButton } from "@/components/BackButton";
import { UniversalGameFactory } from "@/lib/universal/UniversalGameFactory";
import { MCTS } from "@/lib/ai/MCTS";

interface CheckersGameViewProps {
  onBack: () => void;
}

export function CheckersGameView({ onBack }: CheckersGameViewProps) {
  const [gameState, setGameState] = useState(() =>
    UniversalGameFactory.createGame("board_checkers", 2)
  );
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);

  const engine = UniversalGameFactory.createEngine("board_checkers");
  const validMoves = engine.getValidMoves(gameState);
  const isGameOver = engine.isGameOver(gameState);
  const winner = isGameOver ? engine.getWinner(gameState) : null;

  const board = gameState.board as Array<Array<string | null>>;

  const getValidMovesForSquare = (row: number, col: number) => {
    return validMoves.filter((move: any) => move.from[0] === row && move.from[1] === col);
  };

  const handleSquareClick = (row: number, col: number) => {
    if (isGameOver || isAIThinking) return;

    const piece = board[row][col];
    const pieceColor = piece?.startsWith("white") ? "white" : piece?.startsWith("black") ? "black" : null;
    const isCurrentPlayerPiece = pieceColor === (gameState.currentPlayer === 0 ? "white" : "black");

    if (selectedSquare) {
      const [fromRow, fromCol] = selectedSquare;
      const moves = getValidMovesForSquare(fromRow, fromCol);
      const targetMove = moves.find((m: any) => m.to[0] === row && m.to[1] === col);

      if (targetMove) {
        const newState = engine.applyMove(gameState, targetMove);
        setGameState(newState);
        setSelectedSquare(null);

        // AI move
        if (!engine.isGameOver(newState)) {
          setIsAIThinking(true);
          setTimeout(() => {
            const mcts = new MCTS(engine, { maxIterations: 3000, timeBudgetMs: 1500 });
            const aiMove = mcts.computeMove(newState, 1);
            const finalState = engine.applyMove(newState, aiMove.move);
            setGameState(finalState);
            setIsAIThinking(false);
          }, 300);
        }
      } else if (isCurrentPlayerPiece) {
        setSelectedSquare([row, col]);
      } else {
        setSelectedSquare(null);
      }
    } else if (isCurrentPlayerPiece) {
      setSelectedSquare([row, col]);
    }
  };

  const handleNewGame = () => {
    setGameState(UniversalGameFactory.createGame("board_checkers", 2));
    setSelectedSquare(null);
  };

  const isLightSquare = (row: number, col: number) => (row + col) % 2 === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <BackButton onClick={onBack} />
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Dama</h1>

        <div className="mb-4 rounded-lg bg-slate-800 p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">
              Turno: <span className="font-bold text-white">{gameState.currentPlayer === 0 ? "Brancas" : "Pretas"}</span>
            </p>
            {isAIThinking && (
              <p className="text-sm text-yellow-400">IA pensando...</p>
            )}
          </div>
          {isGameOver && (
            <p className="mt-2 text-lg font-bold text-green-400">
              {winner === null ? "Empate!" : winner === 0 ? "Brancas venceram!" : "Pretas venceram!"}
            </p>
          )}
        </div>

        <div className="mx-auto max-w-md">
          <div className="grid aspect-square grid-cols-8 rounded-lg overflow-hidden shadow-2xl">
            {board.map((row, rowIndex) =>
              row.map((piece, colIndex) => {
                const isSelected = selectedSquare?.[0] === rowIndex && selectedSquare?.[1] === colIndex;
                const validMoves = selectedSquare ? getValidMovesForSquare(selectedSquare[0], selectedSquare[1]) : [];
                const isValidTarget = validMoves.some((m: any) => m.to[0] === rowIndex && m.to[1] === colIndex);

                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                    disabled={isGameOver || isAIThinking}
                    className={`
                      flex aspect-square items-center justify-center transition-all duration-150
                      ${isLightSquare(rowIndex, colIndex) ? "bg-amber-100" : "bg-amber-700"}
                      ${isSelected ? "bg-blue-400!" : ""}
                      ${isValidTarget ? "bg-green-400!" : ""}
                      ${!isGameOver && !isAIThinking ? "hover:opacity-80" : "cursor-not-allowed"}
                    `}
                  >
                    {piece && (
                      <div
                        className={`
                          h-10 w-10 rounded-full border-4 shadow-lg
                          ${piece?.startsWith("white")
                            ? "bg-white border-slate-300"
                            : "bg-slate-900 border-slate-700"}
                        `}
                      >
                        {piece?.includes("king") && (
                          <div className="flex h-full items-center justify-center text-2xl font-bold text-amber-500">
                            ♛
                          </div>
                        )}
                      </div>
                    )}
                    {isValidTarget && !piece && (
                      <div className="h-3 w-3 rounded-full bg-green-500 opacity-60" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {isGameOver && (
          <div className="mt-6 text-center">
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
