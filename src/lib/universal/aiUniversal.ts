/**
 * IA compartilhada das views do sistema universal.
 *
 * As views não instanciam MCTS diretamente: pedem a jogada aqui. Assim a
 * política de tempo/dificuldade fica em um único lugar e a UI nunca trava
 * (a busca roda com orçamento de tempo curto e devolve a melhor jogada
 * encontrada até o limite).
 */
import { MCTS } from "@/lib/ai/MCTS";
import type { GameMove, UniversalGameEngine, UniversalGameState } from "@/lib/universal/UniversalGameEngine";

export type AiLevel = "facil" | "medio" | "dificil";

export interface AiBudget {
  label: string;
  maxIterations: number;
  timeBudgetMs: number;
  /** Probabilidade de jogar uma jogada sub-ótima (imperfeição humana). */
  blunder: number;
  /** Profundidade da verificação negamax pós-MCTS (0 = sem verificação). */
  verifyDepth: number;
}

/**
 * Os níveis se diferenciam por TEMPO e por PROFUNDIDADE de verificação, não só
 * por número de simulações: a verificação negamax é o que decide a jogada, e
 * mais profundidade significa tática exata mais longe.
 */
export const AI_LEVELS: Record<AiLevel, AiBudget> = {
  facil: { label: "Fácil", maxIterations: 400, timeBudgetMs: 250, blunder: 0.3, verifyDepth: 1 },
  medio: { label: "Médio", maxIterations: 2_500, timeBudgetMs: 800, blunder: 0.08, verifyDepth: 2 },
  dificil: { label: "Difícil", maxIterations: 40_000, timeBudgetMs: 1_800, blunder: 0, verifyDepth: 3 },
};

export interface AiDecision {
  move: GameMove | null;
  iterations: number;
  elapsedMs: number;
  /** Confiança da jogada escolhida (0..1). */
  winRate: number;
}

/**
 * Decide a jogada da máquina.
 *
 * Ordem de preferência:
 *  1. `suggestMove` do próprio motor (regras específicas, ex.: Blackjack)
 *  2. MCTS com rollout heurístico (jogos táticos)
 *  3. primeira jogada legal (rede de segurança — a IA nunca "trava")
 */
export function decidirJogada(
  engine: UniversalGameEngine,
  state: UniversalGameState,
  player: number,
  level: AiLevel,
  rng: () => number = Math.random,
): AiDecision {
  const moves = engine.getValidMoves(state);
  if (moves.length === 0) return { move: null, iterations: 0, elapsedMs: 0, winRate: 0 };

  const budget = AI_LEVELS[level];

  // 1. Regras específicas do jogo (mais baratas e mais confiáveis quando existem).
  const suggestion = engine.suggestMove?.(state, player) ?? null;
  if (suggestion) {
    return { move: suggestion, iterations: 0, elapsedMs: 0, winRate: 1 };
  }

  // 2. Busca Monte Carlo.
  const startedAt = Date.now();
  try {
    const mcts = new MCTS(engine, {
      maxIterations: budget.maxIterations,
      timeBudgetMs: budget.timeBudgetMs,
      // Rollout ALEATÓRIO: é o mais barato por simulação. Medido nas damas, o
      // rollout heurístico rendia MENOS simulações no mesmo orçamento e jogava
      // PIOR — o custo de avaliar cada lance candidato em cada ply dominava o
      // tempo. A qualidade tática vem da verificação negamax, não do rollout.
      useHeuristicRollout: false,
      priorWeight: 2,
      priorSearchDepth: 2,
      // Árbitro tático: revisa todas as jogadas legais com negamax, na ordem
      // que o MCTS priorizou. É o que garante que a IA não perca para o acaso
      // quando o orçamento dá poucas simulações por jogada.
      verifyDepth: budget.verifyDepth,
      seed: Math.floor(rng() * 0xffffffff),
    });
    const result = mcts.computeMove(state, player);
    if (result.move) {
      return {
        move: result.move,
        iterations: result.iterations,
        elapsedMs: result.elapsedMs,
        winRate: result.winRate,
      };
    }
  } catch (error) {
    console.error("[IA universal] busca falhou, usando jogada de reserva", error);
  }

  // 3. Rede de segurança: nunca deixar a IA sem jogar.
  const fallback = moves[Math.floor(rng() * moves.length)] ?? moves[0]!;
  return { move: fallback, iterations: 0, elapsedMs: Date.now() - startedAt, winRate: 0 };
}

/** Jogada aleatória ponderada (usada para a imperfeição dos níveis baixos). */
export function jogadaComImperfeicao(
  engine: UniversalGameEngine,
  state: UniversalGameState,
  player: number,
  level: AiLevel,
  rng: () => number = Math.random,
): AiDecision {
  const decision = decidirJogada(engine, state, player, level, rng);
  const budget = AI_LEVELS[level];
  if (budget.blunder <= 0 || decision.move === null || rng() >= budget.blunder) return decision;

  const moves = engine.getValidMoves(state);
  if (moves.length <= 1) return decision;
  const alternatives = moves.filter((m) => engine.moveKey?.(m) !== engine.moveKey?.(decision.move!));
  if (alternatives.length === 0) return decision;
  return { ...decision, move: alternatives[Math.floor(rng() * alternatives.length)] ?? decision.move };
}
