/**
 * Mesa de JOGO DA VELHA.
 *
 * Grade 3x3 grande e clara. No fim, as três casas vencedoras ficam destacadas
 * para o jogador entender o que fechou o jogo.
 */
import { useCallback, useMemo, useState } from "react";
import {
  TicTacToeAdapter,
  type TicTacToeMove,
  type TicTacToeState,
} from "@/lib/universal/adapters/TicTacToeAdapter";
import { jogadaComImperfeicao, type AiLevel } from "@/lib/universal/aiUniversal";
import { GameShell, ResultBanner, TablePanel } from "./GameShell";

interface TicTacToeGameViewProps {
  onBack: () => void;
}

const SIZE = 3;
const LINES: Array<Array<[number, number]>> = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
];

export function TicTacToeGameView({ onBack }: TicTacToeGameViewProps) {
  const engine = useMemo(() => new TicTacToeAdapter(), []);
  const [level, setLevel] = useState<AiLevel>("medio");
  const [state, setState] = useState<TicTacToeState>(() =>
    engine.initializeGame("board_tic_tac_toe", 2),
  );
  const [thinking, setThinking] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const grid = state.customState.grid;
  const gameOver = state.gameOver;
  const humanTurn = state.currentPlayer === 0 && !gameOver;

  const restart = useCallback(() => {
    setState(engine.initializeGame("board_tic_tac_toe", 2));
    setThinking(false);
    setRestartKey((k) => k + 1);
  }, [engine]);

  const jogar = useCallback(
    (x: number, y: number) => {
      if (grid[y]?.[x] !== null) return;
      const move = (engine.getValidMoves(state) as TicTacToeMove[]).find(
        (m) => m.data.x === x && m.data.y === y,
      );
      if (!move) return;

      const after = engine.applyMove(state, move) as TicTacToeState;
      setState(after);
      if (after.gameOver || after.currentPlayer !== 1) return;

      setThinking(true);
      window.setTimeout(() => {
        const decision = jogadaComImperfeicao(engine, after, 1, level);
        if (decision.move) {
          setState(engine.applyMove(after, decision.move) as TicTacToeState);
        }
        setThinking(false);
      }, 60);
    },
    [engine, state, level, grid],
  );

  /** Três casas vencedoras, para destacar no fim. */
  const vitoria = useMemo(() => {
    for (const line of LINES) {
      const first = grid[line[0]![0]]?.[line[0]![1]];
      if (first && line.every(([y, x]) => grid[y]?.[x] === first)) {
        return new Set(line.map(([y, x]) => `${x}-${y}`));
      }
    }
    return new Set<string>();
  }, [grid]);

  const statusText = gameOver
    ? state.winner === 0
      ? "Você venceu!"
      : state.winner === 1
        ? "A máquina venceu"
        : "Deu velha!"
    : humanTurn
      ? "Sua vez (X)"
      : "Vez da máquina";

  return (
    <GameShell
      key={restartKey}
      title="Jogo da Velha"
      subtitle="Você é o X — feche uma linha de três"
      onBack={onBack}
      onRestart={restart}
      level={level}
      onLevelChange={setLevel}
      usesMCTS
      thinking={thinking}
      status={<span className="font-semibold">{statusText}</span>}
      footer="No Difícil a máquina joga sem errar: o melhor resultado possível é o empate."
    >
      <TablePanel>
        <div className="mx-auto grid max-w-[min(88vw,22rem)] grid-cols-3 gap-2">
          {Array.from({ length: SIZE }, (_, y) =>
            Array.from({ length: SIZE }, (_, x) => {
              const cell = grid[y]?.[x] ?? null;
              const destaque = vitoria.has(`${x}-${y}`);
              return (
                <button
                  key={`${x}-${y}`}
                  onClick={() => jogar(x, y)}
                  disabled={!humanTurn || thinking || cell !== null}
                  aria-label={`linha ${y + 1} coluna ${x + 1}`}
                  className={`flex aspect-square items-center justify-center rounded-2xl border-2 text-4xl font-black transition-all sm:text-5xl ${
                    destaque
                      ? "border-emerald-400 bg-emerald-500/20"
                      : "border-border/50 bg-background/60"
                  } ${
                    humanTurn && !thinking && cell === null
                      ? "cursor-pointer hover:border-primary/60 hover:bg-primary/10 active:scale-95"
                      : "cursor-default"
                  }`}
                >
                  {cell ? (
                    <span
                      className={cell === "X" ? "text-sky-400" : "text-rose-400"}
                    >
                      {cell}
                    </span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>

        {gameOver ? (
          <ResultBanner
            winner={state.winner}
            reason={state.reason === "velha" ? "velha" : state.reason}
            opponentName="A máquina"
            onRestart={restart}
          />
        ) : null}
      </TablePanel>
    </GameShell>
  );
}
