/**
 * Mesa de REVERSI / OTHELLO.
 *
 * Destaca as casas legais (o jogador precisa delas: em Reversi o lance legal é
 * uma condição, não uma preferência), mostra o placar em tempo real e avisa
 * quando só resta passar.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ReversiAdapter,
  REVERSI_SIZE,
  type ReversiMove,
  type ReversiState,
} from "@/lib/universal/adapters/ReversiAdapter";
import { jogadaComImperfeicao, type AiLevel } from "@/lib/universal/aiUniversal";
import { GameShell, ResultBanner, TablePanel } from "./GameShell";

interface ReversiGameViewProps {
  onBack: () => void;
}

export function ReversiGameView({ onBack }: ReversiGameViewProps) {
  const engine = useMemo(() => new ReversiAdapter(), []);
  const [level, setLevel] = useState<AiLevel>("medio");
  const [state, setState] = useState<ReversiState>(() =>
    engine.initializeGame("board_reversi", 2),
  );
  const [thinking, setThinking] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const grid = state.customState.grid;
  const gameOver = state.gameOver;
  const humanTurn = state.currentPlayer === 0 && !gameOver;

  const legalMoves = useMemo(
    () => (gameOver ? [] : (engine.getValidMoves(state) as ReversiMove[])),
    [engine, state, gameOver],
  );

  /** Só as casas de verdade (o "pass" tem x = -1 e não é casa). */
  const legalCells = useMemo(() => {
    const set = new Set<string>();
    for (const move of legalMoves) {
      if (move.data.x >= 0) set.add(`${move.data.x}-${move.data.y}`);
    }
    return set;
  }, [legalMoves]);

  const precisaPassar = legalMoves.length > 0 && legalMoves.every((m) => m.data.x < 0);

  const placar = useMemo(() => {
    let b = 0;
    let w = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell === "b") b++;
        else if (cell === "w") w++;
      }
    }
    return { b, w };
  }, [grid]);

  const restart = useCallback(() => {
    setState(engine.initializeGame("board_reversi", 2));
    setThinking(false);
    setRestartKey((k) => k + 1);
  }, [engine]);

  /** Aplica a jogada e, se for a vez da máquina, deixa ela responder. */
  const aplicar = useCallback(
    (current: ReversiState, move: ReversiMove): ReversiState => {
      const after = engine.applyMove(current, move) as ReversiState;
      setState(after);
      if (after.gameOver || after.currentPlayer !== 1) return after;

      setThinking(true);
      window.setTimeout(() => {
        const decision = jogadaComImperfeicao(engine, after, 1, level);
        if (decision.move) {
          const next = engine.applyMove(after, decision.move) as ReversiState;
          setState(next);
        }
        setThinking(false);
      }, 60);
      return after;
    },
    [engine, level],
  );

  const jogar = useCallback(
    (x: number, y: number) => {
      const move = legalMoves.find((m) => m.data.x === x && m.data.y === y);
      if (!move) return;
      aplicar(state, move);
    },
    [legalMoves, aplicar, state],
  );

  const passar = useCallback(() => {
    const move = legalMoves.find((m) => m.data.x < 0);
    if (move) aplicar(state, move);
  }, [legalMoves, aplicar, state]);

  const statusText = gameOver
    ? state.winner === 0
      ? "Você venceu!"
      : state.winner === 1
        ? "A máquina venceu"
        : "Empate"
    : precisaPassar
      ? "Você não tem lance legal — passe a vez"
      : humanTurn
        ? "Sua vez (pretas)"
        : "Vez da máquina";

  return (
    <GameShell
      key={restartKey}
      title="Reversi"
      subtitle="Você joga com as pretas — feche o adversário para virar as peças"
      onBack={onBack}
      onRestart={restart}
      level={level}
      onLevelChange={setLevel}
      usesMCTS
      thinking={thinking}
      status={
        <>
          <span className="font-semibold">{statusText}</span>
          <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-900 ring-1 ring-slate-400" />
              {placar.b}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-100" />
              {placar.w}
            </span>
          </span>
        </>
      }
      footer="Só vale jogar onde você vira peças do adversário. Quem tem mais peças no fim vence."
    >
      <TablePanel>
        <div className="mx-auto grid max-w-[min(92vw,32rem)] grid-cols-8 overflow-hidden rounded-xl border-2 border-emerald-900 bg-emerald-800 p-1">
          {Array.from({ length: REVERSI_SIZE }, (_, y) =>
            Array.from({ length: REVERSI_SIZE }, (_, x) => {
              const cell = grid[y]?.[x] ?? null;
              const jogavel = humanTurn && !thinking && legalCells.has(`${x}-${y}`);
              return (
                <button
                  key={`${x}-${y}`}
                  onClick={() => jogar(x, y)}
                  disabled={!jogavel}
                  aria-label={`casa ${x + 1}-${y + 1}`}
                  className={`flex aspect-square items-center justify-center border border-emerald-900/60 transition-colors ${
                    jogavel
                      ? "cursor-pointer bg-emerald-700 hover:bg-emerald-600"
                      : "cursor-default bg-emerald-800"
                  }`}
                >
                  {cell ? (
                    <span
                      className={`h-[74%] w-[74%] rounded-full shadow ${
                        cell === "b"
                          ? "bg-gradient-to-br from-slate-800 to-black"
                          : "bg-gradient-to-br from-white to-slate-300"
                      }`}
                    />
                  ) : jogavel ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-300/70" />
                  ) : null}
                </button>
              );
            }),
          )}
        </div>

        {precisaPassar ? (
          <div className="mt-3 flex justify-center">
            <button
              onClick={passar}
              className="rounded-xl border border-amber-400/60 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 transition-all hover:bg-amber-500/25 active:scale-95"
            >
              Passar a vez
            </button>
          </div>
        ) : null}

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
