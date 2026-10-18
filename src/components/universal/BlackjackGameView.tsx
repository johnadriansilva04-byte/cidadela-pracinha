/**
 * Mesa de BLACKJACK (21).
 *
 * Fluxo em três etapas visíveis: apostar → pedir/parar → resultado.
 * A segunda carta do dealer fica virada para baixo até a rodada ser liquidada,
 * e o total de cada mão vem do motor (nunca é recalculado na UI).
 */
import { useCallback, useMemo, useState } from "react";
import {
  BlackjackAdapter,
  type BlackjackCard,
  type BlackjackState,
} from "@/lib/universal/adapters/BlackjackAdapter";
import { GameShell, TablePanel } from "./GameShell";

interface BlackjackGameViewProps {
  onBack: () => void;
}

const SUIT_SYMBOL: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const OUTCOME_TEXT: Record<string, string> = {
  win: "Você ganhou!",
  blackjack: "Blackjack! Pagou 3:2",
  lose: "A casa levou",
  push: "Empate — aposta devolvida",
  bust: "Estourou 21 — você perdeu",
};

const OUTCOME_TONE: Record<string, string> = {
  win: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
  blackjack: "border-violet-400/50 bg-violet-500/15 text-violet-200",
  lose: "border-rose-400/50 bg-rose-500/15 text-rose-200",
  push: "border-amber-400/50 bg-amber-500/15 text-amber-200",
  bust: "border-rose-400/50 bg-rose-500/15 text-rose-200",
};

/** Carta desenhada no tamanho da mesa. */
function CardFace({ card, hidden = false }: { card: BlackjackCard; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="flex h-20 w-14 items-center justify-center rounded-lg border-2 border-slate-500 bg-gradient-to-br from-indigo-800 to-slate-900 text-lg font-black text-indigo-300 shadow-lg sm:h-24 sm:w-16">
        ?
      </div>
    );
  }

  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div
      className={`flex h-20 w-14 flex-col justify-between rounded-lg border border-slate-300 bg-white p-1.5 shadow-lg sm:h-24 sm:w-16 ${
        red ? "text-rose-600" : "text-slate-900"
      }`}
    >
      <span className="text-sm font-black leading-none sm:text-base">{card.rank}</span>
      <span className="self-end text-lg leading-none sm:text-xl">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

export function BlackjackGameView({ onBack }: BlackjackGameViewProps) {
  const engine = useMemo(() => new BlackjackAdapter(), []);
  const [state, setState] = useState<BlackjackState>(() => engine.initializeGame("card_blackjack", 2));
  const [restartKey, setRestartKey] = useState(0);

  const cs = state.customState;
  const phase = state.phase;

  const bets = useMemo(() => engine.getValidMoves(state), [engine, state]);

  const restart = useCallback(() => {
    setState(engine.initializeGame("card_blackjack", 2));
    setRestartKey((k) => k + 1);
  }, [engine]);

  /** Aplica uma jogada pelo `action` do payload. */
  const jogar = useCallback(
    (action: string, amount?: number) => {
      const move = engine
        .getValidMoves(state)
        .find((m) => m.data["action"] === action && (amount === undefined || Number(m.data["amount"]) === amount));
      if (!move) return;
      setState(engine.applyMove(state, move) as BlackjackState);
    },
    [engine, state],
  );

  const dealerHidden = phase === "playing";
  const outcome = cs.outcome;

  const statusText =
    phase === "betting"
      ? "Faça sua aposta"
      : phase === "playing"
        ? cs.playerTotal > 21
          ? "Estourou!"
          : "Pede carta ou para?"
        : phase === "settled"
          ? (OUTCOME_TEXT[outcome ?? ""] ?? "Rodada encerrada")
          : "Aguardando";

  return (
    <GameShell
      key={restartKey}
      title="Blackjack"
      subtitle="Chegue a 21 sem estourar — o dealer para no 17"
      onBack={onBack}
      onRestart={restart}
      status={
        <>
          <span className="font-semibold">{statusText}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            🪙 {cs.chips}
          </span>
        </>
      }
      footer="Blackjack natural (21 em duas cartas) paga 3:2. Empate devolve a aposta."
    >
      <TablePanel className="bg-gradient-to-b from-emerald-900/80 to-emerald-950/90">
        {/* Mão do dealer */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-200/80">Dealer</span>
            <span className="text-lg font-black text-white">
              {dealerHidden ? cs.dealerHand[0]?.value ?? 0 : cs.dealerTotal}
              {dealerHidden ? " + ?" : ""}
            </span>
          </div>
          <div className="flex min-h-[5rem] flex-wrap gap-2 sm:min-h-[6rem]">
            {cs.dealerHand.length === 0 ? (
              <span className="self-center text-xs text-emerald-200/50">sem cartas</span>
            ) : (
              cs.dealerHand.map((card, i) => (
                <CardFace key={`d-${i}`} card={card} hidden={!card.faceUp} />
              ))
            )}
          </div>
        </div>

        <div className="my-3 border-t border-emerald-400/20" />

        {/* Mão do jogador */}
        <div>
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-200/80">Você</span>
            <span className="text-lg font-black text-white">{cs.playerTotal}</span>
            {cs.bet > 0 ? (
              <span className="text-xs text-amber-300">aposta {cs.bet}</span>
            ) : null}
          </div>
          <div className="flex min-h-[5rem] flex-wrap gap-2 sm:min-h-[6rem]">
            {cs.playerHand.length === 0 ? (
              <span className="self-center text-xs text-emerald-200/50">sem cartas</span>
            ) : (
              cs.playerHand.map((card, i) => <CardFace key={`p-${i}`} card={card} />)
            )}
          </div>
        </div>

        {/* Controles */}
        <div className="mt-5">
          {phase === "betting" ? (
            <div>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
                Escolha a aposta
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {bets.map((move) => (
                  <button
                    key={String(move.data["amount"])}
                    onClick={() => jogar("bet", Number(move.data["amount"]))}
                    className="rounded-xl border border-amber-400/60 bg-amber-500/15 px-4 py-2.5 text-sm font-bold text-amber-100 transition-all hover:bg-amber-500/25 active:scale-95"
                  >
                    🪙 {String(move.data["amount"])}
                  </button>
                ))}
              </div>
            </div>
          ) : phase === "playing" ? (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => jogar("hit")}
                disabled={cs.playerTotal >= 21}
                className="rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-6 py-2.5 text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pedir carta
              </button>
              <button
                onClick={() => jogar("stand")}
                className="rounded-xl border border-rose-400/60 bg-rose-500/20 px-6 py-2.5 text-sm font-bold text-rose-100 transition-all hover:bg-rose-500/30 active:scale-95"
              >
                Parar
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {outcome ? (
                <div className={`rounded-2xl border px-4 py-2 text-sm font-bold ${OUTCOME_TONE[outcome] ?? ""}`}>
                  {OUTCOME_TEXT[outcome] ?? outcome}
                </div>
              ) : null}
              <button
                onClick={() => jogar("new-round")}
                className="rounded-xl border border-border/60 bg-background/80 px-6 py-2.5 text-sm font-bold transition-all hover:border-primary/50 hover:bg-primary/10 active:scale-95"
              >
                Nova rodada
              </button>
            </div>
          )}
        </div>
      </TablePanel>
    </GameShell>
  );
}
