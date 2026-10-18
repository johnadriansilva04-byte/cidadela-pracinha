/**
 * Mesa de LIGA 4.
 *
 * A coluna inteira é o alvo do clique: a peça cai sozinha na casa mais baixa
 * livre. A coluna onde o adversário ameaça fechar 4 ganha um destaque, para o
 * jogador enxergar a ameaça antes de perder.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ConnectFourAdapter,
  CONNECT_FOUR_COLS,
  CONNECT_FOUR_ROWS,
  type ConnectFourMove,
  type ConnectFourState,
} from "@/lib/universal/adapters/ConnectFourAdapter";
import { jogadaComImperfeicao, type AiLevel } from "@/lib/universal/aiUniversal";
import { GameShell, ResultBanner, TablePanel } from "./GameShell";

interface ConnectFourGameViewProps {
  onBack: () => void;
}

export function ConnectFourGameView({ onBack }: ConnectFourGameViewProps) {
  const engine = useMemo(() => new ConnectFourAdapter(), []);
  const [level, setLevel] = useState<AiLevel>("medio");
  const [state, setState] = useState<ConnectFourState>(() =>
    engine.initializeGame("board_connect_four", 2),
  );
  const [thinking, setThinking] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const grid = state.customState.grid;
  const gameOver = state.gameOver;
  const humanTurn = state.currentPlayer === 0 && !gameOver;

  const legalCols = useMemo(() => {
    const set = new Set<number>();
    if (!gameOver) {
      for (const move of engine.getValidMoves(state) as ConnectFourMove[]) {
        set.add(move.data.col);
      }
    }
    return set;
  }, [engine, state, gameOver]);

  const restart = useCallback(() => {
    setState(engine.initializeGame("board_connect_four", 2));
    setThinking(false);
    setHover(null);
    setRestartKey((k) => k + 1);
  }, [engine]);

  const jogar = useCallback(
    (col: number) => {
      const move = (engine.getValidMoves(state) as ConnectFourMove[]).find(
        (m) => m.data.col === col,
      );
      if (!move) return;

      const after = engine.applyMove(state, move) as ConnectFourState;
      setState(after);
      if (after.gameOver || after.currentPlayer !== 1) return;

      setThinking(true);
      window.setTimeout(() => {
        const decision = jogadaComImperfeicao(engine, after, 1, level);
        if (decision.move) {
          setState(engine.applyMove(after, decision.move) as ConnectFourState);
        }
        setThinking(false);
      }, 60);
    },
    [engine, state, level],
  );

  /** Linha vencedora a destacar no fim. */
  const vitoria = useMemo(() => {
    if (!state.gameOver || state.winner === null) return new Set<string>();
    const cor = state.winner === 0 ? "r" : "y";
    const dirs: Array<[number, number]> = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
    for (let y = 0; y < CONNECT_FOUR_ROWS; y++) {
      for (let x = 0; x < CONNECT_FOUR_COLS; x++) {
        for (const [dx, dy] of dirs) {
          const casas: string[] = [];
          for (let i = 0; i < 4; i++) {
            const cx = x + dx * i;
            const cy = y + dy * i;
            if (cx < 0 || cx >= CONNECT_FOUR_COLS || cy < 0 || cy >= CONNECT_FOUR_ROWS) break;
            if (grid[cy]![cx] !== cor) break;
            casas.push(`${cx}-${cy}`);
          }
          if (casas.length === 4) return new Set(casas);
        }
      }
    }
    return new Set<string>();
  }, [grid, state.gameOver, state.winner]);

  const statusText = gameOver
    ? state.winner === 0
      ? "Você venceu!"
      : state.winner === 1
        ? "A máquina venceu"
        : "Empate"
    : humanTurn
      ? "Sua vez — escolha uma coluna"
      : "Vez da máquina";

  return (
    <GameShell
      key={restartKey}
      title="Liga 4"
      subtitle="Você joga com as vermelhas — alinhe 4 antes da máquina"
      onBack={onBack}
      onRestart={restart}
      level={level}
      onLevelChange={setLevel}
      usesMCTS
      thinking={thinking}
      status={<span className="font-semibold">{statusText}</span>}
      footer="Clique na coluna onde quer soltar a peça. Ela cai até a casa livre mais baixa."
    >
      <TablePanel>
        <div className="mx-auto max-w-[min(94vw,30rem)]">
          {/* Guia de colunas: mostra onde a peça cairia. */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {Array.from({ length: CONNECT_FOUR_COLS }, (_, col) => (
              <div key={col} className="flex h-6 items-center justify-center">
                {humanTurn && !thinking && legalCols.has(col) ? (
                  <span
                    className={`h-2 w-2 rounded-full transition-opacity ${
                      hover === col ? "bg-rose-400 opacity-100" : "bg-rose-400/40 opacity-70"
                    }`}
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 rounded-2xl border-2 border-blue-900 bg-gradient-to-b from-blue-800 to-blue-950 p-1.5 shadow-inner sm:gap-1.5 sm:p-2">
            {Array.from({ length: CONNECT_FOUR_ROWS }, (_, y) =>
              Array.from({ length: CONNECT_FOUR_COLS }, (_, x) => {
                const cell = grid[y]?.[x] ?? null;
                const jogavel = humanTurn && !thinking && legalCols.has(x);
                const destaque = vitoria.has(`${x}-${y}`);
                return (
                  <button
                    key={`${x}-${y}`}
                    onClick={() => jogar(x)}
                    onMouseEnter={() => setHover(x)}
                    onMouseLeave={() => setHover((h) => (h === x ? null : h))}
                    disabled={!jogavel}
                    aria-label={`coluna ${x + 1} linha ${y + 1}`}
                    className={`flex aspect-square items-center justify-center rounded-full bg-blue-950/70 transition-colors ${
                      jogavel ? "cursor-pointer hover:bg-blue-900" : "cursor-default"
                    }`}
                  >
                    {cell ? (
                      <span
                        className={`h-[78%] w-[78%] rounded-full shadow-md ${
                          cell === "r"
                            ? "border-2 border-rose-200/70 bg-gradient-to-br from-rose-500 to-rose-700"
                            : "border-2 border-amber-200/70 bg-gradient-to-br from-amber-300 to-amber-500"
                        } ${destaque ? "ring-4 ring-white/90" : ""}`}
                      />
                    ) : null}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        {gameOver ? (
          <ResultBanner
            winner={state.winner}
            reason={state.reason}
            opponentName="A máquina"
            onRestart={restart}
          />
        ) : null}
      </TablePanel>
    </GameShell>
  );
}
