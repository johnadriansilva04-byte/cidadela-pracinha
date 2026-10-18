/**
 * Mesa de YAHTZEE.
 *
 * Cinco dados com seleção de "segurar", até três rolagens por turno e cartela
 * de 13 categorias. Cada categoria mostra o quanto valeria AGORA, então o
 * jogador vê o custo de oportunidade antes de marcar.
 */
import { useCallback, useMemo, useState } from "react";
import {
  YahtzeeAdapter,
  YAHTZEE_CATEGORIES,
  scoreCategory,
  scorecardTotal,
  type YahtzeeCategory,
  type YahtzeeState,
} from "@/lib/universal/adapters/YahtzeeAdapter";
import { jogadaComImperfeicao, type AiLevel } from "@/lib/universal/aiUniversal";
import { GameShell, ResultBanner, TablePanel } from "./GameShell";

interface YahtzeeGameViewProps {
  onBack: () => void;
}

const CATEGORY_LABEL: Record<YahtzeeCategory, string> = {
  ones: "Uns",
  twos: "Dois",
  threes: "Três",
  fours: "Quatros",
  fives: "Cincos",
  sixes: "Seises",
  three_of_kind: "Trinca",
  four_of_kind: "Quadra",
  full_house: "Full House",
  small_straight: "Seq. pequena",
  large_straight: "Seq. grande",
  yahtzee: "Yahtzee",
  chance: "Chance",
};

const UPPER: YahtzeeCategory[] = ["ones", "twos", "threes", "fours", "fives", "sixes"];

