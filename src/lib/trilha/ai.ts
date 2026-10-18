/**
 * IA da máquina: Minimax com poda Alfa-Beta, ordenação de jogadas,
 * função de avaliação ponderada por fase e aprofundamento iterativo com
 * orçamento de tempo (mantém a UI responsiva).
 *
 * AGORA TAMBÉM: MCTS (Monte Carlo Tree Search) como alternativa para o nível "general".
 */
import { ADJACENCY, MILLS } from "./board";
import {
  applyMove,
  countMills,
  generateMoves,
  hasAnyMove,
  isInMill,
  opponent,
  type GameState,
  type Move,
  type Player,
  WIN,
  evaluate as trilhaEvaluate,
} from "./engine";
import { MCTS } from "@/lib/ai/MCTS";
import { TrilhaAdapter } from "./TrilhaEngineAdapter";

export type Difficulty = "recruta" | "sargento" | "general";

export interface AiProfile {
  label: string;
  depth: number;
  /** Probabilidade de jogar uma alternativa sub-ótima (imperfeição humana). */
  blunder: number;
  timeBudgetMs: number;
  description: string;
  /** Se true, usa MCTS em vez de Minimax */
  useMCTS?: boolean;
}

export const AI_PROFILES: Record<Difficulty, AiProfile> = {
  recruta: {
    label: "Recruta",
    depth: 1,
    blunder: 0.35,
    timeBudgetMs: 250,
    description: "Recém-chegado ao front. Enxerga só a jogada imediata e hesita sob pressão.",
  },
  sargento: {
    label: "Sargento",
    depth: 3,
    blunder: 0.08,
    timeBudgetMs: 700,
    description: "Veterano de patrulha. Antecipa três lances, bloqueia trilhas e arma emboscadas.",
  },
  general: {
    label: "General",
    depth: 7,
    blunder: 0,
    timeBudgetMs: 3000,
    description: "Estado-maior supremo. Calcula jogadas profundas com precisão letal.",
    useMCTS: true,
  },
};

/** Heurística barata para ordenar jogadas e melhorar a poda. */
function orderMoves(state: GameState, moves: Move[], me: Player): Move[] {
  return moves
    .map((move) => {
      let s = 0;
      if (move.remove !== null) s += 1000;
      if (isInMill(state.board, move.to)) s += 5;
      s += (ADJACENCY[move.to] ?? []).length; // interseções centrais valem mais
      if (move.from !== null && isInMill(state.board, move.from)) s += 8; // abrir/fechar moinho
      return { move, s: state.turn === me ? s : -s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.move);
}

interface SearchCtx {
  me: Player;
  deadline: number;
  nodes: number;
  aborted: boolean;
}

function negamax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchCtx,
): number {
  ctx.nodes++;
  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.aborted = true;

  const perspective = state.turn === ctx.me ? 1 : -1;

  if (state.winner) return perspective * (state.winner === state.turn ? WIN : -WIN) * perspective;
  if (depth <= 0 || ctx.aborted) return trilhaEvaluate(state, ctx.me) * perspective;

  const moves = generateMoves(state);
  if (moves.length === 0 || !hasAnyMove(state)) {
    // Quem está para jogar e não pode mover, perde por bloqueio.
    return state.turn === ctx.me ? -WIN + state.ply : WIN - state.ply;
  }

  let best = -Infinity;
  for (const move of orderMoves(state, moves, state.turn)) {
    const child = applyMove(state, move);
    const score = -negamax(child, depth - 1, -beta, -alpha, ctx);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
    if (ctx.aborted) break;
  }
  return best;
}

export interface AiDecision {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
  elapsedMs: number;
}

/** Escolhe a jogada da máquina com aprofundamento iterativo + orçamento de tempo. */
export function chooseMove(state: GameState, difficulty: Difficulty): AiDecision {
  const profile = AI_PROFILES[difficulty];
  const me = state.turn;
  const start = Date.now();
  const moves = generateMoves(state);
  if (moves.length === 0) {
    return { move: null, score: 0, depth: 0, nodes: 0, elapsedMs: 0 };
  }

  // Se o perfil usa MCTS, rota para o motor MCTS
  if (profile.useMCTS) {
    return chooseMoveMCTS(state, difficulty);
  }

  // Caso contrário, usa Minimax (implementação existente)
  const ctx: SearchCtx = {
    me,
    deadline: start + profile.timeBudgetMs,
    nodes: 0,
    aborted: false,
  };

  let bestMove: Move = moves[0]!;
  let bestScore = -Infinity;
  let reachedDepth = 0;
  let ranked: Array<{ move: Move; score: number }> = [];

  for (let depth = 1; depth <= profile.depth; depth++) {
    const results: Array<{ move: Move; score: number }> = [];
    let alpha = -Infinity;
    for (const move of orderMoves(state, moves, me)) {
      const child = applyMove(state, move);
      const score = -negamax(child, depth - 1, -Infinity, -alpha, ctx);
      results.push({ move, score });
      if (score > alpha) alpha = score;
      if (ctx.aborted) break;
    }
    if (results.length === 0) break;
    results.sort((a, b) => b.score - a.score);
    ranked = results;
    bestMove = results[0]!.move;
    bestScore = results[0]!.score;
    reachedDepth = depth;
    if (ctx.aborted || Math.abs(bestScore) >= WIN) break;
  }

  // Imperfeição controlada: níveis baixos às vezes escolhem a 2ª/3ª melhor jogada.
  if (profile.blunder > 0 && ranked.length > 1 && Math.random() < profile.blunder) {
    const pool = ranked.slice(0, Math.min(4, ranked.length));
    const pick = pool[1 + Math.floor(Math.random() * (pool.length - 1))];
    if (pick) bestMove = pick.move;
  }

  return {
    move: bestMove,
    score: bestScore,
    depth: reachedDepth,
    nodes: ctx.nodes,
    elapsedMs: Date.now() - start,
  };
}

/**
 * Escolhe a jogada usando MCTS (Monte Carlo Tree Search).
 * Usado pelo nível "general" para jogadas mais robustas.
 */
function chooseMoveMCTS(state: GameState, difficulty: Difficulty): AiDecision {
  const profile = AI_PROFILES[difficulty];
  const start = Date.now();

  // Cria o adaptador e o motor MCTS
  const adapter = new TrilhaAdapter();
  const mcts = new MCTS(adapter, {
    maxIterations: 15000, // Mais iterações para MCTS
    timeBudgetMs: profile.timeBudgetMs,
    explorationConstant: Math.SQRT2,
    useHeuristicRollout: false, // Rollout aleatório puro para melhor exploração
  });

  // Computa a melhor jogada
  const result = mcts.computeMove(state, state.turn);

  // Se não encontrou jogada, retorna null
  if (!result.move) {
    return { move: null, score: 0, depth: 0, nodes: 0, elapsedMs: result.elapsedMs };
  }

  // Avalia a jogada escolhida para retornar um score (para compatibilidade com a interface)
  const stateAfterMove = adapter.applyMove(state, result.move);
  const score = adapter.evaluate(stateAfterMove, state.turn);

  return {
    move: result.move,
    score,
    depth: 0, // MCTS não tem profundidade fixa
    nodes: result.totalNodes,
    elapsedMs: result.elapsedMs,
  };
}
