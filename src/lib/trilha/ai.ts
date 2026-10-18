/**
 * IA da Trilha.
 *
 * Dois motores, escolhidos pelo nível:
 *
 *  - "recruta" / "sargento" → Minimax com poda alfa-beta, ordenação de jogadas,
 *    avaliação ponderada por fase e aprofundamento iterativo com orçamento de
 *    tempo. Rápido e previsível — ideal para níveis de entrada.
 *
 *  - "general" → MCTS (Monte Carlo Tree Search) do motor genérico
 *    (`@/lib/ai/MCTS`), com rollout heurístico. Mais forte e mais robusto em
 *    posições táticas, com custo de tempo maior.
 *
 * A assinatura pública (`chooseMove`) e o formato de `AiDecision` são
 * estáveis: a UI não precisa saber qual motor respondeu.
 */
import { ADJACENCY } from "./board";
import {
  applyMove,
  countMills,
  generateMoves,
  hasAnyMove,
  isInMill,
  millsFormedAt,
  opponent,
  removableTargets,
  evaluate as trilhaEvaluate,
  type GameState,
  type Move,
  type Player,
  WIN,
} from "./engine";
import { MCTS } from "@/lib/ai/MCTS";
import { TrilhaAdapter } from "./TrilhaEngineAdapter";

export type Difficulty = "recruta" | "sargento" | "general";

export interface AiProfile {
  label: string;
  /** Profundidade do Minimax (ignorada pelo MCTS). */
  depth: number;
  /** Probabilidade de jogar uma alternativa sub-ótima (imperfeição humana). */
  blunder: number;
  timeBudgetMs: number;
  description: string;
  /** Motor de busca: "minimax" (padrão) ou "mcts". */
  engine: "minimax" | "mcts";
  /** Iterações máximas do MCTS. */
  mctsIterations?: number;
}

export const AI_PROFILES: Record<Difficulty, AiProfile> = {
  recruta: {
    label: "Recruta",
    depth: 1,
    blunder: 0.35,
    timeBudgetMs: 250,
    description: "Recém-chegado ao front. Enxerga só a jogada imediata e hesita sob pressão.",
    engine: "minimax",
  },
  sargento: {
    label: "Sargento",
    depth: 3,
    blunder: 0.08,
    timeBudgetMs: 700,
    description: "Veterano de patrulha. Antecipa três lances, bloqueia trilhas e arma emboscadas.",
    engine: "minimax",
  },
  general: {
    label: "General",
    depth: 7,
    blunder: 0,
    timeBudgetMs: 2200,
    description: "Estado-maior supremo. Combina busca Monte Carlo com leitura tática profunda.",
    engine: "mcts",
    mctsIterations: 40_000,
  },
};

/** Heurística barata para ordenar jogadas e melhorar a poda do Minimax. */
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

/**
 * Chave canônica de uma jogada da Trilha.
 * Usada para cruzar as candidatas do MCTS com as jogadas geradas pelo motor —
 * comparar objetos não funciona, porque cada motor cria instâncias próprias.
 */
function trilhaMoveKey(move: Move): string {
  return `${move.from ?? "h"}>${move.to}>${move.remove ?? "-"}`;
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

  // O vencedor já foi registrado para quem NÃO tem a vez: daqui (lado a
  // jogar) a posição terminal vale -WIN.
  if (state.winner) return state.winner === state.turn ? WIN : -WIN;
  if (depth <= 0 || ctx.aborted) return trilhaEvaluate(state, ctx.me) * perspective;

  const moves = generateMoves(state);
  if (moves.length === 0 || !hasAnyMove(state)) {
    // Quem está para jogar e não pode mover perde por bloqueio.
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
  /** Motor que produziu a decisão (útil para exibir no painel do QG). */
  engine: "minimax" | "mcts";
}

/**
 * Jogadas que NÃO fecham trilha mas já poderiam capturar.
 * O motor aceita "fechar trilha sem capturar" para o fluxo de duas etapas da
 * UI, mas a IA nunca deve escolher essa variante: ela desperdiça o moinho.
 */
function isWastedMill(state: GameState, move: Move): boolean {
  if (move.remove !== null) return false;
  const board = state.board.slice();
  if (move.from !== null) board[move.from] = 0;
  board[move.to] = state.turn;
  return millsFormedAt(board, move.to, state.turn).length > 0;
}

/** Escolhe a jogada da máquina. */
export function chooseMove(state: GameState, difficulty: Difficulty): AiDecision {
  const profile = AI_PROFILES[difficulty];
  const moves = generateMoves(state);
  if (moves.length === 0) {
    return { move: null, score: 0, depth: 0, nodes: 0, elapsedMs: 0, engine: profile.engine };
  }

  const decision =
    profile.engine === "mcts" ? chooseMoveMCTS(state, profile) : chooseMoveMinimax(state, profile);

  // Rede de segurança: nunca devolver uma jogada que desperdiça um moinho
  // quando existem alternativas equivalentes com captura.
  if (decision.move && isWastedMill(state, decision.move)) {
    const board = state.board.slice();
    if (decision.move.from !== null) board[decision.move.from] = 0;
    board[decision.move.to] = state.turn;
    const targets = removableTargets(board, opponent(state.turn));
    const melhor = targets[0];
    if (melhor !== undefined) {
      decision.move = { ...decision.move, remove: melhor };
    }
  }

  return decision;
}

/** Minimax com aprofundamento iterativo e orçamento de tempo. */
function chooseMoveMinimax(state: GameState, profile: AiProfile): AiDecision {
  const me = state.turn;
  const start = Date.now();
  const moves = generateMoves(state);
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
    engine: "minimax",
  };
}