/** Face do dado com pontos desenhados. */
function Die({
  value,
  held,
  onClick,
  disabled = false,
}: {
  value: number;
  held: boolean;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
}) {
  const PIPS: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  const active = PIPS[value] ?? [];

  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={`dado ${value}${held ? " segurado" : ""}`}
      className={`grid h-16 w-16 grid-cols-3 grid-rows-3 gap-0.5 rounded-xl border-2 p-1.5 shadow-lg transition-all sm:h-20 sm:w-20 ${
        held
          ? "border-emerald-400 bg-emerald-500/20"
          : "border-slate-300 bg-white"
      } ${onClick && !disabled ? "cursor-pointer hover:-translate-y-0.5 active:scale-95" : "cursor-default"}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`rounded-full ${active.includes(i) ? (held ? "bg-emerald-300" : "bg-slate-900") : "bg-transparent"}`}
        />
      ))}
    </button>
  );
}

export function YahtzeeGameView({ onBack }: YahtzeeGameViewProps) {
  const engine = useMemo(() => new YahtzeeAdapter(), []);
  const [level, setLevel] = useState<AiLevel>("medio");
  const [state, setState] = useState<YahtzeeState>(() => engine.initializeGame("dice_yahtzee", 1));
  const [thinking, setThinking] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const cs = state.customState;
  const gameOver = state.gameOver;
  const humanTurn = state.currentPlayer === 0 && !gameOver;
  const card = cs.scorecards[0] ?? {};
  const canRoll = cs.rollsLeft > 0 && humanTurn;
  const canScore = cs.rollsLeft === 0 && humanTurn;

  /** Prévia: quanto cada categoria valeria com os dados atuais. */
  const preview = useMemo(() => {
    const map = new Map<YahtzeeCategory, number>();
    for (const category of YAHTZEE_CATEGORIES) map.set(category, scoreCategory(cs.dice, category));
    return map;
  }, [cs.dice]);

  const upperSubtotal = useMemo(
    () => UPPER.reduce((sum, category) => sum + (card[category] ?? 0), 0),
    [card],
  );

  const restart = useCallback(() => {
    setState(engine.initializeGame("dice_yahtzee", 1));
    setThinking(false);
    setRestartKey((k) => k + 1);
  }, [engine]);

  /** Joga pela máquina (quando houver mais de um jogador). */
  const vezDaMaquina = useCallback(
    (base: YahtzeeState) => {
      setThinking(true);
      window.setTimeout(() => {
        let atual = base;
        let guard = 0;
        while (!atual.gameOver && atual.currentPlayer !== 0 && guard < 40) {
          const decision = jogadaComImperfeicao(engine, atual, atual.currentPlayer, level);
          if (!decision.move) break;
          atual = engine.applyMove(atual, decision.move) as YahtzeeState;
          guard++;
        }
        setState(atual);
        setThinking(false);
      }, 80);
    },
    [engine, level],
  );

  const aplicar = useCallback(
    (move: Parameters<YahtzeeAdapter["applyMove"]>[1]) => {
      const after = engine.applyMove(state, move) as YahtzeeState;
      setState(after);
      if (!after.gameOver && after.currentPlayer !== 0) vezDaMaquina(after);
    },
    [engine, state, vezDaMaquina],
  );

  /** Rola mantendo os dados marcados. */
  const rolar = useCallback(() => {
    const keep = cs.held.map((held, i) => (held ? i : -1)).filter((i) => i >= 0);
    const move = engine
      .getValidMoves(state)
      .find((m) => m.data["action"] === "roll" && JSON.stringify(m.data["keep"]) === JSON.stringify(keep));
    const fallback = move ?? engine.getValidMoves(state).find((m) => m.data["action"] === "roll");
    if (fallback) aplicar(fallback);
  }, [engine, state, cs.held, aplicar]);

  /** Alterna "segurar" um dado (só antes de rolar). */
  const alternarHold = useCallback(
    (index: number) => {
      if (!canRoll) return;
      setState((prev) => {
        const next = structuredClone(prev) as YahtzeeState;
        next.customState.held[index] = !next.customState.held[index];
        return next;
      });
    },
    [canRoll],
  );

  const marcar = useCallback(
    (category: YahtzeeCategory) => {
      if (!canScore) return;
      const move = engine
        .getValidMoves(state)
        .find((m) => m.data["action"] === "score" && m.data["category"] === category);
      if (move) aplicar(move);
    },
    [engine, state, canScore, aplicar],
  );

  const statusText = gameOver
    ? "Cartela completa"
    : canRoll
      ? `Rolagem ${4 - cs.rollsLeft} de 3 — toque nos dados para segurar`
      : "Escolha uma categoria para marcar";

  const placar = state.players.map((p, i) => ({
    nome: p.name,
    total: scorecardTotal(cs.scorecards[i] ?? {}),
  }));

  return (
    <GameShell
      key={restartKey}
      title="Yahtzee"
      subtitle="13 categorias — o bônus superior exige 63 pontos"
      onBack={onBack}
      onRestart={restart}
      level={state.players.length > 1 ? level : undefined}
      onLevelChange={state.players.length > 1 ? setLevel : undefined}
      thinking={thinking}
      status={
        <>
          <span className="font-semibold">{statusText}</span>
          <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              rolagens restantes: <span className="font-bold text-foreground">{cs.rollsLeft}</span>
            </span>
            <span>
              total: <span className="font-bold text-foreground">{scorecardTotal(card)}</span>
            </span>
          </span>
        </>
      }
      footer="Segure os dados que quer manter e role de novo. Depois de 3 rolagens, marque uma categoria."
    >
      <TablePanel className="bg-gradient-to-b from-slate-800/80 to-slate-950/90">
        {/* Dados */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
          {cs.dice.map((value, index) => (
            <Die
              key={`die-${index}`}
              value={value}
              held={cs.held[index] ?? false}
              onClick={canRoll && !thinking ? () => alternarHold(index) : undefined}
              disabled={!canRoll || thinking}
            />
          ))}
        </div>

        {/* Botão de rolar */}
        <div className="mb-5 flex justify-center">
          <button
            onClick={rolar}
            disabled={!canRoll || thinking}
            className="rounded-xl border border-amber-400/60 bg-amber-500/20 px-6 py-2.5 text-sm font-bold text-amber-100 transition-all hover:bg-amber-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cs.rollsLeft === 3 ? "Rolar os dados" : `Rolar de novo (${cs.rollsLeft})`}
          </button>
        </div>

        {/* Cartela */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Bloco superior</span>
              <span className={`text-xs font-bold ${upperSubtotal >= 63 ? "text-emerald-300" : "text-slate-400"}`}>
                {upperSubtotal}/63 {upperSubtotal >= 63 ? "· bônus +35!" : ""}
              </span>
            </div>
            <div className="space-y-1">
              {UPPER.map((category) => {
                const marcado = card[category];
                const bloqueado = marcado !== null && marcado !== undefined;
                return (
                  <button
                    key={category}
                    onClick={() => marcar(category)}
                    disabled={!canScore || bloqueado}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-all ${
                      bloqueado
                        ? "border-border/40 bg-background/40 text-muted-foreground"
                        : canScore
                          ? "border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98]"
                          : "border-border/50 bg-background/50"
                    }`}
                  >
                    <span className="font-semibold">{CATEGORY_LABEL[category]}</span>
                    <span className="font-black">
                      {bloqueado ? marcado : canScore ? preview.get(category) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-300">
              Bloco inferior
            </div>
            <div className="space-y-1">
              {YAHTZEE_CATEGORIES.filter((c) => !UPPER.includes(c)).map((category) => {
                const marcado = card[category];
                const bloqueado = marcado !== null && marcado !== undefined;
                return (
                  <button
                    key={category}
                    onClick={() => marcar(category)}
                    disabled={!canScore || bloqueado}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-all ${
                      bloqueado
                        ? "border-border/40 bg-background/40 text-muted-foreground"
                        : canScore
                          ? "border-violet-400/50 bg-violet-500/10 hover:bg-violet-500/20 active:scale-[0.98]"
                          : "border-border/50 bg-background/50"
                    }`}
                  >
                    <span className="font-semibold">{CATEGORY_LABEL[category]}</span>
                    <span className="font-black">
                      {bloqueado ? marcado : canScore ? preview.get(category) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Placar (só com mais de um jogador) */}
        {placar.length > 1 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-3 border-t border-border/30 pt-3">
            {placar.map((p) => (
              <span key={p.nome} className="text-xs text-muted-foreground">
                {p.nome}: <span className="font-bold text-foreground">{p.total}</span>
              </span>
            ))}
          </div>
        ) : null}

        {gameOver ? (
          <ResultBanner
            winner={state.winner}
            reason="cartela completa"
            opponentName="A máquina"
            onRestart={restart}
          />
        ) : null}
      </TablePanel>
    </GameShell>
  );
}
