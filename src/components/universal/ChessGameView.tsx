/**
 * Mesa de XADREZ.
 *
 * Tabuleiro 8x8 com coordenadas, destaque de jogadas legais, última jogada,
 * xeque, promoção de peão e adversário controlado por MCTS.
 */
import { useCallback, useMemo, useState } from "react";
import { ChessAdapter, type ChessMove, type ChessState } from "@/lib/universal/adapters/ChessAdapter";
import { decidirJogada, jogadaComImperfeicao, type AiLevel } from "@/lib/universal/aiUniversal";
import { GameShell, ResultBanner, TablePanel } from "./GameShell";

interface ChessGameViewProps {
  onBack: () => void;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

/** Símbolo unicode por cor+tipo. */
const SYMBOLS: Record<string, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};

const PROMOTION_LABEL: Record<string, string> = { q: "Rainha", r: "Torre", b: "Bispo", n: "Cavalo" };

export function ChessGameView({ onBack }: ChessGameViewProps) {
  const engine = useMemo(() => new ChessAdapter(), []);
  const [level, setLevel] = useState<AiLevel>("medio");
  const [state, setState] = useState<ChessState>(() => engine.initializeGame("board_chess", 2));
  const [selected, setSelected] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  /** Promoção pendente: guarda a jogada até o jogador escolher a peça. */
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [restartKey, setRestartKey] = useState(0);

  const grid = state.customState.grid;
  const gameOver = state.gameOver;
  const humanTurn = state.currentPlayer === 0 && !gameOver;

  const legalMoves = useMemo(
    () => (gameOver ? [] : engine.getValidMoves(state)),
    [engine, state, gameOver],
  );

  /** Destinos legais da peça selecionada. */
  const targets = useMemo(() => {
    if (!selected) return new Map<string, ChessMove>();
    const map = new Map<string, ChessMove>();
    for (const raw of legalMoves) {
      const move = raw as ChessMove;
      if (move.data.from === selected) map.set(move.data.to, move);
    }
    return map;
  }, [selected, legalMoves]);

  const lastMoveSquares = useMemo(() => {
    const last = state.lastMove as ChessMove | null;
    if (!last) return new Set<string>();
    return new Set([last.data.from, last.data.to]);
  }, [state.lastMove]);

  const restart = useCallback(() => {
    setState(engine.initializeGame("board_chess", 2));
    setSelected(null);
    setPromotion(null);
    setThinking(false);
    setRestartKey((k) => k + 1);
  }, [engine]);

  /** Executa a jogada e, se for a vez da máquina, responde. */
  const jogar = useCallback(
    (move: ChessMove) => {
      const after = engine.applyMove(state, move) as ChessState;
      setState(after);
      setSelected(null);

      if (after.gameOver) return;
      if (after.currentPlayer !== 1) return;

      setThinking(true);
      // Adia o cálculo para o navegador pintar a jogada do humano primeiro.
      window.setTimeout(() => {
        const decision = jogadaComImperfeicao(engine, after, 1, level);
        if (decision.move) {
          setState(engine.applyMove(after, decision.move) as ChessState);
        }
        setThinking(false);
      }, 60);
    },
    [engine, state, level],
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!humanTurn || thinking || promotion) return;

      const piece = grid[Number(square.split("-")[1])]?.[Number(square.split("-")[0])] ?? null;

      // Clique em destino válido: joga.
      const target = targets.get(square);
      if (selected && target) {
        if (target.data.promotion) {
          setPromotion({ from: target.data.from, to: target.data.to });
          return;
        }
        jogar(target);
        return;
      }

      // Clique na própria peça: seleciona (ou desseleciona).
      if (piece && piece[0] === "w") {
        setSelected((prev) => (prev === square ? null : square));
        return;
      }

      setSelected(null);
    },
    [grid, humanTurn, thinking, promotion, selected, targets, jogar],
  );

  const confirmPromotion = useCallback(
    (pieceType: string) => {
      if (!promotion) return;
      const move = legalMoves.find((raw) => {
        const m = raw as ChessMove;
        return m.data.from === promotion.from && m.data.to === promotion.to && m.data.promotion === pieceType;
      }) as ChessMove | undefined;
      setPromotion(null);
      if (move) jogar(move);
    },
    [promotion, legalMoves, jogar],
  );

  const statusText = gameOver
    ? state.reason === "checkmate"
      ? "Xeque-mate"
      : state.reason === "stalemate"
        ? "Afogamento — empate"
        : "Partida encerrada"
    : humanTurn
      ? "Sua vez (brancas)"
      : "Vez das pretas";

  return (
    <GameShell
      key={restartKey}
      title="Xadrez"
      subtitle="Você joga com as brancas"
      onBack={onBack}
      onRestart={restart}
      level={level}
      onLevelChange={setLevel}
      usesMCTS
      thinking={thinking}
      status={
        <>
          <span className="font-semibold">{statusText}</span>
          {state.customState.check && !gameOver ? (
            <span className="rounded-md border border-rose-400/50 bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-200">
              Xeque!
            </span>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {state.moveHistory.length} lances
          </span>
        </>
      }
      footer="Toque numa peça e depois no destino. Peões promovem ao chegar na última linha."
    >
      <TablePanel>
        <div className="mx-auto grid max-w-[min(92vw,34rem)] grid-cols-8 overflow-hidden rounded-xl border-2 border-amber-900/70">
          {RANKS.map((rank, row) =>
            FILES.map((file, col) => {
              const square = `${col}-${row}`;
              const piece = grid[row]?.[col] ?? null;
              const isDark = (row + col) % 2 === 1;
              const isSelected = selected === square;
              const isTarget = targets.has(square);
              const isLast = lastMoveSquares.has(square);
              const isCapture = isTarget && piece !== null;

              return (
                <button
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  disabled={!humanTurn || thinking}
                  aria-label={`${file}${rank}${piece ? ` ${piece}` : ""}`}
                  className={`relative flex aspect-square items-center justify-center text-2xl leading-none transition-colors sm:text-3xl md:text-4xl ${
                    isDark ? "bg-amber-800/80" : "bg-amber-200/85"
                  } ${isSelected ? "ring-2 ring-inset ring-emerald-400" : ""} ${
                    isLast ? "outline outline-2 -outline-offset-2 outline-sky-400/70" : ""
                  } ${humanTurn && !thinking ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}
                >
                  {piece ? (
                    <span
                      className={
                        piece[0] === "w"
                          ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                          : "text-slate-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)]"
                      }
                    >
                      {SYMBOLS[piece] ?? piece}
                    </span>
                  ) : null}

                  {/* Marca de destino: ponto quando vazio, anel quando captura */}
                  {isTarget ? (
                    isCapture ? (
                      <span className="pointer-events-none absolute inset-0 rounded-sm ring-4 ring-inset ring-rose-500/70" />
                    ) : (
                      <span className="pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-emerald-400/80 sm:h-3 sm:w-3" />
                    )
                  ) : null}

                  {/* Coordenadas nas bordas */}
                  {col === 0 ? (
                    <span className="pointer-events-none absolute left-0.5 top-0.5 text-[9px] font-bold opacity-60">
                      {rank}
                    </span>
                  ) : null}
                  {row === 7 ? (
                    <span className="pointer-events-none absolute bottom-0.5 right-0.5 text-[9px] font-bold opacity-60">
                      {file}
                    </span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>

        {/* Diálogo de promoção */}
        {promotion ? (
          <div className="mt-3 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-3">
            <p className="mb-2 text-center text-sm font-semibold">Promover peão para:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {(["q", "r", "b", "n"] as const).map((pieceType) => (
                <button
                  key={pieceType}
                  onClick={() => confirmPromotion(pieceType)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm font-semibold transition-all hover:border-primary/50 hover:bg-primary/10 active:scale-95"
                >
                  <span className="text-xl">{SYMBOLS[`w${pieceType}`]}</span>
                  {PROMOTION_LABEL[pieceType]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {gameOver ? (
          <ResultBanner
            winner={state.winner}
            reason={state.reason}
            opponentName="As pretas"
            onRestart={restart}
          />
        ) : null}
      </TablePanel>
    </GameShell>
  );
}