/**
 * Motor "General": MCTS + verificação negamax (arquitetura híbrida).
 *
 * Por que híbrido e não MCTS puro: o MCTS decide pela média de simulações
 * Monte Carlo, o que é robusto em posições incertas mas impreciso em táticas
 * curtas — exatamente onde um minimax raso é exato. Medido em
 * `testes/bench-forca.mts`, o MCTS puro perdia para o Minimax "sargento" mesmo
 * com orçamento generoso.
 *
 * A solução usa cada motor no que ele é melhor:
 *
 *  1. O MCTS roda com a maior parte do orçamento e devolve as jogadas
 *     candidatas mais simuladas (`rootMoves`) — a exploração ampla encontra
 *     lances que uma busca alfa-beta podada poderia descartar.
 *  2. TODAS as jogadas legais passam por negamax na raiz, com poda alfa-beta.
 *     O MCTS define só a ORDEM: as candidatas mais simuladas são testadas
 *     primeiro, o que maximiza os cortes e aprofunda a busca no mesmo tempo.
 *
 * Como a verificação é exata no horizonte que alcança e cobre o conjunto
 * completo de jogadas, o General nunca escolhe uma jogada pior do que o
 * Minimax da mesma profundidade — e o MCTS ainda pode priorizar lances que a
 * ordenação heurística do minimax não colocaria em primeiro.
 */
function chooseMoveMCTS(state: GameState, profile: AiProfile): AiDecision {
  const start = Date.now();
  const me = state.turn;
  const adapter = new TrilhaAdapter();

  // Fatia o orçamento: a maior parte para o MCTS (exploração), o resto para a
  // verificação (precisão tática).
  const mctsBudget = Math.max(200, Math.floor(profile.timeBudgetMs * 0.6));

  const mcts = new MCTS(adapter, {
    maxIterations: profile.mctsIterations ?? 20_000,
    timeBudgetMs: mctsBudget,
    explorationConstant: Math.SQRT2,
    useHeuristicRollout: false,
    // Avalia em vez de jogar até o fim: ~3× mais simulações no mesmo tempo.
    rolloutCutoffPly: 30,
    maxRolloutDepth: 200,
    priorWeight: 2,
  });

  const result = mcts.computeMove(state, me);
  // As 8 mais simuladas viram a frente da ordem de verificação.
  const candidates = result.rootMoves.slice(0, 8).map((entry) => entry.move);
  if (candidates.length === 0) {
    return {
      move: result.move,
      score: 0,
      depth: 0,
      nodes: result.totalNodes,
      elapsedMs: Date.now() - start,
      engine: "mcts",
    };
  }

  const ctx: SearchCtx = {
    me,
    deadline: start + profile.timeBudgetMs,
    nodes: 0,
    aborted: false,
  };

  // Verifica TODAS as jogadas legais: como a poda alfa-beta agora vale na
  // raiz, isso é barato e garante que o General nunca seja mais fraco que o
  // Minimax de mesma profundidade. O MCTS decide só a ORDEM — as candidatas
  // mais simuladas entram primeiro, o que maximiza os cortes.
  const allMoves = generateMoves(state);
  const byKey = new Map<string, Move>(allMoves.map((m) => [trilhaMoveKey(m), m]));
  const ordered: Move[] = [];
  const vistos = new Set<string>();
  for (const candidata of candidates) {
    const key = trilhaMoveKey(candidata);
    const move = byKey.get(key);
    if (move && !vistos.has(key)) {
      vistos.add(key);
      ordered.push(move);
    }
  }
  for (const move of orderMoves(state, allMoves, me)) {
    const key = trilhaMoveKey(move);
    if (!vistos.has(key)) {
      vistos.add(key);
      ordered.push(move);
    }
  }

  let bestMove: Move = ordered[0] ?? candidates[0]!;
  let bestScore = -Infinity;
  let reachedDepth = 0;

  for (let depth = 1; depth <= profile.depth; depth++) {
    let alpha = -Infinity;
    let localBest: Move | null = null;
    let localScore = -Infinity;

    for (const move of ordered) {
      const child = applyMove(state, move);
      const score = -negamax(child, depth - 1, -Infinity, -alpha, ctx);
      if (score > localScore) {
        localScore = score;
        localBest = move;
      }
      if (score > alpha) alpha = score;
      if (ctx.aborted) break;
    }

    // Só aceita a rodada completa: uma profundidade interrompida no meio
    // compararia jogadas em horizontes diferentes.
    if (!ctx.aborted && localBest) {
      bestMove = localBest;
      bestScore = localScore;
      reachedDepth = depth;
    }

    if (ctx.aborted || Math.abs(bestScore) >= WIN) break;
  }

  return {
    move: bestMove,
    score: bestScore,
    depth: reachedDepth,
    nodes: ctx.nodes + result.totalNodes,
    elapsedMs: Date.now() - start,
    engine: "mcts",
  };
}

/** Utilitário exportado para inspeção/depuração da avaliação. */
export function avaliarPosicao(state: GameState, player: Player): number {
  return trilhaEvaluate(state, player);
}

/** Contagem de moinhos — exposta para o painel do QG. */
export function moinhosDe(state: GameState, player: Player): number {
  return countMills(state.board, player);
}
