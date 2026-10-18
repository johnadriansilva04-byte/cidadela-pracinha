/**
 * Mesa de DAMAS.
 *
 * Tabuleiro 8x8 com casas escuras jogáveis, captura obrigatória em destaque,
 * capturas em cadeia (a UI mantém a vez da peça que está comendo) e coroação.
 */
import { useCallback, useMemo, useState } from "react";
import { CheckersAdapter, type CheckersMove, type CheckersState } from "@/lib/universal/adapters/CheckersAdapter";
import { jogadaComImperfeicao, type AiLevel } from "@/lib/universal/aiUniversal";
import { GameShell, ResultBanner, TablePanel } from "./GameShell";

interface CheckersGameViewProps {
  onBack: () => void;
}

const SIZE = 8;

export function CheckersGameView({ onBack }: CheckersGameViewProps) {
  const engine = useMemo(() => new CheckersAdapter(), []);
  const [level, setLevel] = useState<AiLevel>("medio");
  const [state, setState] = useState<CheckersState>(() => engine.initializeGame("board_checkers", 2));
  const [selected, setSelected] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const grid = state.customState.grid;
  const gameOver = state.gameOver;
  const chain = state.customState.chainFrom;
  const humanTurn = state.currentPlayer === 0 && !gameOver;

  const legalMoves = useMemo(
    () => (gameOver ? [] : (engine.getValidMoves(state) as CheckersMove[])),
    [engine, state, gameOver],
  );

  /** Existe captura obrigatória nesta posição? (destaca no aviso) */
  const mustCapture = useMemo(
    () => legalMoves.some((m) => m.type === "capture"),
    [legalMoves],
  );

  /** Destinos legais da peça selecionada (ou da peça em cadeia). */
  const targets = useMemo(() => {
    const from = chain ?? selected;
    const map = new Map<string, CheckersMove>();
    if (!from) return map;
    for (const move of legalMoves) {
      if (move.data.from === from) map.set(move.data.to, move);
    }
    return map;
  }, [chain, selected, legalMoves]);

  const restart = useCallback(() => {
    setState(engine.initializeGame("board_checkers", 2));
    setSelected(null);
    setThinking(false);
    setRestartKey((k) => k + 1);
  }, [engine]);

  /** Executa a jogada; se o turno passou para a máquina, ela responde. */
  const jogar = useCallback(
    (move: CheckersMove) => {
      const after = engine.applyMove(state, move) as CheckersState;
      setState(after);
      setSelected(null);

      if (after.gameOver) return;
      // Cadeia: a mesma peça continua comendo — o humano decide de novo.
      if (after.customState.chainFrom) return;
      if (after.currentPlayer !== 1) return;

      setThinking(true);
      window.setTimeout(() => {
        const decision = jogadaComImperfeicao(engine, after, 1, level);
        if (decision.move) {
          let next = engine.applyMove(after, decision.move) as CheckersState;
          // A IA resolve a cadeia inteira antes de devolver a vez.
          let guard = 0;
          while (next.customState.chainFrom && !next.gameOver && guard < 12) {
            const follow = engine.getValidMoves(next);
            if (follow.length === 0) break;
            next = engine.applyMove(next, follow[0]!) as CheckersState;
            guard++;
          }
          setState(next);
        }
        setThinking(false);
      }, 60);
    },
    [engine, state, level],
  );

  const handleSquareClick = useCallback(
    (x: number, y: number) => {
      if (!humanTurn || thinking) return;
      const square = `${x}-${y}`;
      const piece = grid[y]?.[x] ?? null;

      const target = targets.get(square);
      if (target) {
        jogar(target);
        return;
      }

      if (piece && piece[0] === "r") {
        // Só permite selecionar peças que realmente podem jogar.
        const canPlay = legalMoves.some((m) => m.data.from === square);
        setSelected(canPlay ? (selected === square ? null : square) : null);
        return;
      }

      setSelected(null);
    },
    [grid, humanTurn, thinking, targets, legalMoves, selected, jogar],
  );

  const pieces = useMemo(() => {
    let mine = 0;
    let foe = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (!cell) continue;
        if (cell[0] === "r") mine++;
        else foe++;
      }
    }
    return { mine, foe };
  }, [grid]);

  const statusText = gameOver
    ? state.winner === 0
      ? "Você venceu!"
      : state.winner === 1
        ? "A máquina venceu"
        : "Empate"
    : chain
      ? "Continue capturando com a mesma peça"
      : humanTurn
        ? mustCapture
          ? "Sua vez — captura obrigatória"
          : "Sua vez (vermelhas)"
        : "Vez da máquina";

  return (
    <GameShell
      key={restartKey}
      title="Damas"
      subtitle="Você joga com as vermelhas — captura é obrigatória"
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
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              {pieces.mine}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              {pieces.foe}
            </span>
          </span>
        </>
      }
      footer="Peças coroadas (♛) andam para qualquer direção. Comer várias peças seguidas mantém a sua vez."
    >
      <TablePanel>
        <div className="mx-auto grid max-w-[min(92vw,34rem)] grid-cols-8 overflow-hidden rounded-xl border-2 border-stone-700">
          {Array.from({ length: SIZE }, (_, y) =>
            Array.from({ length: SIZE }, (_, x) => {
              const square = `${x}-${y}`;
              const cell = grid[y]?.[x] ?? null;
              const isDark = (x + y) % 2 === 1;
              const isSelected = selected === square || chain === square;
              const isTarget = targets.has(square);
              const isCaptureTarget = isTarget && (targets.get(square)?.type === "capture");

              if (!isDark) {
                return <div key={square} className="aspect-square bg-stone-200/85" />;
              }

              return (
                <button
                  key={square}
                  onClick={() => handleSquareClick(x, y)}
                  disabled={!humanTurn || thinking}
                  aria-label={square}
                  className={`relative flex aspect-square items-center justify-center bg-stone-700 transition-colors ${
                    isSelected ? "ring-2 ring-inset ring-emerald-400" : ""
                  } ${humanTurn && !thinking ? "cursor-pointer hover:bg-stone-600" : "cursor-default"}`}
                >
                  {cell ? (
                    <span
                      className={`flex h-[72%] w-[72%] items-center justify-center rounded-full text-sm font-black shadow-md sm:text-base ${
                        cell[0] === "r"
                          ? "border-2 border-rose-200/70 bg-gradient-to-br from-rose-500 to-rose-700 text-rose-50"
                          : "border-2 border-slate-400/70 bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800"
                      }`}
                    >
                      {cell.endsWith("K") ? "♛" : ""}
                    </span>
                  ) : null}

                  {isCaptureTarget ? (
                    <span className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-amber-400/80" />
                  ) : isTarget ? (
                    <span className="pointer-events-none absolute h-3 w-3 rounded-full bg-emerald-400/80" />
                  ) : null}
                </button>
              );
            }),
          )}
        </div>

        {gameOver ? (
          <ResultBanner
            winner={state.winner}
            reason={state.reason === "all_captured" ? "todas as peças capturadas" : state.reason}
            opponentName="A máquina"
            onRestart={restart}
          />
        ) : null}
      </TablePanel>
    </GameShell>
  );
}
